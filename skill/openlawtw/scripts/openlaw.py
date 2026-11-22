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
  conflicts <law> [<no>]                   deleted references, void notes, revoked and stale rulings
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


def fetch(path, immutable=True, retry=True):
    """Return parsed JSON for a site path like /data/manifest.json.
    With retry=False a missing file raises FileNotFoundError instead of exiting."""
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
    if not retry and "404" in str(err):
        raise FileNotFoundError(path)
    sys.exit(f"無法取得 {path}：{err}")


def manifest():
    return fetch("/data/manifest.json", immutable=False)


def catalog():
    return fetch("/data/catalog.json", immutable=False)


EXTRA_ALIASES = {
    "危老獎勵": "都市危險及老舊建築物建築容積獎勵辦法",
    "危老容積獎勵": "都市危險及老舊建築物建築容積獎勵辦法",
    "危老獎勵辦法": "都市危險及老舊建築物建築容積獎勵辦法",
    "危老細則": "都市危險及老舊建築物加速重建條例施行細則",
    "危老施行細則": "都市危險及老舊建築物加速重建條例施行細則",
    "危老結構評估": "都市危險及老舊建築物結構安全性能評估辦法",
    "供公眾使用": "建築物使用類組及變更使用辦法",
}
# short names that stand for a whole family of laws (used by find-law)
FAMILIES = {
    "危老": "都市危險及老舊建築物",
    "都更": "都市更新",
    "建技": "建築技術規則",
    "非都": "非都市土地",
    "綠建築": "綠建",
}


def aliases():
    try:
        base = fetch("/data/aliases.json", immutable=False)
    except SystemExit:
        base = {}
    merged = dict(base)
    merged.update(EXTRA_ALIASES)
    return merged


def refresh_index():
    """Drop cached manifest/catalog/rulings index so the next call fetches the current deployment."""
    global _rulings, _revoked
    for path in ("/data/manifest.json", "/data/catalog.json"):
        cpath = os.path.join(CACHE, path.lstrip("/"))
        if os.path.exists(cpath):
            os.utime(cpath, (0, 0))  # mark stale; kept as a last-resort fallback
    _rulings, _revoked = None, None


def fetch_versioned(get_entry):
    """Fetch a content-addressed file; if the site was redeployed and the old URL is gone, refresh the index once."""
    entry = get_entry()
    try:
        return fetch(entry["url"], retry=False)
    except FileNotFoundError:
        refresh_index()
        entry = get_entry()
        return fetch(entry["url"])


def load_law(law_id):
    def entry():
        e = manifest()["laws"].get(law_id)
        if not e:
            sys.exit(f"manifest 裡沒有 {law_id}")
        return e
    return fetch_versioned(entry)


def load_laws(ids):
    with ThreadPoolExecutor(12) as ex:
        return list(ex.map(load_law, ids))


_rulings = None


def load_rulings():
    """All rulings, with letters listed twice (same number and date) removed."""
    global _rulings
    if _rulings is None:
        keys = list(manifest()["rulings"].keys())
        with ThreadPoolExecutor(12) as ex:
            parts = list(ex.map(lambda k: fetch_versioned(lambda: manifest()["rulings"][k]), keys))
        seen, out = set(), []
        for r in (r for p in parts for r in p):
            if not r.get("date") or not r.get("number"):
                fill_header(r)
            key = (r.get("numberKey"), r.get("date")) if r.get("numberKey") else ("id", r.get("id"))
            if key in seen:
                continue
            seen.add(key)
            out.append(r)
        _rulings = out
    return _rulings


# Some letters start with an editor's note (※註：…) or a meeting title, so the
# source left date/number empty. Recover them from the first lines of the body.
HEADER_RE = re.compile(r"((?:內政部|行政院|司法院|考選部|財政部|經濟部|法務部|臺灣省政府|台灣省政府)[^\d\n（）()]{0,10}?)?"
                       r"(\d{2,3})[.．](\d{1,2})[.．](\d{1,2})[.．]?\s*([^\s（）()「」，。]{1,24}?號)(函|令|代電|公告)?")


def fill_header(r):
    lines = [l.strip() for l in (r.get("body") or "").split("\n")]
    lines = [l for l in lines if l and not re.match(r"^※?註[：:]", l)][:3]
    for line in lines:
        m = HEADER_RE.search(line)
        if not m:
            continue
        agency, y, mo, d, no, kind = m.groups()
        if not r.get("date"):
            r["date"] = f"{int(y) + 1911}-{int(mo):02d}-{int(d):02d}"
        if not r.get("number"):
            r["number"] = re.sub(r"^x", "", f"{agency or ''}{y}.{mo}.{d}{no}{kind or ''}")
            core = re.search(r"第(.+?)號", no) or re.search(r"字(.+?)號", no)
            digits = re.sub(r"\D", "", cn_digits_to_arabic(core.group(1) if core else no))
            if not r.get("numberKey") and len(digits) >= 4:
                r["numberKey"] = digits
            r["headerFromBody"] = True
        return


