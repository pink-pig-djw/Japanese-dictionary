#!/usr/bin/env python3
"""Chinese-gloss workflow: hand out batches of untranslated words, then check and merge the results.

    python3 tools/zh.py status
    python3 tools/zh.py next  [--n 100] [--from RANK] [--to RANK] [--out FILE]
    python3 tools/zh.py merge FILE [FILE ...]
    python3 tools/zh.py check

"RANK" is a word's position in the dictionary (0 = most common word).  Words are
translated most-common-first, so stopping at any point leaves the useful part done.

`next` writes a batch like

    [{"id": 1358280, "word": "食べる", "reading": "たべる",
      "senses": [{"pos": "一段动词, 他动词", "en": "to eat"},
                 {"pos": "一段动词, 他动词", "en": "to live on (e.g. a salary); to live off; to subsist on"}]}]

The translator answers with ONE JSON object: word id -> one Chinese string per
sense, same order, same count:

    {"1358280": ["吃", "靠…生活；以…为生"]}

`merge` validates every entry and only writes the valid ones into
data/zh/zNNN.json (one file per word chunk) and refreshes data/zh/index.json.
Nothing here needs the network or the original database.
"""
import argparse
import fcntl
import glob
import json
import os
import re
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
ZH = os.path.join(DATA, "zh")
CJK = re.compile(r"[㐀-鿿]")
KANA = re.compile(r"[ぁ-ゖァ-ヺ]")
MAX_LEN = 120

# short Chinese labels for the part-of-speech hints shown to the translator
POS_ZH = [
    (r"^noun \(common\)", "名词"), (r"^adjectival nouns", "な形容词"), (r"^adjective \(keiyoushi\)", "い形容词"),
    (r"genitive case particle 'no'", "の形容词"), (r"^adverb", "副词"), (r"takes the aux\. verb suru", "する动词"),
    (r"^Ichidan", "一段动词"), (r"^Godan", "五段动词"), (r"^suru verb", "サ变动词"), (r"^Kuru verb", "カ变动词"),
    (r"^transitive", "他动词"), (r"^intransitive", "自动词"), (r"^expressions", "惯用表达"), (r"^interjection", "感叹词"),
    (r"^conjunction", "接续词"), (r"^particle", "助词"), (r"^pronoun", "代词"), (r"^counter", "量词"),
    (r"^prefix|used as a prefix", "接头词"), (r"^suffix|used as a suffix", "接尾词"), (r"^auxiliary", "助动词"),
    (r"^numeric", "数词"), (r"^pre-noun", "连体词"), (r"'taru'", "たる形容词"), (r"verb", "动词"), (r"adjective", "形容词"),
]
TAG_ZH = {
    "word usually written using kana alone": "通常写假名", "abbreviation": "缩略语", "archaism": "古语",
    "colloquialism": "口语", "slang": "俚语", "honorific or respectful (sonkeigo) language": "尊敬语",
    "humble (kenjougo) language": "谦让语", "polite (teineigo) language": "郑重语", "derogatory": "贬义",
    "vulgar expression or word": "粗俗语", "onomatopoeic or mimetic word": "拟声拟态词", "proverb": "谚语",
    "idiomatic expression": "惯用语", "yojijukugo": "四字熟语", "children's language": "儿童用语",
    "female term or language": "女性用语", "male term or language": "男性用语", "Internet slang": "网络用语",
}


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def dump_json(obj, path):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    os.replace(tmp, path)


def zh_path(chunk):
    return os.path.join(ZH, f"z{chunk:03d}.json")


def load_zh(chunk):
    path = zh_path(chunk)
    return load_json(path) if os.path.exists(path) else {}


