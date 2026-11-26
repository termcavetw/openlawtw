# openlawtw skill — Taiwan building law for AI agents

Ask your AI agent about Taiwanese building codes and it will **look up the current article text before answering**, instead of making up article numbers.

```
You:    緊急用昇降機的機間在避難層可以開兩個出入口嗎？
Agent:  ▸ openlaw.py article 設計施工編 107
        ▸ openlaw.py rulings --law 設計施工編 --article 107
        No. 建築技術規則建築設計施工編 §107(1)(iii) limits the lobby to one
        fire-door entrance (except toward a special escape stair), and the
        2019 ruling 營署建管字第1081051682號 confirms this applies on the
        refuge floor too. [links to both]
```

This skill runs on top of **[openlawtw](https://law.termcavetw.com)**, an open database of Taiwanese building, planning and land-use law:

- **1,000+ laws**: central government plus all 22 cities and counties, split article by article
- **8,700+ rulings (函釋)** from the National Land Management Agency, linked to the articles they interpret
- **Synced weekly** with 全國法規資料庫 and local government law portals

## What it does

| | |
|---|---|
| `article 設計施工編 107` | Exact article text, chapter path, effective-date notes, official link |
| `search 緊急用昇降機 避難層` | Full-text search across all articles (central or any city) |
| `rulings --law 設計施工編 --article 107` | Rulings linked to that article, newest first |
| `rulings 農舍 解除套繪` | Keyword search across rulings |
| `conflicts 設計施工編` | Deleted references, void notes, revoked and stale rulings |
| `toc 建築法` | Chapter outline of a law |

Common short names work too: 建技, 設計施工編, 變使, 室裝, 危老, 非都管制, 無障礙規範…

It also flags what makes a citation unsafe: rulings **revoked** by a later ruling, rulings **older than the latest amendment** of the article they interpret, articles that **cite deleted articles**, "declared void" notes, and it lists each article's **exceptions and provisos** (但書、除外、免計). Prefer the [openlawtw MCP server](https://openlawtw-mcp.vercel.app) if your client supports MCP; the skill uses it automatically when its tools are available.

The skill also sets ground rules for the agent: never cite from memory, quote the key sentence, link every source, flag repealed or not-yet-effective provisions, and check local rules when a city is involved.

## Install

The skill is one folder: `SKILL.md` plus `scripts/openlaw.py` (Python 3 standard library only, no dependencies).

**Claude Code**

```bash
git clone --depth 1 https://github.com/termcavetw/openlawtw /tmp/openlawtw
cp -r /tmp/openlawtw/skill/openlawtw ~/.claude/skills/
```

**Claude (web / desktop / mobile)**: download `openlawtw-skill.zip` from Releases and upload it in Claude's skills settings.

**Other agents**: any agent that can run Python can use it. Point it to `SKILL.md`.

## Offline use

The script fetches data from law.termcavetw.com (falling back to GitHub mirrors) and caches it in `~/.cache/openlawtw`. To work fully offline, clone this repo and set:

```bash
export OPENLAW_DATA=/path/to/openlawtw
```

## Limits

- Tables and figures attached to articles are PDFs and are not in the text. The script tells you when one exists.
- Rulings cover the national agency's compilation only, not city-level rulings.
- This is a lookup tool, not legal advice. For a specific case, the competent building authority's decision is what counts.

---

## 中文說明

讓 Claude、Codex 等 AI 助理回答臺灣建築法規問題時，**先查 openlawtw 的現行條文和函釋再回答**，附上條號、原文和連結，不再亂編條號。

收錄中央與 22 縣市共 1,000 多部建築、都市計畫、土地使用相關法規，以及 8,700 多則國土署函釋，每週同步。

安裝方式見上方 Install。有問題或想要加哪些法規，歡迎開 issue，或到 Threads 找 [@termcavetw](https://www.threads.net/@termcavetw)。

Data license: see [DATA_LICENSE.md](../../DATA_LICENSE.md). Code: same license as this repository.
