/* Japanese text helpers shared by the page and the search worker.
 * Plain script (no modules) so the worker can importScripts() it. */
(function (root) {
  'use strict';

  // ---------- kana ----------
  function toHiragana(s) {
    let out = '';
    for (const ch of s) {
      const c = ch.codePointAt(0);
      out += c >= 0x30a1 && c <= 0x30f6 ? String.fromCodePoint(c - 0x60) : ch;
    }
    return out;
  }
  function toKatakana(s) {
    let out = '';
    for (const ch of s) {
      const c = ch.codePointAt(0);
      out += c >= 0x3041 && c <= 0x3096 ? String.fromCodePoint(c + 0x60) : ch;
    }
    return out;
  }
  const RE_KANA = /[ぁ-ゖァ-ヺー]/;
  const RE_KANJI = /[㐀-䶿一-鿿豈-﫿々〆]/;
  const RE_KANJI_G = /[㐀-䶿一-鿿豈-﫿]/g;
  const hasKana = (s) => RE_KANA.test(s);
  const hasKanji = (s) => RE_KANJI.test(s);
  const isJapanese = (s) => RE_KANA.test(s) || RE_KANJI.test(s);
  const kanjiIn = (s) => [...new Set(s.match(RE_KANJI_G) || [])];

  // ---------- romaji -> hiragana ----------
  const ROMA = {
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
    ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
    sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ',
    za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
    ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と',
    da: 'だ', di: 'ぢ', du: 'づ', dzu: 'づ', de: 'で', do: 'ど',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
    ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ',
    ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
    pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
    ya: 'や', yu: 'ゆ', yo: 'よ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
    wa: 'わ', wi: 'うぃ', we: 'うぇ', wo: 'を',
    fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
    va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
    she: 'しぇ', je: 'じぇ', che: 'ちぇ', thi: 'てぃ', dhi: 'でぃ',
    xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', xtu: 'っ', xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ',
    '-': 'ー',
  };
  for (const [c, k] of [['k', 'き'], ['g', 'ぎ'], ['n', 'に'], ['h', 'ひ'], ['b', 'び'], ['p', 'ぴ'], ['m', 'み'], ['r', 'り']]) {
    ROMA[c + 'ya'] = k + 'ゃ'; ROMA[c + 'yu'] = k + 'ゅ'; ROMA[c + 'yo'] = k + 'ょ';
  }
  for (const [c, k] of [['sh', 'し'], ['sy', 'し'], ['ch', 'ち'], ['ty', 'ち'], ['cy', 'ち'], ['j', 'じ'], ['jy', 'じ'], ['zy', 'じ'], ['dy', 'ぢ']]) {
    const y = c.length === 2 && c[1] === 'y' ? 'y' : '';
    const base = y ? c[0] + 'y' : c;
    ROMA[base + 'a'] = k + 'ゃ'; ROMA[base + 'u'] = k + 'ゅ'; ROMA[base + 'o'] = k + 'ょ';
  }
  /** Convert romaji to hiragana. Returns null if any part is not valid romaji. */
  function romajiToKana(input) {
    const s = input.toLowerCase().replace(/[\s']/g, (m) => (m === "'" ? "'" : ''));
    let out = '';
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === "'") { i++; continue; }
      const next = s[i + 1];
      if (ch === 'n' && (next === undefined || next === "'" || !/[aiueoy]/.test(next))) {
        out += 'ん'; i++; continue;
      }
      if (next && ch === next && /[bcdfghjkmpqrstvwyz]/.test(ch)) { out += 'っ'; i++; continue; }
      if (ch === 't' && s.startsWith('tch', i)) { out += 'っ'; i++; continue; }
      let hit = false;
      for (let len = 3; len >= 1; len--) {
        const k = ROMA[s.substr(i, len)];
        if (k && s.substr(i, len).length === len) { out += k; i += len; hit = true; break; }
      }
      if (!hit) return null;
    }
    return out || null;
  }

  // ---------- conjugation ----------
  const ROWS = {
    u: 'うくぐすつぬぶむる', a: 'わかがさたなばまら', i: 'いきぎしちにびみり',
    e: 'えけげせてねべめれ', o: 'おこごそとのぼもろ',
  };
  const TE = ['って', 'いて', 'いで', 'して', 'って', 'んで', 'んで', 'んで', 'って'];
  const TA = ['った', 'いた', 'いだ', 'した', 'った', 'んだ', 'んだ', 'んだ', 'った'];

  /** Classify an entry's part-of-speech strings into an inflection class. */
  function inflectionClass(posList) {
    let cls = null;
    for (const p of posList) {
      if (/archaic/.test(p)) continue;
      if (/^Ichidan verb - kureru/.test(p)) return 'v1-s';
      if (/^Ichidan verb - zuru/.test(p)) cls = cls || 'vz';
      else if (/^Ichidan/.test(p)) return 'v1';
      else if (/Iku\/Yuku/.test(p)) return 'v5k-s';
      else if (/-aru special/.test(p)) return 'v5aru';
      else if (/'ru' ending \(irregular/.test(p)) return 'v5r-i';
      else if (/'u' ending \(special/.test(p)) return 'v5u-s';
      else if (/^Godan/.test(p)) return 'v5';
      else if (/^Kuru verb/.test(p)) return 'vk';
      else if (p === 'suru verb - included') return 'vs-i';
      else if (p === 'suru verb - special class') return 'vs-s';
      else if (/yoi\/ii class/.test(p)) return 'adj-ix';
      else if (p === 'adjective (keiyoushi)') cls = cls || 'adj-i';
      else if (/^noun or participle which takes/.test(p)) cls = cls || 'vs';
      else if (/^adjectival nouns/.test(p)) cls = cls || 'adj-na';
    }
    return cls;
  }

  function godan(stem, last, special) {
    const n = ROWS.u.indexOf(last);
    if (n < 0) return null;
    const a = ROWS.a[n], i = ROWS.i[n], e = ROWS.e[n], o = ROWS.o[n];
    let te = stem + TE[n], ta = stem + TA[n];
    if (special === 'v5k-s') { te = stem + 'って'; ta = stem + 'った'; }
    if (special === 'v5u-s') { te = stem + 'うて'; ta = stem + 'うた'; }
    const neg = special === 'v5r-i' ? stem.slice(0, -1) + 'ない' : stem + a + 'ない';
    const masuStem = special === 'v5aru' ? stem + 'い' : stem + i;
    return {
      dict: stem + last, masu: masuStem + 'ます', nai: neg, ta, te,
      potential: special === 'v5r-i' ? null : stem + e + 'る',
      passive: stem + a + 'れる', causative: stem + a + 'せる', causPass: stem + a + 'される',
      volitional: stem + o + 'う', imperative: special === 'v5aru' ? stem + 'い' : stem + e,
      ba: stem + e + 'ば', prohibitive: stem + last + 'な',
    };
  }

  /** Conjugate one written form. Returns {kind, forms} or null. */
  function conjugate(word, cls) {
    if (!word || !cls) return null;
    const last = word.slice(-1), stem = word.slice(0, -1);
    let f = null;
    if (cls === 'v1' || cls === 'v1-s' || cls === 'vz') {
      if (last !== 'る') return null;
      f = {
        dict: word, masu: stem + 'ます', nai: stem + 'ない', ta: stem + 'た', te: stem + 'て',
        potential: stem + 'られる', passive: stem + 'られる', causative: stem + 'させる',
        causPass: stem + 'させられる', volitional: stem + 'よう',
        imperative: cls === 'v1-s' ? stem : stem + 'ろ', ba: stem + 'れば', prohibitive: word + 'な',
      };
    } else if (cls === 'v5' || cls === 'v5k-s' || cls === 'v5aru' || cls === 'v5r-i' || cls === 'v5u-s') {
      f = godan(stem, last, cls);
    } else if (cls === 'vs' || cls === 'vs-i' || cls === 'vs-s') {
      let base = word;
      if (cls === 'vs') base = word;
      else if (word.endsWith('する')) base = word.slice(0, -2);
      else return null;
      if (cls === 'vs-s') {
        f = godan(base, 'す', null);
        f.dict = base + 'する'; f.prohibitive = base + 'するな'; f.ba = base + 'すれば';
        f.passive = base + 'される'; f.causative = base + 'させる';
      } else {
        f = {
          dict: base + 'する', masu: base + 'します', nai: base + 'しない', ta: base + 'した', te: base + 'して',
          potential: base + 'できる', passive: base + 'される', causative: base + 'させる',
          causPass: base + 'させられる', volitional: base + 'しよう', imperative: base + 'しろ',
          ba: base + 'すれば', prohibitive: base + 'するな',
        };
      }
    } else if (cls === 'vk') {
      let base, k;
      if (word.endsWith('来る')) { base = word.slice(0, -2); k = ['来', '来', '来']; }
      else if (word.endsWith('くる')) { base = word.slice(0, -2); k = ['こ', 'き', 'く']; }
      else return null;
      const [ko, ki, ku] = k;
      f = {
        dict: base + ku + 'る', masu: base + ki + 'ます', nai: base + ko + 'ない', ta: base + ki + 'た', te: base + ki + 'て',
        potential: base + ko + 'られる', passive: base + ko + 'られる', causative: base + ko + 'させる',
        causPass: base + ko + 'させられる', volitional: base + ko + 'よう', imperative: base + ko + 'い',
        ba: base + ku + 'れば', prohibitive: base + ku + 'るな',
      };
    } else if (cls === 'adj-i' || cls === 'adj-ix') {
      if (last !== 'い') return null;
      let s = stem;
      if (cls === 'adj-ix') {
        if (word.endsWith('いい')) s = word.slice(0, -2) + 'よ';
        else if (word.endsWith('良い')) s = word.slice(0, -1);
        else return null;
      }
      return {
        kind: 'adj',
        forms: {
          dict: word, polite: word + 'です', neg: s + 'くない', past: s + 'かった', pastNeg: s + 'くなかった',
          te: s + 'くて', adv: s + 'く', ba: s + 'ければ', noun: s + 'さ',
        },
      };
    } else if (cls === 'adj-na') {
      return {
        kind: 'na',
        forms: {
          dict: word + 'だ', polite: word + 'です', neg: word + 'じゃない', past: word + 'だった',
          pastNeg: word + 'じゃなかった', te: word + 'で', attr: word + 'な', adv: word + 'に',
        },
      };
    }
    return f ? { kind: 'verb', forms: f } : null;
  }

  // ---------- de-inflection ----------
  // Each rule: [inflected suffix, base suffix, type the inflected form behaves as, type of the base].
  // '' as the "behaves as" type means the suffix is a terminal form (た, て, ます ...).
  const RULES = [];
  const rule = (from, to, as, base) => RULES.push([from, to, as, base]);
  (function buildRules() {
    // suffixes that attach to the masu-stem
    const stemSuffixes = [
      ['ます', ''], ['ました', ''], ['ません', ''], ['ませんでした', ''], ['ましょう', ''], ['まして', ''],
      ['たい', 'adj'], ['たがる', 'v5'], ['なさい', ''], ['ながら', ''], ['すぎる', 'v1'], ['過ぎる', 'v1'],
      ['そう', ''], ['やすい', 'adj'], ['にくい', 'adj'], ['方', ''], ['', 'stem'],
    ];
    for (const [suf, as] of stemSuffixes) {
      if (suf) rule(suf, 'る', as, 'v1');
      for (let n = 0; n < 9; n++) rule(ROWS.i[n] + suf, ROWS.u[n], as, 'v5');
      rule('し' + suf, 'する', as, 'vs');
      rule('き' + suf, 'くる', as, 'vk');
      rule('来' + suf, '来る', as, 'vk');
    }
    // te / ta family
    const teTails = [['て', ''], ['た', ''], ['たら', ''], ['たり', ''], ['ても', ''], ['ては', ''], ['ちゃ', ''],
      ['ている', 'v1'], ['てる', 'v1'], ['ておく', 'v5'], ['とく', 'v5'], ['てしまう', 'v5'], ['ちゃう', 'v5'],
      ['てみる', 'v1'], ['てくる', 'vk'], ['ていく', 'v5'], ['てください', ''], ['てくれる', 'v1'],
      ['てもらう', 'v5'], ['てあげる', 'v1'], ['てある', 'v5'], ['てほしい', 'adj'], ['てから', '']];
    for (const [tail, as] of teTails) {
      rule(tail, 'る', as, 'v1');
      for (let n = 0; n < 9; n++) {
        const voiced = TE[n].endsWith('で');
        let t = tail;
        if (voiced) {
          t = tail.replace(/^て/, 'で').replace(/^た/, 'だ').replace(/^ちゃ/, 'じゃ').replace(/^とく/, 'どく');
        }
        rule(TE[n].slice(0, -1) + t, ROWS.u[n], as, 'v5');
      }
      rule('行っ' + tail, '行く', as, 'v5');
      rule('いっ' + tail, 'いく', as, 'v5');
      rule('し' + tail, 'する', as, 'vs');
      rule('き' + tail, 'くる', as, 'vk');
      rule('来' + tail, '来る', as, 'vk');
    }
    // negative
    for (const [suf, as] of [['ない', 'adj'], ['ず', ''], ['ずに', ''], ['ぬ', ''], ['ないで', ''], ['なきゃ', ''], ['ん', '']]) {
      rule(suf, 'る', as, 'v1');
      for (let n = 0; n < 9; n++) rule(ROWS.a[n] + suf, ROWS.u[n], as, 'v5');
      rule((suf === 'ず' || suf === 'ずに' || suf === 'ぬ' ? 'せ' : 'し') + suf, 'する', as, 'vs');
      rule('こ' + suf, 'くる', as, 'vk');
      rule('来' + suf, '来る', as, 'vk');
    }
    rule('ない', 'ある', 'adj', 'v5');
    // passive / potential / causative
    rule('られる', 'る', 'v1', 'v1');
    rule('れる', 'る', 'v1', 'v1'); // ら抜き
    rule('させる', 'る', 'v1', 'v1');
    rule('させられる', 'る', 'v1', 'v1');
    for (let n = 0; n < 9; n++) {
      rule(ROWS.a[n] + 'れる', ROWS.u[n], 'v1', 'v5');
      rule(ROWS.a[n] + 'せる', ROWS.u[n], 'v1', 'v5');
      rule(ROWS.a[n] + 'される', ROWS.u[n], 'v1', 'v5');
      rule(ROWS.a[n] + 'せられる', ROWS.u[n], 'v1', 'v5');
      rule(ROWS.e[n] + 'る', ROWS.u[n], 'v1', 'v5');
      rule(ROWS.o[n] + 'う', ROWS.u[n], '', 'v5');
      rule(ROWS.e[n], ROWS.u[n], '', 'v5');
      rule(ROWS.e[n] + 'ば', ROWS.u[n], '', 'v5');
    }
    for (const [from, as] of [['される', 'v1'], ['させる', 'v1'], ['させられる', 'v1'], ['できる', 'v1'],
      ['しよう', ''], ['しろ', ''], ['せよ', ''], ['すれば', ''], ['するな', '']]) rule(from, 'する', as, 'vs');
    for (const k of ['こ', '来']) {
      rule(k + 'られる', k === 'こ' ? 'くる' : '来る', 'v1', 'vk');
      rule(k + 'させる', k === 'こ' ? 'くる' : '来る', 'v1', 'vk');
      rule(k + 'よう', k === 'こ' ? 'くる' : '来る', '', 'vk');
      rule(k + 'い', k === 'こ' ? 'くる' : '来る', '', 'vk');
    }
    rule('くれば', 'くる', '', 'vk'); rule('来れば', '来る', '', 'vk');
    rule('よう', 'る', '', 'v1'); rule('ろ', 'る', '', 'v1'); rule('れば', 'る', '', 'v1');
    rule('な', '', '', 'verb');
    // noun + する
    rule('する', '', 'vs', 'vsn');
    // i-adjectives
    for (const [suf, as] of [['かった', ''], ['くない', 'adj'], ['くて', ''], ['く', ''], ['ければ', ''], ['さ', ''],
      ['そう', ''], ['すぎる', 'v1'], ['過ぎる', 'v1'], ['かったら', ''], ['かったり', ''], ['くなる', 'v5'], ['です', '']]) {
      rule(suf, suf === 'です' ? '' : 'い', as, 'adj');
    }
    rule('よかった', 'いい', '', 'adj'); rule('よくない', 'いい', 'adj', 'adj'); rule('よくて', 'いい', '', 'adj'); rule('よく', 'いい', '', 'adj');
    // copula on nouns / na-adjectives
    for (const suf of ['です', 'だ', 'でした', 'だった', 'じゃない', 'ではない', 'じゃありません', 'ではありません',
      'でしょう', 'だろう', 'なら', 'な', 'に', 'で', 'の', 'を', 'は', 'が', 'も', 'へ', 'と']) rule(suf, '', '', 'noun');
  })();

  const BY_LAST = new Map();
  for (const r of RULES) {
    if (!r[0]) continue;
    const key = r[0].slice(-1);
    if (!BY_LAST.has(key)) BY_LAST.set(key, []);
    BY_LAST.get(key).push(r);
  }

  /** All possible base forms of `word`: [{text, type, steps}] (the word itself is not included). */
  function deinflect(word) {
    const seen = new Map();
    const queue = [{ text: word, type: '', steps: 0 }];
    const out = [];
    while (queue.length) {
      const cur = queue.shift();
      if (cur.steps >= 4) continue;
      const rules = BY_LAST.get(cur.text.slice(-1)) || [];
      for (const [from, to, as, base] of rules) {
        if (cur.text.length <= from.length - to.length || !cur.text.endsWith(from)) continue;
        // first step: anything goes; later steps: the suffix must behave as the type we expect
        if (cur.steps > 0 && as !== cur.type) continue;
        if (cur.steps > 0 && as === '') continue;
        const text = cur.text.slice(0, cur.text.length - from.length) + to;
        if (!text) continue;
        const key = text + '|' + base;
        if (seen.has(key)) continue;
        seen.set(key, 1);
        const cand = { text, type: base, steps: cur.steps + 1 };
        out.push(cand);
        if (base !== 'noun' && base !== 'vsn' && base !== 'verb') queue.push(cand);
      }
    }
    return out;
  }

  /** Does an entry with this inflection class satisfy a de-inflection base type? */
  function classMatches(cls, type, posList) {
    if (type === 'noun') return posList.some((p) => /noun|adjectival nouns|pronoun|adverb/.test(p));
    if (type === 'vsn') return posList.some((p) => /takes the aux. verb suru/.test(p));
    if (type === 'verb') return posList.some((p) => /verb/.test(p) && !/noun/.test(p));
    if (!cls) return false;
    if (type === 'v1') return cls === 'v1' || cls === 'v1-s' || cls === 'vz';
    if (type === 'v5') return cls.startsWith('v5');
    if (type === 'vs') return cls === 'vs-i' || cls === 'vs-s';
    if (type === 'vk') return cls === 'vk';
    if (type === 'adj') return cls === 'adj-i' || cls === 'adj-ix';
    return false;
  }

  root.JP = {
    toHiragana, toKatakana, hasKana, hasKanji, isJapanese, kanjiIn,
    romajiToKana, inflectionClass, conjugate, deinflect, classMatches,
  };
})(typeof self !== 'undefined' ? self : this);
