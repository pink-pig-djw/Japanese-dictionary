#!/usr/bin/env python3
"""Build the static dictionary data in data/ from the jamdict SQLite database.

The database bundles JMdict (words) and KANJIDIC2 (kanji), both (c) EDRDG,
licensed CC BY-SA 4.0.  Get it with:

    pip download --no-deps --no-binary :all: jamdict-data
    tar xzf jamdict_data-*.tar.gz && xz -d jamdict_data-*/jamdict_data/jamdict.db.xz

Usage:  python3 tools/build_data.py path/to/jamdict.db

Output
    data/words/wNNN.json  word entries, sorted most-common-first, CHUNK per file
    data/kanji.json       kanji table
    data/meta.json        chunk count, tag table, counts

Word entry (keys omitted when empty):
    i  JMdict sequence id            c  1 = common word
    k  kanji spellings               r  kana readings
    ki {index: tag}  spelling notes  ri {index: tag}  reading notes
    rr {index: [kanji]} reading applies only to these spellings
    s  senses, each:
       p part-of-speech tags   g English glosses    m usage tags
       f field tags            d dialect tags       n free-text note
       x cross references      a antonyms           o "only for" forms
       l loanword sources [[lang, word, wasei]]
Tags are indexes into meta.json "tags".

IMPORTANT: entry order defines which chunk an entry lives in, and the Chinese
translations in data/zh/ are stored per chunk.  The order is deterministic for
a given database, so rebuilding from the same jamdict.db is safe.
"""
import hashlib
import json
import os
import sqlite3
import sys
from collections import defaultdict

CHUNK = 4000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data")
COMMON = {"news1", "ichi1", "spec1", "spec2", "gai1"}


