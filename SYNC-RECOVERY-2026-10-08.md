# Official snapshot transport recovery

The 2026-10-05 scheduled job failed at its first `sendlaw.moj.gov.tw`
ZIP download with `Network is unreachable`, before local sources or validation.
The logs do not establish an IPv4/IPv6 cause.

## Official replacement and fidelity

The MOJ website links its [OpenAPI documentation](https://law.moj.gov.tw/api/swagger/index.html).
The documented [law XML](https://law.moj.gov.tw/api/ch/law/xml) and
[order XML](https://law.moj.gov.tw/api/ch/order/xml) both returned HTTP 200 during
2026-10-08 verification, with a 2026-10-02 source snapshot. They are the primary
bulk sources now. No third-party mirror, TLS bypass or partial HTML fallback is used.

These ZIPs contain `ChLaw.xml` / `ChOrder.xml`, `schema.csv` and `manifest.csv`.
The adapter maps English field names in memory and preserves exact raw XML bytes
on disk. Actual XML spells the body tag `ArticleConctent`, while the schema CSV
says `ArticleContent`; either spelling is accepted, but ambiguous/missing fields,
unknown article types and structured text fail closed. The old cache filenames
are retained for compatibility; provenance records the real endpoint, archive
member, schema, snapshot, actual observation time, raw XML hash, ZIP hash and
schema hash. Historical Chinese-tag XML caches remain readable.

Original chapter order, article numbers/body, metadata, effective notices,
history and attachment URLs remain intact. Raw-source validation independently
compares the API XML against the candidate corpus. Existing document/image
snapshots are independent; an XML download does not refresh their dates.

## Failure and review safety

Downloads use at most two attempts, bounded timeouts and short backoff. A failed
refresh never succeeds by substituting an old cache. Two distinct sources exhausting
transport retries on the same host open a per-run circuit: subsequent URLs are
explicitly reported as not attempted, and the entire update is blocked. A new run
probes again; HTTP 404 and parser errors do not open this transport circuit.
This avoids hundreds of identical dead-host waits without claiming completion.
Both central archives must
validate before either extracted source is replaced. ZIP entries are read by
exact expected member, without extracting arbitrary archive paths.

Every workflow run starts a fresh UUID-scoped report before setup/downloads.
Reports/logs record attempted, failed and never-completed stages; an early crash
cannot upload a committed historical report as new evidence. Failed runs restore
canonical data. All reported source failures and missing configured laws block
verified output, alongside the existing article-loss and raw-source checks.
Successful runs preserve a verified data archive and diff for human review.
Only default-branch schedule/manual runs may update the single draft data PR;
branch validation cannot open data PRs or merge/deploy updates.

The original Monday 04:23 Asia/Taipei schedule and ENABLE_LAW_SYNC gate remain.
A temporary exact recovery-branch push trigger is used for real-run validation,
and has now been removed after the test. No broad permanent branch trigger is intended.

## Unresolved configuration

The pre-existing configured name
「建築物防火避難設施及設備安全標準檢查簽證專業機構或人員認可辦法」
was already listed in the historical sync report as missing. No corpus ID exists
for it. Exact text was absent from all names, articles and histories in the new
1,351-law and 10,452-order XML archives. The related
[NLMA recognition rule](https://www.nlma.gov.tw/ch/legislation/regsearch/1371)
has a different name/history, which does not establish equivalence.
It must not be silently renamed, treated as repealed, or omitted as a successful
fetch. Any separate resolution remains explicit in the run report and review.

## Verification

Offline parser/transport tests cover exact text and attachment preservation,
unknown/ambiguous schema rejection, bounded retry, HTTP errors, atomic cache
replacement and unsafe archive member rejection. Workflow/guard tests cover
fresh reports, fail-closed source errors, interruption, rollback, log bounds and
review artifacts. Full repository build/typecheck/check and real workflow run
results are recorded in the pull request; a passing code suite alone is not a
successful official-data refresh.


Actual-archive compatibility audit (2026-10-08): all 234 configured MOJ records,
11,018 articles / 1,910,039 original text characters, 1,027 chapter headings and
547 attachments matched directly against both source XMLs, including histories,
dates and effective notes. Original API XML hashes:
- CF: `2fc8d589eaa12007a247207f5a5857a117bfa0f6f16bd14fb9b3b84d96bf614f`
- CM: `d5ae6a3aa4ca53acf5a9862ccd02037447a2fac39854c05fbe6e0fdc0aef9d7b`

Additional regressions reject duplicate scalar/body fields and nested legal text.
Stage process groups are terminated before rollback, so a surviving descendant
cannot overwrite restored canonical data. Reports checkpoint source failures and
central source hashes during fetching, before the importer has finished.


## Local-source results and bounded parser fixes

Real run 37853919318 completed on 2026-10-08 and was correctly blocked by the
source guard. It downloaded 234 MOJ records and 9,056 NLMA rulings. No candidate
data was published: canonical files were restored, and a fresh diagnostic
artifact was uploaded. 490 local failures were reported: 38 exhausted transport
attempts, 312 explicitly unattempted URLs after host failures, 66 TLS-chain
failures (Keelung), 62 HTTP 403 responses (Yunlin/Lienchiang), and 12 parser cases.
The separate unresolved central label also remains blocking.

A temporary three-OS connectivity probe (run 37856677482) made one standard,
TLS-verified request per representative Taoyuan/Tainan/Hsinchu County URL on
Ubuntu, macOS and Windows. All nine failed to connect. It did not probe denied
403 sites or bypass TLS. The temporary probe workflow has been removed.

Twelve accessible official pages were independently retrieved and preserved as
raw regression fixtures with URLs and SHA-256 hashes in
`scripts/tests/fixtures/local-reviewed/manifest.json`. Five require full-text
parser corrections: Kaohsiung's spaced tens produce 67 points and nine chapters;
Changhua's nested decimal DOM lists produce six points; three Chiayi records
produce ten parenthesized points and 24/six styled articles, retaining duplicated
plain-text headings inside their bodies. Seven other Chiayi pages are verified
title-only attachment sources and remain link coverage, with all download URLs.
Their existing curated PDFs were independently re-downloaded and matched exactly;
existing document hashes/dates are not relabelled as new versions.

The new handlers are restricted to the twelve reviewed IDs, reject unsupported
structures and numbering, and independently check complete source-character
preservation. Production-importer regression tests also verify metadata, coverage,
all attachment URLs, source hashes and zero retained-source failures for these
fixtures. Repository law data has not been updated by this code repair.

The complete local refresh is still blocked by external connectivity, explicit
HTTP denial and TLS failures. Do not weaken source checks, bypass these failures,
or interpret passing code CI as a successful all-local refresh. The PR remains
a draft and must not be merged under the current all-local completion condition.