# ---------------------------------------------------------------- numbers

CN = {"零": 0, "〇": 0, "○": 0, "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5,
      "六": 6, "七": 7, "八": 8, "九": 9}
CN_UNIT = {"十": 10, "百": 100, "千": 1000}


def cn2int(s):
    if s.isdigit():
        return int(s)
    if s and all(c in CN for c in s):  # 一一三 = 113
        return int("".join(str(CN[c]) for c in s))
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


def cn_digits_to_arabic(s):
    s = re.sub(r"[０-９]", lambda m: chr(ord(m.group(0)) - 0xFEE0), s)
    return re.sub(r"[零〇○一二三四五六七八九]{3,}", lambda m: "".join(str(CN[c]) for c in m.group(0)), s)


_revoked = None
NUM = re.compile(r"第\s*([0-9A-Za-z]{5,12})\s*號")


def revocations():
    """old ruling id -> (revoking ruling, partial?) parsed from 「…停止適用」 sentences."""
    global _revoked
    if _revoked is not None:
        return _revoked
    rs = load_rulings()
    by_key = {}
    for r in rs:
        if r.get("numberKey") and r["numberKey"] not in by_key:
            by_key[r["numberKey"]] = r
    out = {}
    for r in rs:
        body = cn_digits_to_arabic(r.get("body") or "")
        for m in re.finditer(r"([^。；\n]{0,200}?)(停止適用|不再援用|不再適用)", body):
            seg = m.group(1)
            if re.search(r"(無|未|非|不|免)[廢止或]{0,3}$", seg):  # 「尚無廢止或停止適用」
                continue
            revoker = r
            k = seg.rfind("經")
            if k >= 0:
                after = NUM.findall(seg[k:])
                if after:
                    b = by_key.get(after[-1])
                    if b:
                        revoker = b
                    seg = seg[:k]
            nums = NUM.findall(seg)
            if not nums:
                continue
            targets = nums if re.search(r"等\s*\d*\s*[函則件]", seg) else [nums[-1]]
            partial = bool(re.search(r"部分|說明[一二三四五六七八九十0-9]|第\s*[0-9一二三四五六七八九十]+\s*[點項款]", seg[seg.rfind(targets[-1]):]))
            for n in targets:
                old = by_key.get(n)
                if not old or old["id"] == revoker["id"] or (old.get("date") or "") >= (revoker.get("date") or ""):
                    continue
                prev = out.get(str(old["id"]))
                if not prev or (prev[0].get("date") or "") < (revoker.get("date") or ""):
                    out[str(old["id"])] = (revoker, partial)
    _revoked = out
    return out


def ruling_warnings(r):
    notes = []
    rev = revocations().get(str(r.get("id")))
    if rev:
        by, partial = rev
        notes.append(f"⚠ {'部分內容' if partial else '本函釋'}已由 {by.get('number', '')}（{by.get('date', '')}）停止適用 [ruling {by['id']}]")
    for n in staleness(r):
        notes.append(f"⚠ {n}，引用前請對照現行條文")
    return notes


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
    first = roc_date((law.get("history") or "").split("\n")[0] if law.get("history") else "")
    if first:
        bits.append(f"制定／訂定日期：{first}")
    if law.get("modified"):
        bits.append(f"最新修正日期：{law['modified']}")
    if law.get("status") and "廢止" in law["status"] and "未標" not in law["status"]:
        bits.append(f"⚠ 狀態：{law['status']}")
    if law.get("effectiveNote"):
        bits.append("施行日註記：" + law["effectiveNote"].replace("\n", " "))
    return "\n".join(bits)


