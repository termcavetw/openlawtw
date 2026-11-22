#!/usr/bin/env python3
"""openlaw.py — query openlawtw (Taiwan building-law database) from the command line.

Standard library only. Data comes from the openlawtw static JSON API
(https://openlawtw.vercel.app/data/manifest.json) and is cached locally.

Commands
  find-law  <name>                         resolve a law name / alias / id
  article   <law> <no> [<no> ...]          print article text (e.g. 107, 164-1, 第一百零七條)
  toc       <law>                          list chapters and article numbers of one law
  search    <keywords...> [--region R] [--law L] [--limit N]
                                           full-text search over articles (all keywords must match)
  rulings   [keywords...] [--law L] [--article N] [--limit N]
                                           search 國土署 rulings (函釋)
  ruling    <id>                           print one ruling in full
  info                                     data version and source

Environment
  OPENLAW_BASE   data host (default https://openlawtw.vercel.app)
  OPENLAW_DATA   path to a local clone of termcavetw/openlawtw (uses its data/ folder, no network)
  OPENLAW_CACHE  cache folder (default ~/.cache/openlawtw)
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

SITE = "https://openlawtw.vercel.app"
FALLBACK_BASES = [
    "https://openlawtw.vercel.app",
    "https://cdn.jsdelivr.net/gh/termcavetw/openlawtw@main",
    "https://raw.githubusercontent.com/termcavetw/openlawtw/main",
]
CACHE = os.path.expanduser(os.environ.get("OPENLAW_CACHE", "~/.cache/openlawtw"))
LOCAL = os.environ.get("OPENLAW_DATA")
TTL = 12 * 3600  # refresh manifest / catalog twice a day

_base = None


# ---------------------------------------------------------------- fetching

def _bases():
    env = os.environ.get("OPENLAW_BASE")
    return [env.rstrip("/")] if env else FALLBACK_BASES


def _http(url):
    req = urllib.request.Request(url, headers={"User-Agent": "openlawtw-skill/1.0"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()


def fetch(path, immutable=True):
    """Return parsed JSON for a site path like /data/manifest.json."""
    global _base
    if LOCAL:
        with open(os.path.join(LOCAL, path.lstrip("/")), encoding="utf-8") as f:
            return json.load(f)
    cpath = os.path.join(CACHE, path.lstrip("/"))
    if os.path.exists(cpath) and (immutable or time.time() - os.path.getmtime(cpath) < TTL):
        with open(cpath, encoding="utf-8") as f:
            return json.load(f)
    bases = [_base] if _base else _bases()
    err = None
    for b in bases:
        try:
            raw = _http(b + path)
            data = json.loads(raw.decode("utf-8"))
            _base = b
            os.makedirs(os.path.dirname(cpath), exist_ok=True)
            with open(cpath, "wb") as f:
                f.write(raw)
            return data
        except Exception as e:  # try next host
            err = e
    if os.path.exists(cpath):  # stale cache beats nothing
        with open(cpath, encoding="utf-8") as f:
            return json.load(f)
    sys.exit(f"無法取得 {path}：{err}")


def manifest():
    return fetch("/data/manifest.json", immutable=False)


def catalog():
    return fetch("/data/catalog.json", immutable=False)


def aliases():
    try:
        return fetch("/data/aliases.json", immutable=False)
    except SystemExit:
        return {}


def load_law(law_id):
    entry = manifest()["laws"].get(law_id)
    if not entry:
        sys.exit(f"manifest 裡沒有 {law_id}")
    return fetch(entry["url"])


def load_laws(ids):
    with ThreadPoolExecutor(12) as ex:
        return list(ex.map(load_law, ids))


def load_rulings():
    shards = list(manifest()["rulings"].values())
    with ThreadPoolExecutor(12) as ex:
        parts = list(ex.map(lambda s: fetch(s["url"]), shards))
    return [r for p in parts for r in p]


# ---------------------------------------------------------------- numbers

CN = {"零": 0, "〇": 0, "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5,
      "六": 6, "七": 7, "八": 8, "九": 9}
CN_UNIT = {"十": 10, "百": 100, "千": 1000}


def cn2int(s):
    if s.isdigit():
        return int(s)
    total, num = 0, 0
    for ch in s:
        if ch in CN:
            num = CN[ch]
        elif ch in CN_UNIT:
            total += (num or 1) * CN_UNIT[ch]
            num = 0
        else:
            raise ValueError(s)
    return total + num


def norm_no(s):
    """'第 164-1 條' / '164之1' / '第一百零七條' / '107' -> '164-1' / '107'."""
    s = str(s).replace(" ", "").replace("　", "")
    s = re.sub(r"^第", "", s)
    s = s.replace("條之", "-")
    s = re.sub(r"條$", "", s)
    s = s.replace("之", "-").replace("－", "-").replace("—", "-")
    parts = s.split("-")
    try:
        return "-".join(str(cn2int(p)) for p in parts if p)
    except ValueError:
        return s


# ---------------------------------------------------------------- laws

# ---------------------------------------------------------------- amendment dates

ROC_DATE = re.compile(r"(?:中華)?民國\s*([〇零一二三四五六七八九十百0-9]+)\s*年\s*([〇零一二三四五六七八九十0-9]+)\s*月\s*([〇零一二三四五六七八九十0-9]+)\s*日")
ART_LIST = re.compile(r"第\s*([0-9][0-9\-、～~，,\s]*?)\s*條")


def roc_date(text):
    m = ROC_DATE.search(text or "")
    if not m:
        return None
    try:
        y, mo, d = (cn2int(x) for x in m.groups())
        return f"{y + 1911:04d}-{mo:02d}-{d:02d}"
    except ValueError:
        return None


def _expand(chunk):
    out = []
    for part in re.split(r"[、，,]", chunk.replace(" ", "")):
        if not part:
            continue
        if "～" in part or "~" in part:
            a, b = re.split(r"[～~]", part, maxsplit=1)
            pa, pb = a.split("-"), b.split("-")
            try:
                if len(pa) == 1 and len(pb) == 1:
                    out += [str(i) for i in range(int(pa[0]), int(pb[0]) + 1)]
                elif len(pa) == 2 and len(pb) == 2 and pa[0] == pb[0]:
                    out += [f"{pa[0]}-{i}" for i in range(int(pa[1]), int(pb[1]) + 1)]
                elif len(pa) == 1 and len(pb) == 2:
                    out += [a] + [f"{pb[0]}-{i}" for i in range(1, int(pb[1]) + 1)]
                else:
                    out += [a, b]
            except ValueError:
                out += [a, b]
        else:
            out.append(part)
    return out


_amend_cache = {}


def amendments(law):
    """Map normalised article no -> latest date that article was amended or added (from the law's 沿革)."""
    if law["id"] in _amend_cache:
        return _amend_cache[law["id"]]
    dates, full = {}, None
    items = re.split(r"\n\s*\d+\.\s*", "\n" + (law.get("history") or ""))
    for item in items:
        text = re.sub(r"\s*\n\s*", "", item)
        d = roc_date(text)
        if not d:
            continue
        if re.search(r"全文\s*\d*\s*條|修正發布全文|修正全文", text):
            full = max(full or d, d)
        for chunk in ART_LIST.findall(text):
            for no in _expand(chunk):
                k = norm_no(no)
                if k and dates.get(k, "") < d:
                    dates[k] = d
    result = (dates, full)
    _amend_cache[law["id"]] = result
    return result


def article_amended(law, no):
    dates, full = amendments(law)
    d = dates.get(norm_no(no))
    if full and (not d or full > d):
        d = full
    return d


def staleness(r):
    """Warnings for refs whose article was amended after the ruling was issued."""
    notes = []
    date = r.get("date") or ""
    for x in r.get("refs") or []:
        if not x.get("article") or x.get("law") not in manifest()["laws"]:
            continue
        law = load_law(x["law"])
        d = article_amended(law, x["article"])
        if d and date and date < d:
            notes.append(f"{law['name']}{x['article']}於 {d} 修正，晚於本函釋（{date}）")
    return notes


def law_link(law_id, anchor=None):
    return f"{SITE}/laws/{law_id}.html" + (f"#{anchor}" if anchor else "")


def resolve_law(q, region=None):
    """Return a catalog entry for an id, name or alias. Exits with candidates if ambiguous."""
    laws = catalog()["laws"]
    q = q.strip()
    by_id = {l["id"]: l for l in laws}
    if q in by_id:
        return by_id[q]
    pool = [l for l in laws if not region or l["region"] == region]
    target = aliases().get(q.lower(), aliases().get(q, q))
    exact = [l for l in pool if l["name"] == target]
    if exact:
        return sorted(exact, key=lambda l: l["region"] != "中央")[0]
    cand = [l for l in pool if target in l["name"]]
    if not cand:  # loose: every character in order
        pat = ".*".join(map(re.escape, target))
        cand = [l for l in pool if re.search(pat, l["name"])]
    if not cand:
        sys.exit(f"找不到法規「{q}」。可以用 find-law 換關鍵字試試。")
    cand.sort(key=lambda l: (l["region"] != "中央", len(l["name"])))
    if len(cand) > 1 and not cand[0]["name"].startswith(target):
        print(f"「{q}」對到多部法規，先用最可能的一部；其他候選：", file=sys.stderr)
        for l in cand[1:8]:
            print(f"  {l['id']}  {l['region']}  {l['name']}", file=sys.stderr)
    return cand[0]


def law_header(law):
    bits = [f"{law['name']}（{law.get('region', '')}｜{law.get('kind', '')}）"]
    if law.get("modified"):
        bits.append(f"最新修正日期：{law['modified']}")
    if law.get("status") and "廢止" in law["status"] and "未標" not in law["status"]:
        bits.append(f"⚠ 狀態：{law['status']}")
    if law.get("effectiveNote"):
        bits.append("施行日註記：" + law["effectiveNote"].replace("\n", " "))
    return "\n".join(bits)


def cmd_find_law(a):
    laws = catalog()["laws"]
    q = " ".join(a.name)
    target = aliases().get(q.lower(), aliases().get(q, q))
    hits = [l for l in laws if target in l["name"] or q == l["id"]]
    if a.region:
        hits = [l for l in hits if l["region"] == a.region]
    hits.sort(key=lambda l: (l["region"] != "中央", len(l["name"])))
    if not hits:
        print("沒有找到。")
    for l in hits[: a.limit]:
        print(f"{l['id']}\t{l['region']}\t{l.get('kind', '')}\t{l['name']}\t(修正 {l.get('modified') or '—'}，{l.get('articleCount', '?')} 條)")


def clean(text, law):
    """Local-government HTML often breaks lines mid-sentence; join those back up."""
    if law.get("region") == "中央":
        return text
    text = re.sub(r"(?<![。：；！？」）)])\n\s*\n?\s*", "", text)
    return re.sub(r"\n\s*\n", "\n", text)


def find_article(law, no):
    want = norm_no(no)
    for art in law["articles"]:
        if norm_no(art["no"]) == want:
            return art
    return None


def cmd_article(a):
    meta = resolve_law(a.law, a.region)
    law = load_law(meta["id"])
    print(law_header(law))
    print(f"官方來源：{law.get('url', '')}")
    for no in a.no:
        art = find_article(law, no)
        print("\n" + "─" * 30)
        if not art:
            near = [x["no"] for x in law["articles"] if norm_no(x["no"]).split("-")[0] == norm_no(no).split("-")[0]]
            print(f"找不到「{no}」。" + (f" 相近：{'、'.join(near)}" if near else ""))
            continue
        path = " > ".join(art.get("path") or [])
        amended = article_amended(law, art["no"])
        print(f"{law['name']} {art['no']}" + (f"　［{path}］" if path else "") + (f"　（本條最近修正：{amended}）" if amended else ""))
        print(clean(art["text"], law))
        print(f"連結：{law_link(law['id'], art.get('anchor'))}")


def cmd_toc(a):
    meta = resolve_law(a.law, a.region)
    law = load_law(meta["id"])
    print(law_header(law))
    last = None
    for art in law["articles"]:
        path = " > ".join(art.get("path") or [])
        if path != last:
            print(f"\n［{path or '（無章節）'}］")
            last = path
        first = art["text"].strip().split("\n")[0]
        print(f"  {art['no']}  {first[:40]}")


def snippet(text, kws, width=70):
    t = text.replace("\n", " ")
    pos = min([t.find(k) for k in kws if k in t] or [0])
    s = max(0, pos - width // 3)
    out = t[s:s + width * 2]
    return ("…" if s else "") + out + ("…" if s + width * 2 < len(t) else "")


def cmd_search(a):
    kws = [k for k in a.keywords if k]
    cat = catalog()["laws"]
    if a.law:
        ids = [resolve_law(x, a.region)["id"] for x in a.law.split(",")]
    else:
        regions = set((a.region or "中央").split(","))
        ids = [l["id"] for l in cat if l["region"] in regions or "全部" in regions]
    laws = load_laws([i for i in ids if i in manifest()["laws"]])
    hits = []
    for law in laws:
        for art in law["articles"]:
            text = art["text"]
            n = sum(text.count(k) for k in kws)
            matched = sum(1 for k in kws if k in text)
            if matched == len(kws) or (a.any and matched):
                hits.append((matched, n, law, art))
    hits.sort(key=lambda h: (-h[0], -h[1], h[2]["region"] != "中央"))
    print(f"搜尋「{' '.join(kws)}」：{len(hits)} 條符合（範圍：{len(laws)} 部法規）")
    for _, _, law, art in hits[: a.limit]:
        print(f"\n■ {law['name']} {art['no']}　[{law['id']}]")
        print("  " + snippet(clean(art["text"], law), kws))
    if len(hits) > a.limit:
        print(f"\n…還有 {len(hits) - a.limit} 條，加 --limit 或縮小關鍵字。")
    if not hits and not a.any:
        print("沒有全部關鍵字都符合的條文，可以加 --any 改成任一關鍵字符合，或換同義詞。")


_names = None


def law_name(law_id):
    global _names
    if _names is None:
        _names = {l["id"]: l["name"] for l in catalog()["laws"]}
    return _names.get(law_id, law_id)


def ruling_refs(r):
    return "、".join(f"{law_name(x.get('law'))} {x.get('article') or ''}".strip() for x in r.get("refs") or [])


def cmd_rulings(a):
    rs = load_rulings()
    kws = a.keywords or []
    law_id = resolve_law(a.law)["id"] if a.law else None
    art_no = norm_no(a.article) if a.article else None
    out, seen = [], set()
    for r in rs:
        key = (r.get("numberKey"), r.get("date"))
        if r.get("numberKey") and key in seen:  # same letter listed twice
            continue
        if law_id:
            refs = r.get("refs") or []
            ok = [x for x in refs if x.get("law") == law_id]
            if art_no:
                ok = [x for x in ok if x.get("article") and norm_no(x["article"]) == art_no]
            if not ok:
                continue
        blob = (r.get("title") or "") + "\n" + (r.get("body") or "")
        if kws and not all(k in blob for k in kws):
            continue
        seen.add(key)
        out.append(r)
    out.sort(key=lambda r: r.get("date") or "", reverse=True)
    print(f"函釋符合：{len(out)} 則（依日期新到舊）")
    for r in out[: a.limit]:
        print(f"\n■ [{r['id']}] {r.get('date', '')}　{r.get('number', '')}")
        print(f"  {r.get('title', '')}")
        if r.get("refs"):
            print(f"  涉及：{ruling_refs(r)}")
        for n in staleness(r):
            print(f"  ⚠ {n}，引用前請對照現行條文")
        if r.get("body"):
            print("  " + snippet(r["body"], kws or [""], 60))
        print(f"  {r.get('url', '')}")


def cmd_ruling(a):
    for r in load_rulings():
        if str(r.get("id")) == str(a.id):
            print(f"{r.get('number', '')}（{r.get('date', '')}，{r.get('unit', '')}）")
            print(r.get("title", ""))
            if r.get("refs"):
                print(f"涉及：{ruling_refs(r)}")
            for n in staleness(r):
                print(f"⚠ {n}。函釋引用的可能是舊條文，請對照現行條文再引用")
            print("─" * 30)
            print(r.get("body") or "（本庫未收錄全文，請看原始連結）")
            print("─" * 30)
            print(f"來源：{r.get('url', '')}")
            return
    sys.exit(f"找不到函釋 {a.id}")


def cmd_info(a):
    m, c = manifest(), catalog()
    print(f"openlawtw 資料版本 {m.get('release')}，收錄 {len(m['laws'])} 部法規、{len(load_rulings())} 則函釋")
    print(f"最近同步：{c.get('collected')}")
    print(f"資料來源：{LOCAL or _base or '本機快取 ' + CACHE}")


def main():
    p = argparse.ArgumentParser(description="openlawtw 臺灣建築法規查詢")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("find-law"); s.add_argument("name", nargs="+")
    s.add_argument("--region"); s.add_argument("--limit", type=int, default=20); s.set_defaults(f=cmd_find_law)

    s = sub.add_parser("article"); s.add_argument("law"); s.add_argument("no", nargs="+")
    s.add_argument("--region"); s.set_defaults(f=cmd_article)

    s = sub.add_parser("toc"); s.add_argument("law"); s.add_argument("--region"); s.set_defaults(f=cmd_toc)

    s = sub.add_parser("search"); s.add_argument("keywords", nargs="+")
    s.add_argument("--region", help="中央（預設）、桃園市…，逗號分隔；「全部」= 所有縣市")
    s.add_argument("--law", help="限定法規，逗號分隔（名稱、簡稱或 ID）")
    s.add_argument("--limit", type=int, default=15)
    s.add_argument("--any", action="store_true", help="任一關鍵字符合即可")
    s.set_defaults(f=cmd_search)

    s = sub.add_parser("rulings"); s.add_argument("keywords", nargs="*")
    s.add_argument("--law"); s.add_argument("--article"); s.add_argument("--limit", type=int, default=10)
    s.set_defaults(f=cmd_rulings)

    s = sub.add_parser("ruling"); s.add_argument("id"); s.set_defaults(f=cmd_ruling)
    s = sub.add_parser("info"); s.set_defaults(f=cmd_info)

    a = p.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    a.f(a)


if __name__ == "__main__":
    main()
