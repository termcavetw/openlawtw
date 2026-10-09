"""Per-law commit boundary. A failed candidate never changes published evidence."""
from copy import deepcopy
import hashlib
import json
import re
import unicodedata
from urllib.parse import urlparse

SUCCESS = {'updated', 'unchanged'}
RETAINED = {'retained', 'not-attempted'}


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(',', ':')).encode()).hexdigest()


def normalized(value):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', value)).replace('台', '臺')


def source_for(law, sources):
    if not law:
        return None
    key = law['id']
    if key not in sources and law.get('source') == '全國法規資料庫':
        key = 'CF' if law['kind'] == '法律' else 'CM'
    return deepcopy(sources.get(key))


def validate_candidate(old, new, source):
    if not new or not new.get('id') or not new.get('name'):
        raise ValueError('Missing law identity')
    if old and any(new.get(k) != old.get(k) for k in ('id', 'name', 'region', 'source', 'url')):
        raise ValueError('Law identity or official URL changed; manual review required')
    url = urlparse(new['url'])
    if url.scheme != 'https' or not ((url.hostname or '').endswith('.gov.tw') or url.hostname=='laws.gov.taipei'):
        raise ValueError('Not an official HTTPS law source')
    if not source or not re.fullmatch('[0-9a-f]{64}', source.get('sha256', '')):
        raise ValueError('Missing verified raw source hash')
    if not source.get('observedAt') or new.get('retrieved') != source['observedAt']:
        raise ValueError('Successful fetch time disagrees with source provenance')
    articles = new.get('articles', [])
    if new.get('coverage') == 'full' and not articles:
        raise ValueError('Full text cannot be empty or attachment-only')
    if len({normalized(a['no']) for a in articles}) != len(articles):
        raise ValueError('Duplicate article numbers')
    if any(not a['no'].strip() or not a['text'].strip() for a in articles):
        raise ValueError('Empty article number or body')
    if any(token in article['text'] for article in articles for token in ('<script','ctl00_cp_content','資訊安全政策')):
        raise ValueError('Source navigation/script contamination in article text')
    if old:
        if old['coverage'] == 'full' and new['coverage'] != 'full':
            raise ValueError('Full text downgraded to attachment/link')
        # Even one missing article needs review. Legitimate repeals remain visible
        # as official deleted-article text rather than silently disappearing.
        if {normalized(a['no']) for a in old['articles']} - {normalized(a['no']) for a in articles}:
            raise ValueError('Previously recorded articles missing; manual review required')
        old_length = sum(len(normalized(a['text'])) for a in old['articles'])
        new_length = sum(len(normalized(a['text'])) for a in articles)
        if old_length and new_length < old_length * .8:
            raise ValueError('Official candidate text shrank by more than 20%; manual review required')


def reconcile(previous, candidates, old_sources, candidate_sources, failures, attempted_at,
              attempted_ids):
    """Return one complete mixed snapshot, provenance, and auditable outcomes.

    Call only after candidate body-to-raw completeness checks. Retained records
    are byte-equivalent JSON values; attempt state lives outside version objects.
    """
    result, sources, outcomes = {}, deepcopy(old_sources), []
    for law_id in dict.fromkeys([*previous, *candidates, *failures]):
        old, candidate = previous.get(law_id), candidates.get(law_id)
        source = source_for(candidate, candidate_sources)
        reason = failures.get(law_id)
        status = 'not-attempted'
        if law_id in attempted_ids and not reason:
            try:
                if not old and candidate and any(normalized(doc['name'])==normalized(candidate['name']) for doc in previous.values()):
                    raise ValueError('Existing law title moved to a different ID; manual review required')
                validate_candidate(old, candidate, source)
            except (ValueError, KeyError, TypeError) as error:
                reason = str(error)
            else:
                result[law_id] = deepcopy(candidate)
                sources[law_id] = source
                status = 'unchanged' if old == candidate else 'updated'
        if status not in SUCCESS:
            if old:
                result[law_id] = deepcopy(old)
                status = 'retained' if reason else 'not-attempted'
            else:
                status = 'unavailable'
        final = result.get(law_id)
        outcome = {'id': law_id, 'name': (old or candidate or {}).get('name', law_id),
                   'status': status, 'attemptedAt': attempted_at if law_id in attempted_ids else None,
                   'lastSuccessfulFetch': final.get('retrieved', '') if final else '',
                   'beforeHash': fingerprint(old), 'candidateHash': fingerprint(final) if final else None,
                   'beforeSourceHash': fingerprint(source_for(old, old_sources)),
                   'source': source_for(final, sources)}
        if reason:
            outcome['reason'] = reason
        outcomes.append(outcome)
    return result, sources, outcomes