def cmd_find_law(a):
    laws = catalog()["laws"]
    regions = {l["region"] for l in laws}
    region = a.region
    terms = []
    for t in a.name:
        t = t.strip()
        if not t:
            continue
        if t in regions and not region:
            region = t
            continue
        terms.append(t)
    al = aliases()

    def variants(t):
        v = {t, al.get(t.lower(), al.get(t, t))}
        if t in FAMILIES:
            v.add(FAMILIES[t])
        return v

    pool = [l for l in laws if not region or l["region"] == region]
    hits = [l for l in pool if l["id"] in terms or all(
        any(x in l["name"] for x in variants(t)) for t in terms)]
    hits.sort(key=lambda l: (l["region"] != "中央", len(l["name"])))
    if not hits:
        print("沒有找到。可以換個關鍵字，或用 search 搜條文內容。")
    for l in hits[: a.limit]:
        print(f"{l['id']}\t{l['region']}\t{l.get('kind', '')}\t{l['name']}\t(修正 {l.get('modified') or '—'}，{l.get('articleCount', '?')} 條)")


def clean(text, law):
    """Local-government HTML often breaks lines mid-sentence; join those back up."""
    if law.get("region") == "中央":
        return text
    text = re.sub(r"(?<![。：；！？」）)])\n\s*\n?\s*", "", text)
    return re.sub(r"\n\s*\n", "\n", text)


CN_DIGITS = "〇一二三四五六七八九十"


def article_attachments(law, art):
    """Attachment files (附表/附圖/補充圖例) that belong to this article."""
    files = law.get("attachments") or []
    if not files:
        return []
    no = norm_no(art["no"])
    labels = set(re.findall(r"(附[表圖件][一二三四五六七八九十〇0-9]+)", art["text"]))
    picked, seen = [], set()
    for f in files:
        t = f.get("title") or ""
        mine = False
        m = re.match(r"第\s*([0-9\-之]+)\s*條", t)
        if m and norm_no(m.group(1)) == no:
            mine = True
        elif any(t.startswith(lb) or t.replace("、", "：").startswith(lb) for lb in labels):
            mine = True
        if not mine:
            continue
        stem = re.sub(r"\.(pdf|doc|docx|odt|jpg|png)$", "", t, flags=re.I)
        if stem in seen:  # same table in another format: keep the first (PDF usually first)
            continue
        seen.add(stem)
        picked.append(f)
    return picked


EXC_RULES = [
    ("但書", re.compile(r"(^|[。；：\s])但[^書]")),
    ("但書", re.compile(r"不在此限")),
    ("除外", re.compile(r"除[^。；]{1,80}?外[，、之]")),
    ("免受限制", re.compile(r"得?不受[^。；]{0,40}(限制|規定|拘束)")),
    ("不適用", re.compile(r"不適用")),
    ("免計／免設", re.compile(r"(得不計入|(?<!包括)(?<!包含)(?<!併計)(?<!合併)不計入|免計|得免|免予|免辦|免設|免附|免檢討)")),
    ("另有規定", re.compile(r"另有規定者?，?從其規定")),
]
KUAN = re.compile(r"^\s*([一二三四五六七八九十]+)、")
MU = re.compile(r"^\s*[（(]([一二三四五六七八九十]+)[）)]")


def exceptions_of(text):
    """但書、除外、免除 sentences with their 項／款／目 position."""
    out = []
    lines = [l for l in text.split("\n") if l.strip()]
    para_count = sum(1 for l in lines if not KUAN.match(l) and not MU.match(l))
    para, kuan, mu = 0, None, None
    for line in lines:
        if KUAN.match(line):
            kuan, mu = KUAN.match(line).group(1), None
        elif MU.match(line):
            mu = MU.match(line).group(1)
        else:
            para, kuan, mu = para + 1, None, None
        for sentence in re.split(r"(?<=。)", line):
            kinds = []
            for k, rx in EXC_RULES:
                if rx.search(sentence) and k not in kinds:
                    kinds.append(k)
            if kinds:
                where = (f"第{para}項" if para_count > 1 else "") + (f"第{kuan}款" if kuan else "") + (f"第{mu}目" if mu else "")
                out.append((where, kinds, re.sub(r"\s+", " ", sentence.strip())))
    return out


CNNUM = "[一二三四五六七八九十百零〇]+(?:條之[一二三四五六七八九十]+)?"
SELF_REF = re.compile(f"(本編|本規則|本辦法|本細則|本條例|本標準|本準則|本法)((?:第{CNNUM}條(?:[至、及或與]|規定)?)+)")


def self_ref_words(name):
    for suffix, words in (("編", ["本編", "本規則"]), ("施行細則", ["本細則"]), ("辦法", ["本辦法"]), ("規則", ["本規則"]),
                          ("條例", ["本條例"]), ("標準", ["本標準"]), ("準則", ["本準則"]), ("法", ["本法"])):
        if name.endswith(suffix):
            return words
    return []


def is_deleted(art):
    return bool(re.match(r"^\s*[（(]?\s*刪除", art["text"]))


