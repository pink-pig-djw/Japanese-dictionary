/* 樱花日语词典 - page logic.  No framework: hash routes render HTML strings into #view. */
(function () {
  'use strict';

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => [...(el || document).querySelectorAll(sel)];
  const view = $('#view');
  const input = $('#q');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ja = (s, cls) => '<span lang="ja"' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(s) + '</span>';

  // ---------- storage ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('jd.' + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem('jd.' + key, JSON.stringify(value)); } catch (e) { /* private mode */ } },
  };
  const settings = Object.assign({ showEn: true, petals: true, buddy: true }, store.get('settings', {}));
  let favs = store.get('fav', []);          // [{i, t}] newest first
  let history_ = store.get('hist', []);     // recent queries, newest first
  const isFav = (id) => favs.some((f) => f.i === id);

  // ---------- worker ----------
  const worker = new Worker('js/worker.js');
  let rpcId = 0;
  const pending = new Map();
  let meta = null;
  let ready = false;
  let loadPct = 0;
  const call = (op, args) => new Promise((resolve, reject) => {
    const id = ++rpcId;
    pending.set(id, { resolve, reject });
    worker.postMessage(Object.assign({ id, op }, args));
  });
  worker.onmessage = (ev) => {
    const m = ev.data;
    if (m.id) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (p) (m.error ? p.reject(new Error(m.error)) : p.resolve(m.result));
      return;
    }
    if (m.event === 'meta') { meta = m.meta; if (route.name === 'me') render(); }
    else if (m.event === 'progress') {
      loadPct = Math.round((m.loaded / m.total) * 100);
      setLoad(loadPct, '词库加载中 ' + loadPct + '%（已可搜索常用词）');
      if (m.loaded === 1 && route.name === 'home') render();
    } else if (m.event === 'ready') {
      ready = true;
      setLoad(100, '');
      refreshBuddy();
      if (route.name === 'search' || route.name === 'kanjiChar') render(true);
    } else if (m.event === 'error') {
      setLoad(loadPct, '词库加载失败，请检查网络后刷新');
      $('#loadbar').classList.add('err');
    }
  };
  function setLoad(pct, text) {
    const bar = $('#loadbar');
    bar.setAttribute('aria-valuenow', pct);
    $('i', bar).style.inlineSize = pct + '%';
    $('#loadtext').textContent = text;
    bar.classList.toggle('done', pct >= 100);
  }

  // ---------- small helpers ----------
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  let jaVoice;
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('这个浏览器不支持朗读'); return; }
    const synth = window.speechSynthesis;
    if (jaVoice === undefined) jaVoice = synth.getVoices().find((v) => /^ja/i.test(v.lang)) || undefined;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    u.rate = 0.9;
    synth.cancel();
    synth.speak(u);
    u.onerror = () => toast('没有找到日语语音，请在系统里安装日语朗读');
  }

  const tagText = (t) => TAGS.label(meta ? meta.tags[t] : String(t));
  const tagKind = (t) => TAGS.kind(meta ? meta.tags[t] : '');
  const chips = (list, cls) => (list || []).map((t) => '<span class="chip ' + (cls || 'chip-' + tagKind(t)) + '">' + esc(tagText(t)) + '</span>').join('');

  const headword = (e) => (e.k && !usuallyKana(e) ? e.k[0] : e.r[0]);
  function usuallyKana(e) {
    if (!meta || !e.s[0].m) return false;
    return e.s[0].m.some((t) => meta.tags[t] === 'word usually written using kana alone');
  }
  const starSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.500l2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.900 6.800 19.600l1-5.800L3.500 9.700l5.900-.8z"/></svg>';
  const speakSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.500h3.500L12 6v12l-4.500-3.500H4z"/><path d="M15.500 9a4.200 4.200 0 010 6M18 6.500a7.800 7.800 0 010 11"/></svg>';

  function favButton(id) {
    const on = isFav(id);
    return '<button type="button" class="icon-btn star' + (on ? ' on' : '') + '" data-fav="' + id + '" aria-pressed="' + on +
      '" aria-label="' + (on ? '移出生词本' : '加入生词本') + '">' + starSvg + '</button>';
  }

  /** Chinese (if translated) and English text of one sense. */
  function senseText(e, n) {
    const zh = e.z && e.z[n] ? e.z[n] : '';
    return { zh, en: e.s[n].g.join('; ') };
  }

  function wordCard(e) {
    const hw = headword(e);
    const reading = hw === e.r[0] ? (e.k && usuallyKana(e) ? e.k[0] : '') : e.r[0];
    const lines = e.s.slice(0, 3).map((s, n) => {
      const t = senseText(e, n);
      return '<li>' + (t.zh ? '<span class="zh">' + esc(t.zh) + '</span>' + (settings.showEn ? '<span class="en sub">' + esc(t.en) + '</span>' : '')
        : '<span class="en">' + esc(t.en) + '</span>') + '</li>';
    }).join('');
    const more = e.s.length > 3 ? '<li class="more">…共 ' + e.s.length + ' 个义项</li>' : '';
    return '<article class="card word">' +
      '<a class="word-link" href="#/w/' + e.i + '">' +
        '<div class="word-head">' + ja(hw, 'hw') + (reading ? ja(reading, 'yomi') : '') +
          (e.c ? '<span class="chip chip-common">常用</span>' : '') + '</div>' +
        (e.why ? '<div class="why">原形 ' + ja(e.why) + '</div>' : '') +
        '<div class="chips">' + chips(e.s[0].p) + '</div>' +
        '<ol class="senses">' + lines + more + '</ol>' +
      '</a>' + favButton(e.i) + '</article>';
  }

  const emptyState = (mood, title, text) => '<div class="empty">' + Mascot.html(mood, 'md') +
    '<h2>' + esc(title) + '</h2>' + (text ? '<p>' + text + '</p>' : '') + '</div>';

  // ---------- companion mascot (shown on every page) ----------
  const BUDDY_LINES = {
    search: ['点词条可以看详细解释喵', '点 ☆ 就能收进生词本', '找不到的话，换个写法试试喵'],
    word: ['点「朗读」听听发音喵', '下面有活用表和汉字哦', '喜欢这个词就点「收藏」吧'],
    kanji: ['按年级或 JLPT 挑着看喵', '越靠前的字越常用哦'],
    kanjiChar: ['点一下读音可以听发音', '看着笔顺写一遍吧喵'],
    kana: ['点一下假名听发音喵', '上面可以切换片假名哦'],
    fav: ['点「开始复习」翻卡片吧', '今天也复习一下喵'],
    me: ['这里可以换成深色模式喵', '中文释义会慢慢补全的喵'],
    home: ['想查什么词？交给我喵'],
  };
  const buddy = $('#buddy');
  let buddyMood = '';
  let buddyTimer = 0;
  let buddyLine = 0;
  function setBuddy(mood) {
    if (mood === buddyMood) return;
    buddyMood = mood;
    $('#buddyFace').innerHTML = Mascot.html(mood, 'face');
  }
  function buddySay(text, mood, ms) {
    clearTimeout(buddyTimer);
    if (mood) setBuddy(mood);
    $('#buddySay').textContent = text;
    buddy.classList.add('talk');
    $('#buddySay').classList.add('show');
    buddyTimer = setTimeout(() => { buddy.classList.remove('talk'); $('#buddySay').classList.remove('show'); refreshBuddy(); }, ms || 2600);
  }
  /** Pick the resting mood for the current page and decide whether the companion is shown. */
  function refreshBuddy() {
    buddy.hidden = !settings.buddy;
    if (buddy.classList.contains('talk')) return;
    setBuddy(!ready && route.name === 'search' ? 'think' : 'idle');
  }
  buddy.addEventListener('click', () => {
    const lines = BUDDY_LINES[route.name] || BUDDY_LINES.home;
    buddySay(lines[buddyLine++ % lines.length], 'happy');
  });

  // ---------- routes ----------
  let route = { name: 'home' };
  let renderToken = 0;
  const scrollMemo = new Map();
  let restoring = false;

  function parseHash() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const [a, ...rest] = h.split('/');
    const arg = rest.join('/');
    if (a === 'q' && arg) return { name: 'search', q: arg };
    if (a === 'w' && arg) return { name: 'word', id: +arg };
    if (a === 'k' && arg) return { name: 'kanjiChar', ch: arg };
    if (a === 'kanji') return { name: 'kanji', group: arg || '' };
    if (a === 'kana') return { name: 'kana' };
    if (a === 'fav') return { name: 'fav', mode: arg };
    if (a === 'me') return { name: 'me' };
    return { name: 'home' };
  }
  const TAB = { home: 'home', search: 'home', word: 'home', kanji: 'kanji', kanjiChar: 'kanji', kana: 'kana', fav: 'fav', me: 'me' };

  async function render(keepScroll) {
    const token = ++renderToken;
    const r = route;
    for (const a of $$('.tabs a')) {
      const on = a.dataset.tab === TAB[r.name];
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
    $('#backBtn').hidden = !(r.name === 'word' || r.name === 'kanjiChar');
    if (r.name === 'search') { if (document.activeElement !== input) input.value = r.q; }
    else if (r.name !== 'word' && r.name !== 'kanjiChar' && document.activeElement !== input) input.value = '';
    $('#clearBtn').hidden = !input.value;
    document.title = (r.name === 'search' ? r.q + ' - ' : '') + '樱花日语词典';

    const html = await pages[r.name](r);
    if (token !== renderToken) return;
    view.innerHTML = html;
    view.dataset.page = r.name;
    if (after[r.name]) after[r.name](r);
    refreshBuddy();
    if (restoring) { window.scrollTo(0, scrollMemo.get(location.hash) || 0); restoring = false; }
    else if (!keepScroll) window.scrollTo(0, 0);
  }

  function go() {
    route = parseHash();
    render();
  }
  window.addEventListener('popstate', () => { restoring = true; });
  window.addEventListener('hashchange', go);
  window.addEventListener('scroll', () => { scrollMemo.set(location.hash, window.scrollY); }, { passive: true });

  const pages = {};
  const after = {};

  // ----- home -----
  pages.home = async () => {
    const hour = new Date().getHours();
    const hello = hour < 5 ? ['こんばんは', '夜深了，早点休息喵'] : hour < 11 ? ['おはよう', '早上好，今天也一起加油喵']
      : hour < 18 ? ['こんにちは', '想查什么词？交给我喵'] : ['こんばんは', '晚上好，今天学了什么喵？'];
    let daily = null;
    if (loadPct > 0) {
      const d = new Date();
      daily = await call('daily', { seed: d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate() });
    }
    const hist = history_.slice(0, 12).map((q) => '<a class="pill" href="#/q/' + encodeURIComponent(q) + '" lang="ja">' + esc(q) + '</a>').join('');
    const stat = meta ? Math.round(meta.words / 10000) + ' 万词条 · ' + (meta.kanji / 10000).toFixed(1) + ' 万汉字' : '';
    return '<section class="hero"><i class="spark"></i><i class="spark"></i><i class="spark"></i>' +
        '<span class="hero-kicker">SAKURA JISHO</span><h1>樱花日语词典</h1>' +
        '<p class="hero-stat">' + stat + '</p>' +
        '<div class="bubble"><b lang="ja">' + hello[0] + '！</b><span>' + hello[1] + '</span></div>' +
        Mascot.html('idle') + '</section>' +
      (hist ? '<section class="block"><div class="block-head"><h2>最近查过</h2><button type="button" class="link" data-act="clear-hist">清空</button></div><div class="pills">' + hist + '</div></section>' : '') +
      (daily ? '<section class="block"><h2>今日一词</h2>' + wordCard(daily) + '</section>' : '') +
      '<section class="block"><h2>可以这样查</h2><div class="tips">' +
        [['食べる', '日语原文', '汉字、假名都可以'], ['taberu', '罗马字', '不会打假名也能查'], ['cat', '英文', '按意思反查日语'],
          ['食べました', '变形', '自动还原成原形'], ['*日和', '通配符', '* 任意多字，? 任意一字']]
          .map(([q, t, d]) => '<a class="tip" href="#/q/' + encodeURIComponent(q) + '"><b lang="ja">' + esc(q) + '</b><span>' + t + '</span><small>' + d + '</small></a>').join('') +
      '</div></section>';
  };

  // ----- search -----
  let lastResult = null;
  pages.search = async (r) => {
    const res = await call('search', { q: r.q });
    lastResult = res;
    if (!res.groups.length) {
      return res.partial
        ? emptyState('think', '还在翻词典…', '词库加载到 ' + loadPct + '%，加载完会自动再找一遍')
        : emptyState('sorry', '没有找到「' + r.q + '」', '换个写法试试：假名、汉字、罗马字或英文都可以；也可以用 * 代替不确定的部分');
    }
    const chars = JP.kanjiIn(r.q).slice(0, 8);
    const kanjiRow = chars.length ? '<section class="block"><h2>汉字</h2><div class="kanji-row">' +
      chars.map((ch) => '<a class="kanji-cell" href="#/k/' + encodeURIComponent(ch) + '"><b lang="ja">' + ch + '</b><span data-kmean="' + ch + '"></span></a>').join('') +
      '</div></section>' : '';
    return res.groups.map((g) => '<section class="block" data-group="' + g.key + '">' +
      '<div class="block-head"><h2>' + esc(g.title) + '</h2><span class="count">' + g.total + ' 条</span></div>' +
      '<div class="list">' + g.items.map(wordCard).join('') + '</div>' +
      (g.total > g.items.length ? '<button type="button" class="btn ghost more-btn" data-more="' + g.key + '" data-from="' + g.items.length + '">显示更多</button>' : '') +
      '</section>').join('') + kanjiRow + (res.partial ? '<p class="hint">词库还在加载，加载完会自动补全结果</p>' : '');
  };

  // ----- word -----
  const VERB_ROWS = [['dict', '辞书形', '原形'], ['masu', 'ます形', '礼貌'], ['nai', 'ない形', '否定'], ['ta', 'た形', '过去'],
    ['te', 'て形', '连接'], ['potential', '可能形', '能…'], ['passive', '被动形', '被…'], ['causative', '使役形', '让…'],
    ['causPass', '使役被动', '被迫…'], ['volitional', '意志形', '…吧'], ['imperative', '命令形', '命令'],
    ['ba', '假定形', '如果…'], ['prohibitive', '禁止形', '不许…']];
  const ADJ_ROWS = [['dict', '基本形', ''], ['polite', '礼貌', ''], ['neg', '否定', '不…'], ['past', '过去', ''],
    ['pastNeg', '过去否定', ''], ['te', 'て形', '连接'], ['attr', '连体形', '修饰名词'], ['adv', '副词形', '…地'],
    ['ba', '假定形', '如果…'], ['noun', '名词化', '…的程度']];

  function conjugationTable(e) {
    if (!meta) return '';
    const pos = [];
    for (const s of e.s) for (const t of s.p || []) pos.push(meta.tags[t]);
    const cls = JP.inflectionClass(pos);
    if (!cls) return '';
    const written = JP.conjugate(e.k ? e.k[0] : e.r[0], cls);
    const read = e.k ? JP.conjugate(e.r[0], cls) : null;
    if (!written) return '';
    const rows = (written.kind === 'verb' ? VERB_ROWS : ADJ_ROWS).filter(([key]) => written.forms[key]).map(([key, name, hint]) =>
      '<tr><th scope="row">' + name + (hint ? '<small>' + hint + '</small>' : '') + '</th><td>' + ja(written.forms[key], 'conj') +
      (read && read.forms[key] && read.forms[key] !== written.forms[key] ? ja(read.forms[key], 'yomi') : '') + '</td>' +
      '<td><button type="button" class="icon-btn sm" data-speak="' + esc((read || written).forms[key]) + '" aria-label="朗读">' + speakSvg + '</button></td></tr>').join('');
    const title = written.kind === 'verb' ? '动词活用' : '形容词活用';
    return '<details class="card fold"><summary>' + title + '<small>' +
      (cls === 'vs' ? '（接 する）' : '') + '</small></summary><table class="conj-table"><tbody>' + rows + '</tbody></table></details>';
  }

  pages.word = async (r) => {
    const e = await call('entry', { entryId: r.id });
    if (!e) return emptyState('sorry', '找不到这个词条', '');
    const hw = headword(e);
    const showKanji = hw !== e.r[0];
    const note = (map, n) => (map && map[n] !== undefined ? '<small class="form-note">' + esc(tagText(map[n])) + '</small>' : '');
    const forms = [];
    (e.k || []).forEach((k, n) => { if (k !== hw) forms.push('<span class="form">' + ja(k) + note(e.ki, n) + '</span>'); });
    e.r.forEach((k, n) => {
      if (k === hw || (showKanji && n === 0)) return;
      const only = e.rr && e.rr[n] ? '<small class="form-note">仅 ' + esc(e.rr[n].join('、')) + '</small>' : '';
      forms.push('<span class="form">' + ja(k) + note(e.ri, n) + only + '</span>');
    });

    let lastPos = '';
    let listOpen = false;
    const senses = e.s.map((s, n) => {
      const t = senseText(e, n);
      const posKey = (s.p || []).join(',');
      const posLine = posKey !== lastPos && s.p ? '<div class="chips pos-line">' + chips(s.p) + '</div>' : '';
      lastPos = posKey;
      const extra = [];
      if (s.o) extra.push('<div class="meta">仅用于 ' + s.o.map((x) => ja(x)).join('、') + '</div>');
      if (s.n) extra.push('<div class="meta" lang="en">注：' + esc(s.n) + '</div>');
      if (s.l) extra.push('<div class="meta">词源：' + s.l.map(([lang, word, wasei]) => esc(TAGS.lang(lang)) + (word ? ' <i>' + esc(word) + '</i>' : '') + (wasei ? '（和制）' : '')).join('，') + '</div>');
      if (s.x) extra.push('<div class="meta">参见 ' + s.x.map((x) => '<a class="xref" data-ref="' + esc(x) + '" href="#/q/' + encodeURIComponent(x.split('・')[0]) + '" lang="ja">' + esc(x.split('・').filter((p) => !/^\d+$/.test(p))[0]) + '</a>').join('、') + '</div>');
      if (s.a) extra.push('<div class="meta">反义 ' + s.a.map((x) => '<a class="xref" data-ref="' + esc(x) + '" href="#/q/' + encodeURIComponent(x.split('・')[0]) + '" lang="ja">' + esc(x.split('・')[0]) + '</a>').join('、') + '</div>');
      const tagsLine = chips(s.m) + chips(s.f) + chips(s.d);
      let open = '';
      if (posLine || !listOpen) {
        open = (listOpen ? '</ol>' : '') + posLine + '<ol class="sense-list" start="' + (n + 1) + '">';
        listOpen = true;
      }
      return open + '<li>' + (t.zh ? '<p class="zh">' + esc(t.zh) + '<span class="ai" title="由 AI 根据英文释义翻译，可能有误">AI译</span></p>' : '') +
        (t.zh && !settings.showEn ? '' : '<p class="en' + (t.zh ? ' sub' : '') + '" lang="en">' + esc(t.en) + '</p>') +
        (tagsLine ? '<div class="chips">' + tagsLine + '</div>' : '') + extra.join('') + '</li>';
    }).join('');

    const kanji = JP.kanjiIn((e.k || []).slice(0, 3).join(''));
    return '<article class="entry">' +
      '<header class="card entry-head">' +
        '<div class="entry-title">' +
          (showKanji ? '<ruby lang="ja" class="big">' + esc(hw) + '<rt>' + esc(e.r[0]) + '</rt></ruby>' : ja(hw, 'big')) +
        '</div>' +
        '<div class="entry-actions">' +
          '<button type="button" class="btn round" data-speak="' + esc(e.r[0]) + '">' + speakSvg + '<span>朗读</span></button>' +
          '<button type="button" class="btn round fav-btn' + (isFav(e.i) ? ' on' : '') + '" data-fav="' + e.i + '" aria-pressed="' + isFav(e.i) + '">' + starSvg + '<span>' + (isFav(e.i) ? '已收藏' : '收藏') + '</span></button>' +
          '<button type="button" class="btn round" data-copy="' + esc(hw) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.500" y="8.500" width="11" height="11" rx="2.500"/><path d="M15.500 5.500v-1a1.500 1.500 0 00-1.500-1.500h-9A1.500 1.500 0 003.500 4.500v9A1.500 1.500 0 005 15h.500"/></svg><span>复制</span></button>' +
        '</div>' +
        (e.c ? '<div class="chips"><span class="chip chip-common">常用词</span></div>' : '') +
        (forms.length ? '<div class="forms"><span class="label">其他写法</span>' + forms.join('') + '</div>' : '') +
      '</header>' +
      '<section class="card"><h2>释义</h2>' + senses + '</ol>' +
        (e.z ? '' : '<p class="hint">这个词还没有中文释义，暂时显示英文原文</p>') + '</section>' +
      conjugationTable(e) +
      (kanji.length ? '<section class="card"><h2>包含的汉字</h2><div class="kanji-row" id="entryKanji">' +
        kanji.map((ch) => '<a class="kanji-cell" href="#/k/' + encodeURIComponent(ch) + '"><b lang="ja">' + ch + '</b><span data-kmean="' + ch + '"></span></a>').join('') +
        '</div></section>' : '') +
      '<p class="src">词条编号 ' + e.i + ' · 数据来自 JMdict</p></article>';
  };
  function fillKanjiHints() {
    if (!$('[data-kmean]')) return;
    Kanji.load().then((db) => {
      for (const el of $$('[data-kmean]')) {
        const k = db[el.dataset.kmean];
        el.textContent = k ? [(k.o || [])[0], (k.u || [])[0]].filter(Boolean).join(' · ') : '';
        el.lang = 'ja';
      }
    }).catch(() => {});
  }
  after.search = fillKanjiHints;
  after.word = async () => {
    fillKanjiHints();
    // point cross references straight at their entries
    const links = $$('a.xref');
    if (!links.length) return;
    const token = renderToken;
    const ids = await call('resolve', { refs: links.map((a) => a.dataset.ref) });
    if (token !== renderToken) return;
    links.forEach((a, n) => { if (ids[n]) a.href = '#/w/' + ids[n]; });
  };

  // ----- kanji -----
  const Kanji = {
    db: null, promise: null,
    load() {
      if (!this.promise) {
        this.promise = fetch('data/kanji.json').then((r) => { if (!r.ok) throw new Error('kanji'); return r.json(); })
          .then((db) => (this.db = db));
        this.promise.catch(() => { this.promise = null; });
      }
      return this.promise;
    },
  };
  const KANJI_GROUPS = [
    ['g1', '小学一年级', (k) => k.g === 1], ['g2', '小学二年级', (k) => k.g === 2], ['g3', '小学三年级', (k) => k.g === 3],
    ['g4', '小学四年级', (k) => k.g === 4], ['g5', '小学五年级', (k) => k.g === 5], ['g6', '小学六年级', (k) => k.g === 6],
    ['g8', '中学常用', (k) => k.g === 8], ['g9', '人名用字', (k) => k.g === 9 || k.g === 10],
    ['j4', 'JLPT 入门（旧4级）', (k) => k.j === 4], ['j3', 'JLPT 初级（旧3级）', (k) => k.j === 3],
    ['j2', 'JLPT 中级（旧2级）', (k) => k.j === 2], ['j1', 'JLPT 高级（旧1级）', (k) => k.j === 1],
  ];
  pages.kanji = async (r) => {
    let db;
    try { db = await Kanji.load(); } catch (e) { return emptyState('sorry', '汉字数据加载失败', '请检查网络后重试'); }
    const cur = KANJI_GROUPS.find((g) => g[0] === r.group) || KANJI_GROUPS[0];
    const list = Object.keys(db).filter((ch) => cur[2](db[ch])).sort((a, b) => (db[a].f || 9999) - (db[b].f || 9999) || db[a].s - db[b].s);
    return '<section class="block"><h1>汉字</h1><p class="lead">共收录 ' + Object.keys(db).length + ' 个汉字。在上方搜索框输入任意汉字也能直接查看。</p>' +
      '<div class="seg" role="tablist">' + KANJI_GROUPS.map((g) => '<a role="tab" aria-selected="' + (g === cur) + '" class="' + (g === cur ? 'on' : '') + '" href="#/kanji/' + g[0] + '">' + g[1] + '</a>').join('') + '</div>' +
      '<div class="block-head"><h2>' + cur[1] + '</h2><span class="count">' + list.length + ' 字 · 按常用度排列</span></div>' +
      '<div class="kanji-grid">' + list.map((ch) => '<a href="#/k/' + encodeURIComponent(ch) + '" lang="ja">' + ch + '</a>').join('') + '</div></section>';
  };
  after.kanji = () => { const on = $('.seg .on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' }); };

  pages.kanjiChar = async (r) => {
    let db;
    try { db = await Kanji.load(); } catch (e) { return emptyState('sorry', '汉字数据加载失败', '请检查网络后重试'); }
    const ch = [...r.ch][0];
    const k = db[ch];
    if (!k) return emptyState('sorry', '没有收录「' + ch + '」', '这个字不在汉字表里');
    const words = await call('wordsWithKanji', { ch, limit: 30 });
    const fact = (label, value) => (value ? '<div class="fact"><span>' + label + '</span><b>' + value + '</b></div>' : '');
    const grade = k.g ? (k.g <= 6 ? '小学' + k.g + '年级' : k.g === 8 ? '中学' : '人名用') : '';
    const jlpt = k.j ? '旧' + k.j + '级' : '';
    const rad = k.b ? String.fromCodePoint(0x2f00 + k.b - 1).normalize('NFKC') : '';
    const readings = (label, list, cls) => (list && list.length ? '<div class="read-row"><span class="label">' + label + '</span><div>' +
      list.map((x) => '<button type="button" class="reading ' + cls + '" data-speak="' + esc(x.replace(/[.\-]/g, '')) + '" lang="ja">' + esc(x) + '</button>').join('') + '</div></div>' : '');
    return '<article class="entry">' +
      '<header class="card kanji-head"><div class="kanji-top"><div class="kanji-big" lang="ja">' + ch + '</div>' +
        '<div id="strokes" class="strokes" hidden></div></div>' +
        '<div class="facts">' + fact('笔画', k.s + ' 画') + fact('部首', rad) + fact('年级', grade) + fact('JLPT', jlpt) + fact('常用度', k.f ? '第 ' + k.f + ' 位' : '') + '</div>' +
        '<button type="button" class="btn round" data-speak="' + esc(((k.u || k.o || [''])[0]).replace(/[.\-]/g, '')) + '">' + speakSvg + '<span>朗读</span></button>' +
      '</header>' +
      '<section class="card"><h2>读音</h2>' + readings('音读', k.o, 'on') + readings('训读', k.u, 'kun') +
        (k.n ? readings('人名', k.n, 'nanori') : '') +
        (k.p ? '<div class="read-row"><span class="label">拼音</span><div class="pinyin">' + esc(k.p.join('  ')) + '</div></div>' : '') +
        '<p class="hint">训读中「.」后面是送假名，「-」表示作前后缀</p></section>' +
      (k.m ? '<section class="card"><h2>字义</h2><p class="en" lang="en">' + esc(k.m.join('; ')) + '</p></section>' : '') +
      '<section class="block"><div class="block-head"><h2>含「' + ch + '」的词</h2><span class="count">' + words.total + ' 条' + (words.partial ? '（加载中）' : '') + '</span></div>' +
        '<div class="list">' + words.items.map(wordCard).join('') + '</div>' +
        (words.total > words.items.length ? '<a class="btn ghost more-btn" href="#/q/' + encodeURIComponent('*' + ch + '*') + '">查看全部</a>' : '') +
      '</section><p class="src">数据来自 KANJIDIC2 · 笔顺来自 KanjiVG</p></article>';
  };
  after.kanjiChar = (r) => { loadStrokes([...r.ch][0]); };

  /** Stroke-order animation from KanjiVG, fetched on demand (silently skipped when offline). */
  async function loadStrokes(ch) {
    const box = $('#strokes');
    if (!box) return;
    const token = renderToken;
    try {
      const hex = ch.codePointAt(0).toString(16).padStart(5, '0');
      const res = await fetch('https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/' + hex + '.svg');
      if (!res.ok) return;
      const text = await res.text();
      const paths = [...text.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
      if (!paths.length || token !== renderToken) return;
      box.innerHTML = '<svg viewBox="0 0 109 109" aria-label="笔顺动画"><path class="guide" d="M54.500 4v101M4 54.500h101"/>' +
        paths.map((d, n) => '<path class="stroke" pathLength="1" style="animation-delay:' + (n * 0.55).toFixed(2) + 's" d="' + esc(d) + '"/>').join('') +
        '</svg><button type="button" class="link" data-act="replay">重播笔顺</button>';
      box.parentElement.classList.add('has-strokes');
      box.hidden = false;
    } catch (e) { /* offline: no stroke order */ }
  }

  // ----- kana -----
  const KANA = {
    basic: ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'や　ゆ　よ', 'らりるれろ', 'わ　　　を', 'ん'],
    voiced: ['がぎぐげご', 'ざじずぜぞ', 'だぢづでど', 'ばびぶべぼ', 'ぱぴぷぺぽ'],
    combo: ['きゃ きゅ きょ', 'しゃ しゅ しょ', 'ちゃ ちゅ ちょ', 'にゃ にゅ にょ', 'ひゃ ひゅ ひょ', 'みゃ みゅ みょ', 'りゃ りゅ りょ',
      'ぎゃ ぎゅ ぎょ', 'じゃ じゅ じょ', 'びゃ びゅ びょ', 'ぴゃ ぴゅ ぴょ'],
  };
  const ROMAJI = (() => {
    const m = {};
    const rows = { あ: '', か: 'k', さ: 's', た: 't', な: 'n', は: 'h', ま: 'm', ら: 'r', が: 'g', ざ: 'z', だ: 'd', ば: 'b', ぱ: 'p' };
    for (const row of KANA.basic.concat(KANA.voiced)) {
      const c = rows[row[0]];
      if (c === undefined) continue;
      [...row].forEach((k, n) => { m[k] = c + 'aiueo'[n]; });
    }
    Object.assign(m, { し: 'shi', ち: 'chi', つ: 'tsu', ふ: 'fu', じ: 'ji', ぢ: 'ji', づ: 'zu', や: 'ya', ゆ: 'yu', よ: 'yo', わ: 'wa', を: 'wo', ん: 'n' });
    const small = { ゃ: 'ya', ゅ: 'yu', ょ: 'yo' };
    for (const row of KANA.combo) {
      for (const k of row.split(' ')) {
        const base = m[k[0]];
        m[k] = /^(sh|ch|j)/.test(base) ? base.slice(0, -1) + small[k[1]].slice(1) : base.slice(0, -1) + small[k[1]];
      }
    }
    return m;
  })();
  let kanaMode = store.get('kanaMode', 'hira');
  pages.kana = async () => {
    const conv = kanaMode === 'kata' ? JP.toKatakana : (s) => s;
    const cell = (k) => (k === '　' || !k ? '<span class="kana-cell blank"></span>'
      : '<button type="button" class="kana-cell" data-speak="' + k + '"><b lang="ja">' + conv(k) + '</b><small>' + ROMAJI[k] + '</small></button>');
    const table = (rows, cols, split) => '<div class="kana-table cols-' + cols + '">' + rows.map((row) => (split ? row.split(' ') : [...row]).map(cell).join('')).join('') + '</div>';
    return '<section class="block"><h1>五十音图</h1><p class="lead">点一下假名可以听发音</p>' +
      '<div class="seg two"><button type="button" class="' + (kanaMode === 'hira' ? 'on' : '') + '" data-kana="hira">平假名 あ</button>' +
      '<button type="button" class="' + (kanaMode === 'kata' ? 'on' : '') + '" data-kana="kata">片假名 ア</button></div>' +
      '<h2>清音</h2>' + table(KANA.basic, 5) + '<h2>浊音・半浊音</h2>' + table(KANA.voiced, 5) +
      '<h2>拗音</h2>' + table(KANA.combo, 3, true) + '</section>';
  };

  // ----- favourites -----
  let cardIdx = 0, cardFlipped = false, cardOrder = [];
  pages.fav = async (r) => {
    if (!favs.length) return emptyState('sleep', '生词本还是空的', '查词时点一下 ☆ 就能把词收进来');
    const list = await call('entries', { ids: favs.map((f) => f.i) });
    if (r.mode === 'review') {
      if (cardOrder.length !== list.length) { cardOrder = list.map((_, n) => n).sort(() => Math.random() - 0.5); cardIdx = 0; cardFlipped = false; }
      const e = list[cardOrder[cardIdx % list.length]];
      const hw = headword(e);
      const back = e.s.slice(0, 4).map((s, n) => { const t = senseText(e, n); return '<li>' + esc(t.zh || t.en) + '</li>'; }).join('');
      return '<section class="block"><div class="block-head"><h1>复习</h1><a class="link" href="#/fav">返回列表</a></div>' +
        '<button type="button" class="card flash' + (cardFlipped ? ' flipped' : '') + '" data-act="flip">' +
          '<span class="big" lang="ja">' + esc(hw) + '</span>' +
          (cardFlipped ? '<span class="yomi" lang="ja">' + esc(e.r[0]) + '</span><ol class="senses">' + back + '</ol>'
            : '<span class="hint">点一下看答案</span>') +
        '</button>' +
        '<div class="flash-nav"><button type="button" class="btn ghost" data-act="card-prev">上一个</button>' +
          '<span class="count">' + ((cardIdx % list.length) + 1) + ' / ' + list.length + '</span>' +
          '<button type="button" class="btn" data-act="card-next">下一个</button></div>' +
        '<div class="flash-nav"><button type="button" class="btn round" data-speak="' + esc(e.r[0]) + '">' + speakSvg + '<span>朗读</span></button>' +
          '<a class="btn round" href="#/w/' + e.i + '"><span>查看词条</span></a></div></section>';
    }
    return '<section class="block"><div class="block-head"><h1>生词本</h1><span class="count">' + list.length + ' 个词</span></div>' +
      '<a class="btn wide" href="#/fav/review">开始复习（闪卡）</a>' +
      '<div class="list">' + list.map(wordCard).join('') + '</div></section>';
  };

  // ----- settings -----
  pages.me = async () => {
    let scheme = 'light dark';
    try { scheme = localStorage.getItem('color-scheme') || 'light dark'; } catch (e) { /* ignore */ }
    const sys = matchMedia('(prefers-color-scheme: dark)').matches ? '深色' : '浅色';
    const opt = (v, label) => '<button type="button" class="' + (scheme === v ? 'on' : '') + '" data-scheme="' + v + '" aria-pressed="' + (scheme === v) + '">' + label + '</button>';
    const sw = (key, label, desc) => '<label class="row switch"><span><b>' + label + '</b><small>' + desc + '</small></span>' +
      '<input type="checkbox" data-setting="' + key + '"' + (settings[key] ? ' checked' : '') + '><i aria-hidden="true"></i></label>';
    const m = meta || {};
    const pct = m.words ? ((m.zhEntries || 0) / m.words * 100) : 0;
    return '<section class="block"><h1>设置</h1>' +
      '<div class="card"><h2>外观</h2><div class="seg three">' + opt('light dark', '跟随系统<small>当前' + sys + '</small>') + opt('light', '浅色') + opt('dark', '深色') + '</div>' +
        sw('petals', '樱花飘落', '背景里的花瓣动画') +
        sw('buddy', '吉祥物陪伴', '在每个页面顶部的搜索框旁边，点她会说话') + '</div>' +
      '<div class="card"><h2>释义</h2>' + sw('showEn', '同时显示英文原文', '有中文释义时，在下面保留英文对照') +
        '<div class="row"><span><b>中文释义进度</b><small>中文由 AI 根据英文释义翻译，逐步补全；没有中文的词显示英文</small></span></div>' +
        '<div class="meter"><i style="inline-size:' + Math.max(pct, pct > 0 ? 1 : 0).toFixed(1) + '%"></i></div>' +
        '<p class="hint">已翻译 ' + (m.zhEntries || 0).toLocaleString() + ' / ' + (m.words || 0).toLocaleString() + ' 个词条（' + pct.toFixed(1) + '%）</p></div>' +
      '<div class="card"><h2>词库</h2><div class="facts wide">' +
        '<div class="fact"><span>词条</span><b>' + (m.words || 0).toLocaleString() + '</b></div>' +
        '<div class="fact"><span>常用词</span><b>' + (m.common || 0).toLocaleString() + '</b></div>' +
        '<div class="fact"><span>汉字</span><b>' + (m.kanji || 0).toLocaleString() + '</b></div></div>' +
        '<p class="hint">词库版本：JMdict ' + esc(m.jmdict || '') + '（' + esc(m.jmdictDate || '') + ' 前后的快照）。首次打开会下载整个词库，之后保存在浏览器里，可离线搜索。</p></div>' +
      '<div class="card"><h2>我的数据</h2>' +
        '<div class="row"><span><b>生词本</b><small>' + favs.length + ' 个词，只保存在这台设备的浏览器里</small></span><button type="button" class="btn ghost sm" data-act="export">导出</button></div>' +
        '<div class="row"><span><b>搜索记录</b><small>' + history_.length + ' 条</small></span><button type="button" class="btn ghost sm" data-act="clear-hist">清空</button></div></div>' +
      '<div class="card about"><h2>关于</h2>' +
        '<p>词汇数据来自 <a href="https://www.edrdg.org/jmdict/j_jmdict.html" target="_blank" rel="noopener">JMdict</a>，汉字数据来自 <a href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project" target="_blank" rel="noopener">KANJIDIC2</a>，' +
        '版权归 <a href="https://www.edrdg.org/" target="_blank" rel="noopener">电子辞书研究与开发小组（EDRDG）</a>所有，按 CC BY-SA 4.0 许可使用。' +
        '笔顺数据来自 <a href="https://kanjivg.tagaini.net/" target="_blank" rel="noopener">KanjiVG</a>（CC BY-SA 3.0），查看汉字时联网获取。</p></div></section>';
  };

  // ---------- events ----------
  function saveHistory(q) {
    q = q.trim();
    if (!q) return;
    history_ = [q].concat(history_.filter((x) => x !== q)).slice(0, 30);
    store.set('hist', history_);
  }

  let typeTimer = 0;
  input.addEventListener('input', () => {
    $('#clearBtn').hidden = !input.value;
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => {
      const q = input.value.trim();
      const target = q ? '#/q/' + encodeURIComponent(q) : '#/';
      if (location.hash === target) return;
      // keep one history entry while typing; a new one when coming from another page
      if (route.name === 'search' || (route.name === 'home' && !q)) history.replaceState(null, '', target);
      else history.pushState(null, '', target);
      go();
    }, 160);
  });
  $('#searchForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    clearTimeout(typeTimer);
    const q = input.value.trim();
    if (!q) return;
    saveHistory(q);
    input.blur();
    const target = '#/q/' + encodeURIComponent(q);
    if (location.hash !== target) { history.replaceState(null, '', target); go(); }
  });
  $('#clearBtn').addEventListener('click', () => {
    input.value = '';
    $('#clearBtn').hidden = true;
    input.focus();
    if (route.name === 'search') { history.replaceState(null, '', '#/'); go(); }
  });
  $('#backBtn').addEventListener('click', () => { if (history.length > 1) history.back(); else location.hash = '#/'; });

  function toggleFav(id) {
    const speakUp = settings.buddy && !buddy.hidden;
    if (isFav(id)) { favs = favs.filter((f) => f.i !== id); if (speakUp) buddySay('好，拿掉了喵', 'idle', 1800); else toast('已移出生词本'); }
    else { favs.unshift({ i: id, t: Date.now() }); if (speakUp) buddySay('记进生词本啦！', 'happy', 2000); else toast('已加入生词本 ✿'); }
    store.set('fav', favs);
    cardOrder = [];
    for (const b of $$('[data-fav="' + id + '"]')) {
      const on = isFav(id);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
      const label = $('span', b);
      if (label) label.textContent = on ? '已收藏' : '收藏';
      else b.setAttribute('aria-label', on ? '移出生词本' : '加入生词本');
    }
  }

  document.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-fav],[data-speak],[data-copy],[data-more],[data-act],[data-kana],[data-scheme],a.word-link');
    if (!t) return;
    if (t.matches('a.word-link')) {
      if (route.name === 'search') saveHistory(route.q);
      return;
    }
    if (t.dataset.fav) { ev.preventDefault(); toggleFav(+t.dataset.fav); if (route.name === 'fav' && !route.mode) render(true); return; }
    if (t.dataset.speak) { speak(t.dataset.speak); return; }
    if (t.dataset.copy) {
      try { await navigator.clipboard.writeText(t.dataset.copy); toast('已复制'); } catch (e) { toast('复制失败'); }
      return;
    }
    if (t.dataset.more) {
      const from = +t.dataset.from;
      const items = await call('more', { key: t.dataset.more, from });
      $('.list', t.parentElement).insertAdjacentHTML('beforeend', items.map(wordCard).join(''));
      const g = lastResult && lastResult.groups.find((x) => x.key === t.dataset.more);
      t.dataset.from = from + items.length;
      if (!items.length || (g && from + items.length >= g.total)) t.remove();
      return;
    }
    if (t.dataset.kana) { kanaMode = t.dataset.kana; store.set('kanaMode', kanaMode); render(true); return; }
    if (t.dataset.scheme) {
      const v = t.dataset.scheme;
      try { if (v === 'light dark') localStorage.removeItem('color-scheme'); else localStorage.setItem('color-scheme', v); } catch (e) { /* ignore */ }
      document.querySelector('meta[name="color-scheme"]').content = v;
      render(true);
      return;
    }
    const act = t.dataset.act;
    if (act === 'clear-hist') { history_ = []; store.set('hist', history_); render(true); toast('搜索记录已清空'); }
    else if (act === 'flip') { cardFlipped = !cardFlipped; render(true); }
    else if (act === 'card-next') { cardIdx++; cardFlipped = false; render(true); }
    else if (act === 'card-prev') { cardIdx = Math.max(0, cardIdx - 1); cardFlipped = false; render(true); }
    else if (act === 'replay') { const s = $('#strokes svg'); if (s) s.replaceWith(s.cloneNode(true)); }
    else if (act === 'export') {
      const list = await call('entries', { ids: favs.map((f) => f.i) });
      const text = list.map((e) => [headword(e), e.r[0], e.s.map((s, n) => senseText(e, n).zh || s.g.join('; ')).join(' / ')].join('\t')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/tab-separated-values' }));
      a.download = '生词本.tsv';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  });
  document.addEventListener('change', (ev) => {
    const key = ev.target.dataset && ev.target.dataset.setting;
    if (!key) return;
    settings[key] = ev.target.checked;
    store.set('settings', settings);
    if (key === 'petals') petals();
    if (key === 'buddy') refreshBuddy();
  });
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'color-scheme') document.querySelector('meta[name="color-scheme"]').content = ev.newValue || 'light dark';
  });

  // ---------- decoration ----------
  function petals() {
    const box = $('#petals');
    const on = settings.petals && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.innerHTML = on ? Array.from({ length: 12 }, (_, n) =>
      '<i style="--x:' + ((n * 37 + 11) % 100) + '%;--d:' + (9 + (n * 7) % 9) + 's;--w:' + (-(n * 2.3) % 14).toFixed(1) + 's;--s:' + (0.6 + (n % 4) * 0.2) + '"></i>').join('') : '';
  }

  petals();
  go();
})();
