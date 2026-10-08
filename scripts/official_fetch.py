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