def ref_targets(chain):
    out = []
    for to, num in re.findall(f"(至)?第({CNNUM})條", chain):
        try:
            no = "-".join(str(cn2int(x)) for x in re.split("條之", num))
        except ValueError:
            continue
        if to and out and "-" not in no and "-" not in out[-1]:
            out += [str(i) for i in range(int(out[-1]) + 1, int(no))]
        out.append(no)
    return out


def broken_refs(law, only=None):
    """Articles of this law that cite deleted or missing articles of the same law."""
    words = self_ref_words(law["name"])
    if not words:
        return []
    by_no = {norm_no(a["no"]): a for a in law["articles"]}
    out = []
    for a in law["articles"]:
        if only and norm_no(a["no"]) != norm_no(only):
            continue
        if is_deleted(a):
            continue
        for m in SELF_REF.finditer(a["text"]):
            if m.group(1) not in words:
                continue
            for no in ref_targets(m.group(2)):
                t = by_no.get(no)
                label = f"{m.group(1)}第 {no} 條"
                if t is None:
                    out.append((a["no"], label, "不存在"))
                elif is_deleted(t):
                    out.append((a["no"], label, "已刪除"))
    return out


def invalid_notes(law, only=None):
    out = []
    for a in law["articles"]:
        if only and norm_no(a["no"]) != norm_no(only):
            continue
        m = re.search(r"[（(]註[：:][^）)]*無效[^）)]*[）)]", a["text"]) or re.search(r"[^。\n]*函告[^。\n]*無效[^。\n]*", a["text"])
        if m:
            out.append((a["no"], re.sub(r"\s+", " ", m.group(0))))
    return out


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
    if not law.get("articles") and law["id"] in doc_ids():
        hint = "（例：OL doc 無障礙規範 805）" if law["id"] in (manifest().get("documentReaders") or {}) else ""
        print(f"這部是原文文件（PDF／HTML），沒有逐條條文。請用 OL doc-search 搜尋，或 OL doc 讀節號／頁碼{hint}。")
        return
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
        att = article_attachments(law, art)
        text = clean(art["text"], law)
        if att:  # local laws inline a bare "圖表附件：x.pdf" line; replace it with real links
            text = re.sub(r"\n?圖表附件：[^\n]*", "", text)
        print(text)
        for f in att[:8]:
            print(f"圖表附件：{f.get('title')}　{f.get('url')}")
        if len(att) > 8:
            print(f"（另有 {len(att) - 8} 個附件，請看官方來源）")
        if not att and re.search(r"附[表圖]", art["text"]):
            print("（條文提到附表／附圖，但本庫沒有對應的附件連結，請開官方來源查看）")
        exc = exceptions_of(clean(art["text"], law))
        if exc:
            print(f"【例外與但書】{len(exc)} 處（適用前要逐一確認是否符合）")
            for where, kinds, t in exc[:12]:
                print(f"  ・{where + '：' if where else ''}[{'、'.join(kinds)}] {t[:160] + '…' if len(t) > 160 else t}")
            if len(exc) > 12:
                print(f"  …另有 {len(exc) - 12} 處")
        for _, label, problem in broken_refs(law, art["no"]):
            print(f"⚠ 本條引用的「{label}」{problem}，請查證現行適用規定")
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
        print("  " + law_link(law["id"], art.get("anchor")))
    if len(hits) > a.limit:
        print(f"\n…還有 {len(hits) - a.limit} 條，加 --limit 或縮小關鍵字。")
    if not hits and not a.any:
        print("沒有全部關鍵字都符合的條文，可以加 --any 改成任一關鍵字符合，或換同義詞。")
    if not hits:
        print("無障礙設施設計規範、耐震設計規範、綠建築各項技術規範等是原文文件，請改用 OL doc-search。")


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
    out = []
    for r in rs:
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
        out.append(r)
    out.sort(key=lambda r: r.get("date") or "", reverse=True)
    print(f"函釋符合：{len(out)} 則（依日期新到舊）")
    if not out:
        print("本庫只收國土署（原營建署）函釋彙編，不含經濟部、農業部、消防署及各縣市政府的函釋；查不到不代表沒有函釋。")
    for r in out[: a.limit]:
        print(f"\n■ [{r['id']}] {r.get('date') or '日期不明'}　{r.get('number') or '字號不明'}" + ("（由正文推得）" if r.get("headerFromBody") else ""))
        print(f"  {r.get('title', '')}")
        if r.get("refs"):
            print(f"  涉及：{ruling_refs(r)}")
        for n in ruling_warnings(r):
            print("  " + n)
        if r.get("body"):
            print("  " + snippet(r["body"], kws or [""], 60))
        print(f"  {r.get('url', '')}")


