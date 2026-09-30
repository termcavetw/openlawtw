# MOJ parser fixtures

Unmodified UTF-8 response bytes captured from official MOJ public pages on 2026-09-30.
These fixtures are offline parser test evidence, not a substitute for live source freshness checks.
Tests use a fixed synthetic retrieval timestamp solely to exercise provenance; production callers must supply actual recorded retrieval time.

| Fixture | Official source | SHA-256 |
| --- | --- | --- |
| J0030099-history.html | https://law.moj.gov.tw/LawClass/LawHistory.aspx?pcode=J0030099 | 1cd82800a5f2a9329dca56947e38d70cd7153964d0142d33fd0fa40a482ddd7d |
| J0030099.html | https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0030099 | 3aa3a5818a2de8741670c38d68fd2cbac4bb203ea26023918a4d55f67d2f1d4f |
| J0040051.html | https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0040051 | b785ea1fd27509226b18f4f7dd224eada1e457d494067155de05c0062cb6b82f |


Run: `python -m unittest discover -s scripts/tests -v`

The parser preserves each `line-*` div as a text line without normalizing legal wording, spaces, punctuation, or Unicode. HTML line breaks become newlines. Chapter paths come from `char-*` heading siblings. History preserves the official newest-first display order and its original wrapped lines. The explicit 生效狀態 block is used for `effectiveNote`; no whole-law effective date is inferred from modification dates or commencement clauses.