def iter_words(meta, first=0, last=None):
    """Yield (rank, chunk, entry) in dictionary order."""
    size = meta["chunkSize"]
    last = meta["words"] if last is None else min(last, meta["words"])
    for chunk in range(first // size, meta["chunks"]):
        if chunk * size >= last:
            return
        for n, entry in enumerate(load_json(os.path.join(DATA, "words", f"w{chunk:03d}.json"))):
            rank = chunk * size + n
            if first <= rank < last:
                yield rank, chunk, entry


def pos_label(tags, entry_tags):
    out = []
    for t in entry_tags:
        text = tags[t]
        for pattern, zh in POS_ZH:
            if re.search(pattern, text):
                if zh not in out:
                    out.append(zh)
                break
    return ", ".join(out)


def write_index(meta):
    chunks, entries, senses = [], 0, 0
    for chunk in range(meta["chunks"]):
        zh = load_zh(chunk)
        if zh:
            chunks.append(chunk)
            entries += len(zh)
            senses += sum(len(v) for v in zh.values())
    # "v" names the browser cache for the translations; any change must change it
    dump_json({"chunks": chunks, "entries": entries, "senses": senses, "v": f"{entries}-{senses}"},
              os.path.join(ZH, "index.json"))
    return entries, senses


def validate(entry, value):
    """Return an error string, or None when `value` is a good translation of `entry`."""
    if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
        return "must be a list of strings"
    if len(value) != len(entry["s"]):
        return f"has {len(value)} items but the word has {len(entry['s'])} senses"
    for n, text in enumerate(value, 1):
        t = text.strip()
        if not t:
            return f"sense {n} is empty"
        if "\n" in t or "\t" in t:
            return f"sense {n} contains a line break or tab"
        if len(t) > MAX_LEN:
            return f"sense {n} is longer than {MAX_LEN} characters"
        if not CJK.search(t):
            return f"sense {n} has no Chinese characters: {t!r}"
        if KANA.search(re.sub(r"「[^」]*」", "", t)):
            return f"sense {n} contains Japanese kana outside 「」 (write Chinese): {t!r}"
    return None


def cmd_status(meta, _args):
    os.makedirs(ZH, exist_ok=True)
    entries, senses = write_index(meta)
    print(f"translated {entries} / {meta['words']} words ({entries / meta['words']:.1%}), {senses} senses")
    size = meta["chunkSize"]
    for chunk in range(meta["chunks"]):
        done = len(load_zh(chunk))
        total = min(size, meta["words"] - chunk * size)
        if done or chunk < 3:
            print(f"  chunk {chunk:03d}  ranks {chunk * size:>6}-{chunk * size + total - 1:<6}  {done:>4}/{total}")
    for rank, chunk, entry in iter_words(meta):
        if str(entry["i"]) not in load_zh_cached(chunk):
            print(f"next untranslated word is rank {rank}")
            break


_zh_cache = {}


def load_zh_cached(chunk):
    if chunk not in _zh_cache:
        _zh_cache[chunk] = load_zh(chunk)
    return _zh_cache[chunk]


def cmd_next(meta, args):
    tags = meta["tags"]
    batch = []
    for rank, chunk, entry in iter_words(meta, args.first, args.to):
        if str(entry["i"]) in load_zh_cached(chunk):
            continue
        senses = []
        for s in entry["s"]:
            item = {}
            pos = pos_label(tags, s.get("p", []))
            if pos:
                item["pos"] = pos
            item["en"] = "; ".join(s["g"])
            notes = [TAG_ZH[tags[t]] for t in s.get("m", []) if tags[t] in TAG_ZH]
            notes += [tags[t] for t in s.get("f", [])]
            if notes:
                item["tags"] = ", ".join(notes)
            if "n" in s:
                item["note"] = s["n"]
            senses.append(item)
        batch.append({"id": entry["i"], "rank": rank, "word": (entry.get("k") or entry["r"])[0],
                      "reading": entry["r"][0], "senses": senses})
        if len(batch) >= args.n:
            break
    text = json.dumps(batch, ensure_ascii=False, indent=1)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
        n_senses = sum(len(b["senses"]) for b in batch)
        span = f"ranks {batch[0]['rank']}-{batch[-1]['rank']}" if batch else "nothing left in this range"
        print(f"wrote {len(batch)} words / {n_senses} senses to {args.out} ({span})")
    else:
        print(text)


def cmd_merge(meta, args):
    os.makedirs(ZH, exist_ok=True)
    where = {}
    for _rank, chunk, entry in iter_words(meta):
        where[str(entry["i"])] = (chunk, entry)
    good, bad = {}, []
    for path in args.files:
        try:
            data = load_json(path)
        except (OSError, ValueError) as err:
            bad.append(f"{path}: not valid JSON ({err})")
            continue
        if not isinstance(data, dict):
            bad.append(f"{path}: top level must be an object {{id: [translations]}}")
            continue
        for key, value in data.items():
            if key not in where:
                bad.append(f"{path}: {key}: no such word id")
                continue
            chunk, entry = where[key]
            err = validate(entry, value)
            if err:
                bad.append(f"{path}: {key} ({(entry.get('k') or entry['r'])[0]}): {err}")
            else:
                good.setdefault(chunk, {})[key] = [x.strip() for x in value]
    with open(os.path.join(ZH, ".lock"), "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)   # several translators may merge at once
        added = 0
        for chunk, items in good.items():
            current = load_zh(chunk)
            added += sum(1 for k in items if k not in current)
            current.update(items)
            order = {str(e["i"]): n for n, e in enumerate(load_json(os.path.join(DATA, "words", f"w{chunk:03d}.json")))}
            dump_json({k: current[k] for k in sorted(current, key=order.get)}, zh_path(chunk))
        entries, _ = write_index(meta)
    print(f"merged {sum(len(v) for v in good.values())} words ({added} new); total {entries} / {meta['words']}")
    if bad:
        print(f"\n{len(bad)} REJECTED - fix these and merge again:")
        for line in bad:
            print("  " + line)
        sys.exit(1)


def cmd_check(meta, _args):
    where = {str(e["i"]): e for _r, _c, e in iter_words(meta)}
    bad = 0
    for path in sorted(glob.glob(os.path.join(ZH, "z*.json"))):
        for key, value in load_json(path).items():
            err = "no such word id" if key not in where else validate(where[key], value)
            if err:
                bad += 1
                print(f"{os.path.basename(path)}: {key}: {err}")
    entries, senses = write_index(meta)
    print(f"{entries} words / {senses} senses translated, {bad} problems")
    sys.exit(1 if bad else 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    nx = sub.add_parser("next")
    nx.add_argument("--n", type=int, default=100, help="words per batch (default 100)")
    nx.add_argument("--from", dest="first", type=int, default=0, help="first rank to consider")
    nx.add_argument("--to", type=int, default=None, help="stop before this rank")
    nx.add_argument("--out", help="write the batch to this file instead of printing it")
    mg = sub.add_parser("merge")
    mg.add_argument("files", nargs="+")
    sub.add_parser("check")
    args = ap.parse_args()
    meta = load_json(os.path.join(DATA, "meta.json"))
    {"status": cmd_status, "next": cmd_next, "merge": cmd_merge, "check": cmd_check}[args.cmd](meta, args)


if __name__ == "__main__":
    main()
