/* Search worker: loads the word chunks in the background and answers queries.
 * Messages in:  {id, op, ...}    out: {id, result} | {event: 'progress'|'ready'|'error', ...} */
'use strict';
importScripts('jp.js');

const DATA = '../data/';
const entries = [];            // rank order (most common first)
const byId = new Map();        // JMdict id -> index in entries
const byForm = new Map();      // exact spelling / reading (hiragana) -> [index]
let meta = null;
let tags = [];
let loadedChunks = 0;
let done = false;
let zhInfo = { chunks: [], v: 0 };
const waiters = [];

// ---------- loading ----------
async function cachedJson(url, cacheName) {
  let cache = null;
  try { cache = await caches.open(cacheName); } catch (e) { /* no Cache API (http / private mode) */ }
  if (cache) {
    const hit = await cache.match(url);
    if (hit) return hit.json();
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' ' + res.status);
  if (cache) { try { await cache.put(url, res.clone()); } catch (e) { /* quota */ } }
  return res.json();
}

async function freshJson(url, fallback) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (res.ok) return await res.json();
  } catch (e) { /* offline */ }
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (res.ok) return await res.json();
  } catch (e) { /* nothing cached */ }
  return fallback;
}

function addForm(text, idx) {
  const list = byForm.get(text);
  if (list) { if (list[list.length - 1] !== idx) list.push(idx); } else byForm.set(text, [idx]);
}

function ingest(chunk, zh) {
  for (const e of chunk) {
    const idx = entries.length;
    e._r = e.r.map(JP.toHiragana);
    let g = '';
    for (const s of e.s) g += s.g.join('\n').toLowerCase() + '\n';
    e._g = g;
    if (zh && zh[e.i]) { e.z = zh[e.i]; e._z = e.z.join('\n'); }
    entries.push(e);
    byId.set(e.i, idx);
    if (e.k) for (const k of e.k) addForm(k, idx);
    for (const r of e._r) addForm(r, idx);
  }
}

async function load() {
  meta = await freshJson(DATA + 'meta.json', null);
  if (!meta) throw new Error('meta.json');
  tags = meta.tags;
  zhInfo = await freshJson(DATA + 'zh/index.json', { chunks: [], v: 0 });
  const wordCache = 'words-' + (meta.build || meta.words);
  const zhCache = 'zh-' + (zhInfo.v || 0);
  try {
    for (const name of await caches.keys()) {
      if ((name.startsWith('words-') && name !== wordCache) || (name.startsWith('zh-') && name !== zhCache)) caches.delete(name);
    }
  } catch (e) { /* no Cache API */ }
  postMessage({ event: 'meta', meta: publicMeta() });

  const zhSet = new Set(zhInfo.chunks || []);
  const name = (p, n) => p + String(n).padStart(3, '0') + '.json';
  const fetchChunk = (n) => Promise.all([
    cachedJson(DATA + 'words/' + name('w', n), wordCache),
    zhSet.has(n) ? cachedJson(DATA + 'zh/' + name('z', n), zhCache).catch(() => null) : null,
  ]);
  const AHEAD = 4;
  const pending = new Map();
  let next = 0;
  for (let n = 0; n < meta.chunks; n++) {
    while (next < meta.chunks && pending.size < AHEAD) { pending.set(next, fetchChunk(next)); next++; }
    const [chunk, zh] = await pending.get(n);
    pending.delete(n);
    ingest(chunk, zh);
    loadedChunks = n + 1;
    postMessage({ event: 'progress', loaded: loadedChunks, total: meta.chunks, words: entries.length });
  }
  done = true;
  postMessage({ event: 'ready', words: entries.length });
  for (const w of waiters.splice(0)) w();
}

function publicMeta() {
  return {
    words: meta.words, common: meta.common, kanji: meta.kanji, chunks: meta.chunks,
    jmdict: meta.jmdict, jmdictDate: meta.jmdictDate, tags,
    zhEntries: zhInfo.entries || 0, zhSenses: zhInfo.senses || 0,
  };
}

const whenDone = () => (done ? Promise.resolve() : new Promise((r) => waiters.push(r)));

// ---------- helpers ----------
function pub(idx, why) {
  const e = entries[idx];
  const o = { i: e.i, r: e.r, s: e.s };
  for (const key of ['k', 'c', 'ki', 'ri', 'rr', 'z']) if (e[key] !== undefined) o[key] = e[key];
  if (why) o.why = why;
  return o;
}