def cmd_ruling(a):
    for r in load_rulings():
        if str(r.get("id")) == str(a.id):
            print(f"{r.get('number') or '（字號不明）'}（{r.get('date') or '日期不明'}" + (f"，{r['unit']}" if r.get("unit") else "") + "）")
            if r.get("headerFromBody"):
                print("（原始資料缺字號與日期，以上是從正文推得，引用前請開原文確認）")
            print(r.get("title", ""))
            if r.get("refs"):
                print(f"涉及：{ruling_refs(r)}")
            for n in ruling_warnings(r):
                print(n)
            print("─" * 30)
            print(r.get("body") or "（本庫未收錄全文，請看原始連結）")
            print("─" * 30)
            print(f"來源：{r.get('url', '')}")
            return
    sys.exit(f"找不到函釋 {a.id}")


def cmd_conflicts(a):
    meta = resolve_law(a.law, a.region)
    law = load_law(meta["id"])
    only = a.article
    head = find_article(law, only)["no"] if only and find_article(law, only) else (only or "（全部條文）")
    print(f"衝突檢查：{law['name']} {head}")
    broken = broken_refs(law, only)
    print(f"\n【引用已刪除或不存在的條文】{len(broken)} 處")
    for frm, label, problem in broken[:30]:
        print(f"  {frm}：「{label}」{problem}")
    inv = invalid_notes(law, only)
    print(f"\n【經函告無效或部分無效的註記】{len(inv)} 處")
    for no, note in inv:
        print(f"  {no}：{note}")
    art_no = norm_no(only) if only else None
    linked = [r for r in load_rulings() if any(x.get("law") == law["id"] and (not art_no or (x.get("article") and norm_no(x["article"]) == art_no)) for x in r.get("refs") or [])]
    rev = revocations()
    revoked = [r for r in linked if str(r["id"]) in rev]
    print(f"\n【已被停止適用的函釋】{len(revoked)} 則（相關函釋共 {len(linked)} 則）")
    for r in revoked[:20]:
        by, partial = rev[str(r["id"])]
        print(f"  [{r['id']}] {r.get('date')} {r.get('number')} → {'部分' if partial else ''}停止適用，依 [{by['id']}] {by.get('date')} {by.get('number')}")
    stale = []
    for r in linked:
        for x in r.get("refs") or []:
            if x.get("law") != law["id"] or not x.get("article") or (art_no and norm_no(x["article"]) != art_no):
                continue
            d = article_amended(law, x["article"])
            if d and r.get("date") and r["date"] < d:
                stale.append((r, x["article"], d))
                break
    print(f"\n【早於條文修正的函釋】{len(stale)} 則")
    for r, art, d in stale[:20]:
        print(f"  [{r['id']}] {r.get('date')} {r.get('number')}：{art}於 {d} 修正")
    print("\n說明：以上為自動比對結果，「停止適用」依函釋全文字句判斷，引用前請開原文確認。中央與地方規定的實質差異無法自動判斷。")


# ---------------------------------------------------------------- documents (PDF/HTML 原文文件，例如無障礙設施設計規範)

def doc_link(law_id, page=None):
    return f"{SITE}/laws/{law_id}.html" + (f"#document-page-{page}" if page else "")


def doc_ids():
    return list((manifest().get("documentTexts") or {}).keys())


def load_doc_text(law_id):
    return fetch_versioned(lambda: manifest()["documentTexts"][law_id])


def load_doc_reader(law_id):
    if law_id not in (manifest().get("documentReaders") or {}):
        return None
    return fetch_versioned(lambda: manifest()["documentReaders"][law_id])


def doc_units(law_id):
    """Searchable units: reader sections (ids such as 805) when available, else pages."""
    reader = load_doc_reader(law_id)
    if reader:
        out = []
        for ch in reader.get("chapters") or []:
            if re.search("封面|目錄", ch["title"]):
                continue
            for sec in ch.get("sections") or []:
                out.append({"label": sec["title"], "chapter": ch["title"], "page": sec.get("startPage"), "text": sec.get("text") or "", "sec": sec})
        return out
    return [{"label": f"第 {p['page']} 頁", "chapter": "", "page": p["page"], "text": p.get("text") or "", "sec": None}
            for p in load_doc_text(law_id).get("pages") or []]


