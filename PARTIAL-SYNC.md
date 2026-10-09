# Independently validated official-law synchronization

The weekly workflow stages each law before changing its published record. Official
HTML/XML text must be complete, match its identity and raw-source SHA-256, and
pass article/coverage loss checks. A missing title, transport/TLS/403 error,
unrecognized format, duplicate article, suspicious truncation or changed identity
retains that law's entire old object and resolved provenance. Never bypass a site
restriction or reinterpret an attachment index as full text.

Successful laws receive per-ID provenance. Legacy CF/CM evidence remains available
for retained central records. Each MOJ archive can succeed independently; malformed
individual records are omitted from candidates and their old laws retained. A
corrupt archive or source-hash mismatch prevents accepting that archive's laws.

`data/sync-report.json` has policy `per-law-v1`, complete outcomes, baseline/candidate
fingerprints and resolved evidence. The guard verifies all retained data and source
records against the run baseline. Raw-source validation is limited to accepted
outcomes; global catalog, article, relationship and ruling checks remain mandatory.
Build, typecheck, PWA, immutable version and other structural failures still restore
the entire baseline. Ruling synchronization remains a separately validated dataset;
a fatal ruling import still fails the run rather than publishing unverified rulings.

Dates mean different things:
- `attemptedAt`: this synchronization attempt, not a successful fetch
- `lastSuccessfulFetch`: the final law's existing `retrieved` value; unknown stays empty
- `modified`, `effective`, `snapshot`: source publication/legal dates, never guessed
- catalog `collected`: batch generation time, not every law's retrieval date

Failures and attempt timestamps live in catalog/report status, not law content or
version objects. An unsuccessful law gets no fabricated new version or success
date. Independent PDF/attachment evidence retains its own version and retrieval.
The UI shows batch time, per-law evidence and retained/unavailable-source details.
Detailed status is a lazy, content-addressed shard with visible failure/retry; it
does not inflate the initial PWA shell. Unused status labels are omitted only
from lightweight summaries, never from complete law records or archives.
Downloads save a dated provenance sidecar; cached bytes without verified fetch
provenance cannot acquire a success date from their filesystem modification time.

Only independently verified changes produce the existing **draft** data PR; no
auto-merge is added. All-failed/byte-unchanged runs without ruling/data changes retain
diagnostics but do not open a timestamp-only PR. Human review must check actual
legal changes against the official text. A substantial legitimate deletion or
renumbering needs explicit manual review rather than automatic acceptance.

## Verification

`python -m unittest discover -s scripts/tests -v`, `npm run build`,
`npm run typecheck`, `npm run check` cover failures, missing records, unchanged
records, mixed outcomes, raw-source mismatch, legacy provenance and full rollback.

A bounded run can use `--add-only --only-laws ID1,ID2`; central records and other
local records remain untouched. Do not use `--refresh` with `--add-only`.
On 2026-10-08 a two-page live probe (嘉義市-FL030697, 高雄市-GL002088)
accepted both official pages and validated 77 complete articles plus raw hashes.
A separate controlled mixed run reused the fetched 嘉義頁 and explicitly skipped
高雄市: one accepted update, one exact retained record, 1,043 untouched records;
guard and raw/structural validation passed. This is bounded evidence, not a claim
that all 814 local sources were freshly rechecked. No data from these probes is
included in the implementation PR.

## Runtime status and offline behavior

The full catalog and sync report retain the complete audit outcomes. The app loads
only presentation fields from a content-addressed status shard when the source or
version panel opens. Failed status downloads show an explicit warning and retry
control; they do not imply that all sources succeeded. The portable HTML includes
the same status shard. Ordinary PWA users may need a connection the first time
they open synchronization status; stored law retrieval dates remain available.

The initial shell does not embed audit hashes or per-law outcome arrays. Unused
status strings in lightweight law summaries are omitted, while complete law
shards and version archives retain their original records. All normal and
maskable app icons remain cached; the existing 3 MiB shell budget is unchanged.

A separate central-only bounded probe fetched the two official MOJ API archives:
234 central laws passed exact XML and SHA-256 validation; 811 other records
remained untouched. Eleven central records had observed article-text changes.
The one unmatched configured title was not invented or published.