function posStrings(e) {
  const out = [];
  for (const s of e.s) if (s.p) for (const t of s.p) out.push(tags[t]);
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- search ----------
function matchJapanese(q, qh, limitLevel) {
  // returns [[score, idx]]
  const out = [];
  for (let idx = 0; idx < entries.length; idx++) {
    const e = entries[idx];
    let best = 9, bestLen = 0;
    if (e.k) {
      for (const k of e.k) {
        if (k.length < q.length) continue;
        const lv = k === q ? 0 : k.startsWith(q) ? 1 : k.includes(q) ? 3 : 9;
        if (lv < best) { best = lv; bestLen = k.length; }
      }
    }
    for (const r of e._r) {
      if (r.length < qh.length) continue;
      const lv = r === qh ? 0 : r.startsWith(qh) ? 1 : r.includes(qh) ? 3 : 9;
      if (lv < best || (lv === best && r.length < bestLen)) { best = lv; bestLen = r.length; }
    }
    if (best > limitLevel) continue;
    out.push([best * 1e7 + (bestLen - q.length) * 4000 + idx, idx]);
  }
  return out;
}

function matchDeinflected(q) {
  const out = [];
  const seen = new Set();
  for (const cand of JP.deinflect(q)) {
    const list = byForm.get(cand.text) || byForm.get(JP.toHiragana(cand.text));
    if (!list) continue;
    for (const idx of list) {
      if (seen.has(idx)) continue;
      const pos = posStrings(entries[idx]);
      if (!JP.classMatches(JP.inflectionClass(pos), cand.type, pos)) continue;
      seen.add(idx);
      out.push([cand.steps * 1e6 + idx, idx, cand.text]);
    }
  }
  return out;
}

function matchGloss(q, field) {
  const out = [];
  const wordRe = new RegExp('(^|[^a-z0-9])' + escapeRe(q) + '($|[^a-z0-9])');
  for (let idx = 0; idx < entries.length; idx++) {
    const e = entries[idx];
    const hay = e[field];
    if (!hay || !hay.includes(q)) continue;
    let best = Infinity;
    const lists = field === '_z' ? e.z.map((t) => (t ? t.split(/[；;，,、]/) : [])) : e.s.map((s) => s.g);
    for (let si = 0; si < lists.length; si++) {
      const glosses = lists[si];
      for (let gi = 0; gi < glosses.length; gi++) {
        const raw = glosses[gi].toLowerCase().trim();
        if (!raw.includes(q)) continue;
        const core = raw.replace(/\s*[（(][^)）]*[)）]/g, '').replace(/^to /, '').trim();
        let lv;
        if (core === q || raw === q) lv = 0;
        else if (field === '_z') lv = raw.startsWith(q) ? 1 : 2;
        else if (wordRe.test(raw)) lv = 1;
        else lv = 3;
        // exact hits rank by how common the word is; looser hits also prefer short glosses
        const score = lv * 1e7 + Math.min(si, 9) * 2e5 + Math.min(gi, 9) * 5e4 +
          (lv ? Math.min(raw.length, 60) * 2000 : 0) + idx * 3 + (e.c ? 0 : 4e5);
        if (score < best) best = score;
      }
    }
    if (best < Infinity) out.push([best, idx]);
  }
  return out;
}

function matchWildcard(q) {
  const body = [...q].map((c) => (c === '*' || c === '＊' ? '.*' : c === '?' || c === '？' ? '.' : escapeRe(c))).join('');
  const re = new RegExp('^' + body + '$');
  const reH = new RegExp('^' + JP.toHiragana(body) + '$');
  const out = [];
  for (let idx = 0; idx < entries.length; idx++) {
    const e = entries[idx];
    let len = 0;
    if (e.k) for (const k of e.k) if (re.test(k)) { len = k.length; break; }
    if (!len) for (const r of e._r) if (reH.test(r)) { len = r.length; break; }
    if (len) out.push([len * 4000 + idx, idx]);
  }
  return out;
}

const sortIds = (list) => list.sort((a, b) => a[0] - b[0]);
let last = { q: null, groups: [] };