def resolve_document(q, region=None):
    ids = set(doc_ids())
    pool = [l for l in catalog()["laws"] if l["id"] in ids and (not region or l["region"] == region)]
    if q in ids:
        return next(l for l in catalog()["laws"] if l["id"] == q)
    target = aliases().get(q.lower(), aliases().get(q, q))
    for test in (lambda l: l["name"] == target, lambda l: target in l["name"],
                 lambda l: re.search(".*".join(map(re.escape, target)), l["name"])):
        cand = sorted([l for l in pool if test(l)], key=lambda l: (l["region"] != "中央", len(l["name"])))
        if cand:
            return cand[0]
    sys.exit(f"找不到原文文件「{q}」。可以不加 --doc，直接 doc-search 搜全部 {len(ids)} 份。")


def clause_of(text, want):
    """805.1 inside section 805: from its heading line to the next heading of the same or higher level.
    A heading is the number followed by a space or its CJK title, in the same section; wrapped
    cross-references such as 「207.3.2)。」「202.4者」「207節規定」 are not headings."""
    top = want.split(".")[0]

    def head(line):
        m = re.match(r"\s*(\d{3}(?:\.\d+)*)(?=[\s\u3400-\u9fff])(?![者之節條項款規及或與等公])", line)
        return m.group(1) if m and m.group(1).split(".")[0] == top else None

    lines = text.split("\n")
    start = next((i for i, l in enumerate(lines) if head(l) == want), None)
    if start is None:
        return None
    depth, end = want.count(".") + 1, len(lines)
    for i in range(start + 1, len(lines)):
        n = head(lines[i])
        if n and n != want and n.count(".") + 1 <= depth and not n.startswith(want + "."):
            end = i
            break
    return "\n".join(lines[start:end])


def unwrap_pdf(text):
    """Join PDF soft line breaks (keep breaks after 。： and before clause numbers, figures, tables)."""
    keep = re.compile(r"\s*(?:\d{3}(?:\.\d+)*(?=[\s\u3400-\u9fff])(?![\u8005\u4e4b\u7bc0\u689d\u9805\u6b3e\u898f\u53ca\u6216\u8207\u7b49\u516c])|[圖表]\s?\d|[一二三四五六七八九十]+、|（[一二三四五六七八九十]+）)")
    lines, out = text.split("\n"), ""
    for i, line in enumerate(lines):
        if i and (out.endswith(("。", "：")) or keep.match(line)):
            out += "\n"
        out += line
    return out


# ---------------------------------------------------------------- 附件表（自行抽出文字的官方 PDF 附表）

import unicodedata as _ud


def _nk(t):
    return re.sub(r"\s+", "", _ud.normalize("NFKC", str(t)))


def _att():
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "attachments.json"), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"docs": [], "lawId": "", "lawName": ""}


def _att_link(d):
    return f"https://law.moj.gov.tw/LawClass/LawGetFile.ashx?FileId={d['fileId']}"


def _att_header(A, d):
    law = load_law(A["lawId"])
    print(law_header(law))
    print(f"官方來源：{law.get('url', '')}")
    print(f"附表原檔：{d['title']}.PDF　{_att_link(d)}")
    print(f"（此附表文字由 PDF 自動抽出（{A.get('extractedAt')}，原檔 sha256 {d['sha'][:12]}…），不是 openlawtw 資料庫內容；表格欄位可能斷行，引用前請開原檔核對。）")
    if law.get("modified") and A.get("lawModified") and law["modified"] != A["lawModified"]:
        print(f"⚠ 法規最新修正日已變為 {law['modified']}，本附表抽出時法規為 {A['lawModified']}，附表可能已修正，請以原檔為準。")


def attachment_hits(ks, any_):
    A, out = _att(), []
    for d in A["docs"]:
        for u in d["units"]:
            hay = _nk(u["label"] + u["text"])
            matched = sum(1 for k in ks if _nk(k) in hay)
            if matched == len(ks) or (any_ and matched):
                out.append((matched, sum(hay.count(_nk(k)) for k in ks), d, u))
    return A, out


