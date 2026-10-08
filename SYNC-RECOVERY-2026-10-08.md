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
refresh never succeeds by substituting an old cache. Both central archives must
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
and is removed after the test. No broad permanent branch trigger is intended.

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