function search(raw) {
  const q = raw.normalize('NFKC').trim().toLowerCase();
  const groups = [];
  const add = (key, title, scored, note) => {
    if (!scored.length) return;
    sortIds(scored);
    groups.push({ key, title, ids: scored.map((s) => s[1]), why: note ? new Map(scored.map((s) => [s[1], s[2]])) : null });
  };
  if (!q) { last = { q, groups }; return summarize(); }

  if (/[*?＊？]/.test(q) && q.replace(/[*?＊？]/g, '')) {
    add('wild', '通配符匹配', matchWildcard(q));
  } else if (JP.isJapanese(q)) {
    const qh = JP.toHiragana(q);
    const direct = matchJapanese(q, qh, 3);
    const exact = new Set(direct.filter((s) => s[0] < 1e7).map((s) => s[1]));
    const de = matchDeinflected(q).filter((s) => !exact.has(s[1]));
    if (de.length) add('deinf', '可能是这些词的变形', de, true);
    add('jp', '词条', direct);
    if (!JP.hasKana(q)) {
      const shown = new Set(direct.map((s) => s[1]));
      add('zh', '中文释义中包含', matchGloss(q, '_z').filter((s) => !shown.has(s[1])));
    }
  } else {
    const kana = /^[a-z'\- ]+$/.test(q) ? JP.romajiToKana(q) : null;
    let shown = new Set();
    if (kana) {
      const byReading = matchJapanese(kana, kana, 1);
      const exact = new Set(byReading.filter((s) => s[0] < 1e7).map((s) => s[1]));
      const de = matchDeinflected(kana).filter((s) => !exact.has(s[1]));
      add('kana', '按读音「' + kana + '」', byReading);
      if (de.length) add('deinf', '可能是这些词的变形', de, true);
      shown = new Set(byReading.map((s) => s[1]));
    }
    const en = matchGloss(q, '_g').filter((s) => !shown.has(s[1]));
    add('en', '按英文释义', en);
    // put the stronger group first: an exact English word beats a mere reading prefix
    const gk = groups.find((g) => g.key === 'kana'), ge = groups.find((g) => g.key === 'en');
    if (gk && ge) {
      const kanaExact = entries[gk.ids[0]]._r.includes(kana);
      if (!kanaExact) { groups.splice(groups.indexOf(ge), 1); groups.unshift(ge); }
    }
    add('zh', '按中文释义', matchGloss(q, '_z'));
  }
  last = { q, groups };
  return summarize();
}

const PAGE = 30;
function slice(g, from, n) {
  return g.ids.slice(from, from + n).map((idx) => pub(idx, g.why ? g.why.get(idx) : undefined));
}
function summarize() {
  const multi = last.groups.length > 1;
  return {
    q: last.q, partial: !done,
    groups: last.groups.map((g) => {
      const n = g.key === 'deinf' ? 5 : multi && g !== last.groups[last.groups.length - 1] ? 8 : PAGE;
      return { key: g.key, title: g.title, total: g.ids.length, items: slice(g, 0, n) };
    }),
  };
}

// ---------- ops ----------
const ops = {
  search: ({ q }) => search(q),
  more: ({ key, from }) => {
    const g = last.groups.find((x) => x.key === key);
    return g ? slice(g, from, PAGE) : [];
  },
  async entry({ entryId }) {
    if (!byId.has(entryId)) await whenDone();
    return byId.has(entryId) ? pub(byId.get(entryId)) : null;
  },
  async entries({ ids }) {
    if (ids.some((i) => !byId.has(i))) await whenDone();
    return ids.filter((i) => byId.has(i)).map((i) => pub(byId.get(i)));
  },
  /** Resolve cross references like "来る・くる・1" to the best matching entry id. */
  async resolve({ refs }) {
    await whenDone();
    return refs.map((ref) => {
      const parts = ref.split('・').filter((p) => !/^\d+$/.test(p));
      const list = byForm.get(parts[0]) || byForm.get(JP.toHiragana(parts[0])) || [];
      let hit = list[0];
      if (parts[1]) {
        const want = JP.toHiragana(parts[1]);
        const better = list.find((idx) => entries[idx]._r.includes(want));
        if (better !== undefined) hit = better;
      }
      return hit === undefined ? null : entries[hit].i;
    });
  },
  wordsWithKanji({ ch, limit }) {
    const out = [];
    let total = 0;
    for (let idx = 0; idx < entries.length; idx++) {
      const e = entries[idx];
      if (!e.k || !e.k.some((k) => k.includes(ch))) continue;
      total++;
      if (out.length < limit) out.push(pub(idx));
    }
    return { total, items: out, partial: !done };
  },
  /** A stable "word of the day" picked from the most common words. */
  daily({ seed }) {
    const pool = Math.min(entries.length, 3600);   // inside the first chunk, so the pick is the same while loading
    for (let n = 0; n < 60 && pool; n++) {
      const e = entries[(seed * 7919 + n * 131) % pool];
      if (e.k && e.c && e.s.length <= 4) return pub(byId.get(e.i));
    }
    return pool ? pub(0) : null;
  },
};

onmessage = async (ev) => {
  const { id, op } = ev.data;
  try {
    postMessage({ id, result: await ops[op](ev.data) });
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};

load().catch((err) => postMessage({ event: 'error', message: String(err && err.message || err) }));