def show_attachment(doc, section):
    """Return True if handled."""
    m = re.search(r"附表([一二三四五])", f"{doc} {section or ''}")
    if not m:
        return False
    A = _att()
    law_q = re.sub(r"附表[一二三四五]\S*", "", doc).strip()
    if not law_q:
        return False
    try:
        law = resolve_law(law_q)
    except SystemExit:
        return False
    if law["id"] != A.get("lawId"):
        return False
    key = "附表" + m.group(1)
    d = next((x for x in A["docs"] if x["key"] == key), None)
    if not d:
        url = next((a["url"] for a in (load_law(law["id"]).get("attachments") or []) if a["title"].startswith(key)), "")
        print(f"{law['name']}{key}目前只有官方 PDF 連結，沒有抽出文字（矩陣表格抽出後欄位容易錯位，怕誤導，沒有收）。請開原檔：{url}")
        return True
    _att_header(A, d)
    sec = re.sub(r"附表[一二三四五]", "", section or "").lstrip("第").strip()
    print("─" * 30)
    if sec:
        u = next((x for x in d["units"] if _nk(x["id"]).upper() == _nk(sec).upper()), None)
        if not u:
            print(f"{key} 沒有「{sec}」。可用：{'、'.join(x['id'] for x in d['units'])}")
        else:
            print(u["label"] + "\n" + u["text"])
    elif len(d["units"]) == 1:
        print(d["units"][0]["text"])
    else:
        print(f"{d['title']}，可用節號讀：{'、'.join(x['id'] for x in d['units'])}")
    return True


def cmd_doc_search(a):
    kws = [k for k in a.keywords if k]
    ks = [re.sub(r"\s+", "", k) for k in kws]
    names = {l["id"]: l for l in catalog()["laws"]}
    ids = doc_ids()
    if not kws:
        readers = manifest().get("documentReaders") or {}
        regions = set(a.region.split(",")) if a.region else None
        docs = [names.get(i, {"id": i, "name": i, "region": ""}) for i in ids]
        docs = [l for l in docs if not regions or "全部" in regions or l["region"] in regions]
        docs.sort(key=lambda l: (l["region"] != "中央", l["region"], l["name"]))
        print(f"原文文件 {len(docs)} 份（給關鍵字就會搜尋內文）：")
        for l in docs:
            print(f"  {l['region']}｜{l['name']}　[{l['id']}]" + ("　可依節號讀" if l["id"] in readers else ""))
        A = _att()
        print(f"另有自行抽出文字的附表：{A.get('lawName')} {'、'.join(d['key'] for d in A['docs'])}（OL doc 變使 \"附表四 B-3\"）")
        return
    if a.doc:
        ids = [resolve_document(a.doc, a.region)["id"]]
    elif a.region:
        regions = set(a.region.split(","))
        ids = [i for i in ids if "全部" in regions or names.get(i, {}).get("region") in regions]
    hits = []
    for i in ids:
        try:
            units = doc_units(i)
        except Exception:
            continue
        for u in units:
            hay = re.sub(r"\s+", "", u["label"] + u["text"])  # PDF text is often letter-spaced
            matched = sum(1 for k in ks if k in hay)
            if matched == len(ks) or (a.any and matched):
                hits.append((matched, sum(hay.count(k) for k in ks), i, u, hay))
    hits.sort(key=lambda h: (-h[0], -h[1]))
    att_in = (not a.doc) or "附表" in a.doc or "變使" in a.doc or _att().get("lawName", "\0") in a.doc
    A, ahits = attachment_hits(kws, a.any) if att_in else (_att(), [])
    ahits.sort(key=lambda h: (-h[0], -h[1]))
    print(f"在 {len(ids)} 份原文文件" + (f"與 {len(A['docs'])} 張自行抽出文字的附表" if att_in else "") + f"搜尋「{' '.join(kws)}」：{len(hits) + len(ahits)} 處符合")
    for _, _, d, u in ahits[: a.limit]:
        print(f"\n■ {A['lawName']}　{u['label']}　[附表原檔 {_att_link(d)}]")
        print("  " + snippet(re.sub(r"\s+", "", u["text"]), kws))
        print(f"  用 OL doc 變使 \"{d['key']} {u['id']}\" 讀全文；此為 PDF 抽出文字，引用前請開原檔核對。")
    for _, _, i, u, hay in hits[: a.limit]:
        sec = u["sec"]["id"] if u["sec"] else ""
        print(f"\n■ {names.get(i, {}).get('name', i)}　{u['label']}" + (f"（{u['chapter']}）" if u["chapter"] else "")
              + f"　PDF 第 {u['page']} 頁　[{i}{' / ' + sec if sec else ''}]")
        print("  " + snippet(hay[len(re.sub(r'\s+', '', u['label'])):], ks))
        print("  " + doc_link(i, u["page"]))
    if len(hits) > a.limit:
        print(f"\n…還有 {len(hits) - a.limit} 處，加 --limit 或增加關鍵字。")
    if hits:
        print("\n用 doc 讀全文：OL doc 無障礙規範 805（節號）或 OL doc <文件> --page 12。")
    elif not a.any and not ahits:
        print("沒有全部關鍵字都符合的段落，可以加 --any 或換同義詞。")