def dump(obj, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def group(cur, sql):
    d = defaultdict(list)
    for row in cur.execute(sql):
        d[row[0]].append(row[1] if len(row) == 2 else row[1:])
    return d


def prio_score(tags):
    best = 99
    for t in tags:
        if t.startswith("nf"):
            best = min(best, int(t[2:]))
        elif t == "ichi1":  # basic vocabulary: rank with the top news words
            best = min(best, 6)
        elif t == "spec1":
            best = min(best, 20)
        elif t == "news1":
            best = min(best, 49)
        elif t in ("spec2", "gai1"):
            best = min(best, 55)
        elif t in ("news2", "ichi2"):
            best = min(best, 60)
    return best


def build_words(c):
    tags, tag_ix = [], {}

    def tag(t):
        if t not in tag_ix:
            tag_ix[t] = len(tags)
            tags.append(t)
        return tag_ix[t]

    kanji = group(c, "select idseq, ID, text from Kanji order by ID")
    kana = group(c, "select idseq, ID, text from Kana order by ID")
    senses = group(c, "select idseq, ID from Sense order by ID")
    kji = group(c, "select kid, text from KJI")
    kjp = group(c, "select kid, text from KJP")
    kni = group(c, "select kid, text from KNI")
    knp = group(c, "select kid, text from KNP")
    knr = group(c, "select kid, text from KNR")
    sub = {
        name: group(c, f"select sid, text from {table}")
        for name, table in [
            ("p", "pos"), ("m", "misc"), ("f", "field"), ("d", "dialect"),
            ("x", "xref"), ("a", "antonym"), ("n", "SenseInfo"),
            ("sk", "stagk"), ("sr", "stagr"),
        ]
    }
    gloss = group(c, "select sid, text from SenseGloss order by rowid")
    lsrc = group(c, "select sid, lang, text, wasei from SenseSource order by rowid")

    entries = []
    for (idseq,) in c.execute("select idseq from Entry order by idseq").fetchall():
        e = {"i": idseq}
        prios = []
        ks = kanji.get(idseq, [])
        rs = kana.get(idseq, [])
        if ks:
            e["k"] = [t for _, t in ks]
            ki = {str(n): tag(kji[kid][0]) for n, (kid, _) in enumerate(ks) if kid in kji}
            if ki:
                e["ki"] = ki
            for kid, _ in ks:
                prios += kjp.get(kid, [])
        e["r"] = [t for _, t in rs]
        ri = {str(n): tag(kni[kid][0]) for n, (kid, _) in enumerate(rs) if kid in kni}
        if ri:
            e["ri"] = ri
        rr = {str(n): knr[kid] for n, (kid, _) in enumerate(rs) if kid in knr}
        if rr:
            e["rr"] = rr
        for kid, _ in rs:
            prios += knp.get(kid, [])
        if COMMON & set(prios):
            e["c"] = 1

        out, last_pos = [], []
        for sid in senses.get(idseq, []):
            g = gloss.get(sid, [])
            if not g:
                continue
            s = {}
            pos = [tag(t) for t in sub["p"].get(sid, [])] or last_pos
            last_pos = pos
            if pos:
                s["p"] = pos
            s["g"] = g
            for key in ("m", "f", "d"):
                if sid in sub[key]:
                    s[key] = [tag(t) for t in sub[key][sid]]
            if sid in sub["n"]:
                s["n"] = "; ".join(sub["n"][sid])
            for key in ("x", "a"):
                if sid in sub[key]:
                    s[key] = sub[key][sid]
            only = sub["sk"].get(sid, []) + sub["sr"].get(sid, [])
            if only:
                s["o"] = only
            if sid in lsrc:
                s["l"] = [[lang, text, 1 if wasei else 0] for lang, text, wasei in lsrc[sid]]
            out.append(s)
        if not out or not e["r"]:
            continue
        e["s"] = out
        entries.append((prio_score(prios), 0 if "c" in e else 1, idseq, e))

    entries.sort(key=lambda t: t[:3])
    entries = [t[3] for t in entries]
    wdir = os.path.join(OUT, "words")
    os.makedirs(wdir, exist_ok=True)
    for old in os.listdir(wdir):
        os.remove(os.path.join(wdir, old))
    n_chunks = 0
    digest = hashlib.sha1()
    for n in range(0, len(entries), CHUNK):
        path = os.path.join(wdir, f"w{n_chunks:03d}.json")
        dump(entries[n:n + CHUNK], path)
        with open(path, "rb") as f:
            digest.update(f.read())
        n_chunks += 1
    # "build" names the browser cache: it changes whenever any chunk changes
    return tags, len(entries), n_chunks, sum(1 for e in entries if "c" in e), digest.hexdigest()[:12]


def build_kanji(c):
    on, kun, pinyin = defaultdict(list), defaultdict(list), defaultdict(list)
    for cid, rtype, value in c.execute(
            "select g.cid, r.r_type, r.value from reading r join rm_group g on g.ID = r.gid order by r.rowid"):
        {"ja_on": on, "ja_kun": kun, "pinyin": pinyin}.get(rtype, defaultdict(list))[cid].append(value)
    mean = group(c, "select g.cid, m.value from meaning m join rm_group g on g.ID = m.gid "
                    "where m.m_lang = '' order by m.rowid")
    nanori = group(c, "select cid, value from nanori order by rowid")
    rad = dict(c.execute("select cid, value from radical where rad_type = 'classical'"))
    out = {}
    for cid, lit, strokes, grade, freq, jlpt in c.execute(
            "select ID, literal, stroke_count, grade, freq, jlpt from character order by ID"):
        # s strokes, g school grade, j old JLPT level (4 easiest), f newspaper
        # frequency rank, b Kangxi radical number, o on, u kun, m meanings,
        # n name readings, p pinyin
        k = {"s": int(strokes or 0)}
        for key, val in (("g", grade), ("j", jlpt), ("f", freq), ("b", rad.get(cid))):
            if val:
                k[key] = int(val)
        for key, val in (("o", on.get(cid)), ("u", kun.get(cid)), ("m", mean.get(cid)),
                         ("n", nanori.get(cid)), ("p", pinyin.get(cid))):
            if val:
                k[key] = val
        out[lit] = k
    dump(out, os.path.join(OUT, "kanji.json"))
    return len(out)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    c = sqlite3.connect(sys.argv[1])
    os.makedirs(OUT, exist_ok=True)
    tags, n_words, n_chunks, n_common, build = build_words(c)
    n_kanji = build_kanji(c)
    info = dict(c.execute("select key, value from meta"))
    dump({
        "build": build, "chunks": n_chunks, "chunkSize": CHUNK, "words": n_words,
        "common": n_common, "kanji": n_kanji, "tags": tags,
        "jmdict": info.get("jmdict.version"), "jmdictDate": info.get("jmnedict.date"),
    }, os.path.join(OUT, "meta.json"))
    print(f"{n_words} words ({n_common} common) in {n_chunks} chunks, {n_kanji} kanji, {len(tags)} tags")


if __name__ == "__main__":
    main()
