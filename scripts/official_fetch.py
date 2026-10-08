"""Bounded HTTPS retrieval; never use stale bytes after a refresh failure."""
from pathlib import Path
import ssl
import time
import urllib.error
import urllib.request


class SourceUnavailable(RuntimeError):
    """All bounded attempts failed at the transport layer."""


def download(url, *, timeout=20, attempts=2, opener=urllib.request.urlopen, sleep=time.sleep):
    if not url.startswith('https://'):
        raise ValueError('Official sources require HTTPS')
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'OpenLawTW/official-source-snapshot'})
            with opener(request, timeout=timeout) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            if isinstance(error, urllib.error.HTTPError) and error.code not in (408, 429, 500, 502, 503, 504):
                raise
            if isinstance(getattr(error, 'reason', None), ssl.SSLCertVerificationError):
                raise  # Never work around TLS security failures.
            if attempt + 1 == attempts:
                raise SourceUnavailable(f'{url}: {attempts} attempts failed: {error}') from error
            sleep(min(2 ** attempt, 4))


def atomic_write(path, raw):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_bytes(raw)
    temporary.replace(path)


class SourceCircuitOpen(SourceUnavailable):
    """A source was not attempted after repeated host transport failures."""


class HostCircuitBreaker:
    """Fail closed quickly instead of repeating dead-host timeouts for every law.

    Only exhausted transport retries count. A 404, parser error or other
    non-transient HTTP failure does not open the host circuit. A new sync run
    creates a new breaker and probes the host again. Every unattempted URL raises
    explicitly and must appear as a failed source in the review report.
    """
    def __init__(self, fetch=download, threshold=2):
        import threading
        self.fetch = fetch
        self.threshold = threshold
        self.lock = threading.Lock()
        self.failures = {}
        self.blocked = {}

    def __call__(self, url, **kwargs):
        from urllib.parse import urlsplit
        host = urlsplit(url).netloc
        with self.lock:
            reason = self.blocked.get(host)
        if reason is not None:
            raise SourceCircuitOpen(f'{url}: not attempted; {host} transport failed for '
                                    f'{self.threshold} distinct sources in this run: {reason}')
        try:
            raw = self.fetch(url, **kwargs)
        except SourceUnavailable as error:
            with self.lock:
                failures = self.failures.setdefault(host, {})
                failures[url] = str(error)
                if len(failures) >= self.threshold:
                    self.blocked[host] = str(error)
            raise
        else:
            with self.lock:
                self.failures.pop(host, None)
            return raw