def cmd_doc(a):
    if show_attachment(a.doc, a.section):
        return
    meta = resolve_document(a.doc, a.region)
    law = load_law(meta["id"])
    print(law_header(law))
    print(f"官方來源：{law.get('url', '')}")
    for f in (law.get("attachments") or [])[:3]:
        print(f"原檔：{f.get('title')}　{f.get('url')}")
    print("（本文件為官方 PDF／HTML 原文擷取的文字；圖、表、公式請以原檔為準。）")
    reader = load_doc_reader(meta["id"])
    cap = lambda t: t if len(t) <= 6000 else t[:6000] + "\n…（內容過長已截斷，請開連結看全文）"
    if a.section and reader:
        want = a.section.lstrip("第").strip()
        base = want.split(".")[0]
        for ch in reader.get("chapters") or []:
            for sec in ch.get("sections") or []:
                if sec["id"] not in (base, want) and not sec["title"].startswith(want):
                    continue
                body = clause_of(sec.get("text") or "", want) if "." in want else sec.get("text") or ""
                print("─" * 30)
                if not body:
                    print(f"{sec['title']} 裡找不到 {want}。")
                    return
                pages = f"{sec.get('startPage')}" + (f"–{sec['endPage']}" if sec.get("endPage") and sec["endPage"] != sec.get("startPage") else "")
                print(f"{law['name']}　{want if '.' in want else sec['title']}［{ch['title']}］　PDF 第 {pages} 頁")
                print(cap(body))
                exc = exceptions_of(unwrap_pdf(body))
                if exc:
                    print(f"【例外與但書】{len(exc)} 處（適用前要逐一確認是否符合）")
                    for _, kinds, t in exc[:10]:
                        print(f"  ・[{'、'.join(kinds)}] {t[:160] + '…' if len(t) > 160 else t}")
                print(f"連結：{doc_link(law['id'], sec.get('startPage'))}")
                return
        print("─" * 30 + f"\n找不到節號「{a.section}」。不填節號可以看目錄。")
        return
    if a.page:
        pages = load_doc_text(meta["id"]).get("pages") or []
        p = next((x for x in pages if x["page"] == a.page), None)
        print("─" * 30)
        if not p:
            print(f"沒有第 {a.page} 頁（共 {len(pages)} 頁）。")
            return
        print(f"{law['name']}　PDF 第 {p['page']} 頁\n{cap(p.get('text') or '')}\n連結：{doc_link(law['id'], p['page'])}")
        return
    print("─" * 30)
    if reader:
        print("目錄（OL doc <文件> <節號> 讀全文）：")
        for ch in reader.get("chapters") or []:
            if re.search("封面|目錄", ch["title"]):
                continue
            print(f"{ch['title']}（PDF {ch.get('startPage')}–{ch.get('endPage')} 頁）")
            for sec in ch.get("sections") or []:
                print(f"  {sec['title']}　p.{sec.get('startPage')}")
        return
    pages = load_doc_text(meta["id"]).get("pages") or []
    print(f"共 {len(pages)} 頁（加 --page N 讀全文）：")
    for p in pages[:40]:
        print(f"  第 {p['page']} 頁：{re.sub(r'\s+', ' ', p.get('text') or '')[:50]}")
    print(f"連結：{doc_link(law['id'])}")


def cmd_info(a):
    m, c = manifest(), catalog()
    print(f"openlawtw 資料版本 {m.get('release')}，收錄 {len(m['laws'])} 部法規、{len(load_rulings())} 則函釋")
    print(f"原文文件 {len(m.get('documentTexts') or {})} 份（PDF／HTML，用 doc-search、doc 查），其中建築物無障礙設施設計規範可依節號查詢")
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
    s = sub.add_parser("conflicts"); s.add_argument("law"); s.add_argument("article", nargs="?")
    s.add_argument("--region"); s.set_defaults(f=cmd_conflicts)
    s = sub.add_parser("doc-search"); s.add_argument("keywords", nargs="*")
    s.add_argument("--doc", help="限定文件（名稱、簡稱或 ID）"); s.add_argument("--region")
    s.add_argument("--limit", type=int, default=10); s.add_argument("--any", action="store_true")
    s.set_defaults(f=cmd_doc_search)
    s = sub.add_parser("doc"); s.add_argument("doc"); s.add_argument("section", nargs="?")
    s.add_argument("--page", type=int); s.add_argument("--region"); s.set_defaults(f=cmd_doc)
    s = sub.add_parser("info"); s.set_defaults(f=cmd_info)

    a = p.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    a.f(a)


if __name__ == "__main__":
    main()
