# 樱花日语词典

Static, mobile-first Japanese dictionary (Chinese UI). No build step, no dependencies:
open `index.html` through any static server.

```bash
python3 -m http.server 8765
```

## Layout

- `index.html`, `css/style.css` – page shell and all styling (light/dark via `light-dark()`).
- `js/app.js` – hash router and every page (search, word, kanji, kana, word book, settings).
- `js/worker.js` – loads `data/words/*.json` in the background and answers searches.
- `js/jp.js` – romaji→kana, de-inflection, conjugation (shared by page and worker).
- `js/tags.js` – Chinese labels for JMdict tags. `js/mascot.js` – mascot slot (see `docs/MASCOT_PROMPTS.md`).
- `data/` – generated dictionary data. `tools/build_data.py` regenerates it (format documented there).
- `data/zh/` – Chinese glosses, added incrementally with `tools/zh.py`.

## Translating glosses to Chinese (the main ongoing task)

Follow `docs/TRANSLATION.md` exactly. Loop:

```bash
python3 tools/zh.py next --n 100 --out /tmp/batch.json
```

Write `{"<id>": ["中文义项1", "中文义项2"]}` to `/tmp/done.json`, then:

```bash
python3 tools/zh.py merge /tmp/done.json
```

Fix anything listed under `REJECTED` and merge again. Commit `data/zh` every few batches.
Never edit `data/words/` or rebuild the data while translations exist unless the source
database is unchanged: translations are keyed by word id but stored per chunk.

## Conventions

- Japanese text needs `lang="ja"` so phones with a Chinese locale pick Japanese glyphs.
- Touch targets ≥ 44px; check pages at 320px width for horizontal overflow.
- Verify UI changes in a real browser (Playwright is preinstalled) in both light and dark schemes.
- Data is JMdict/KANJIDIC2 (CC BY-SA 4.0, EDRDG); keep the attribution in 设置 → 关于 and README.
