/* Chinese labels for JMdict tags.  Keys are the English tag strings in data/meta.json. */
(function (root) {
  'use strict';

  // [short label, kind]   kind: p = part of speech, m = usage, f = field, d = dialect, i = spelling note
  const T = {
    'unclassified': ['未分类', 'p'],
    'noun (common) (futsuumeishi)': ['名词', 'p'],
    'expressions (phrases, clauses, etc.)': ['惯用表达', 'p'],
    'adjectival nouns or quasi-adjectives (keiyodoshi)': ['な形容词', 'p'],
    "nouns which may take the genitive case particle 'no'": ['の形容词', 'p'],
    'adjective (keiyoushi)': ['い形容词', 'p'],
    'adjective (keiyoushi) - yoi/ii class': ['い形容词（いい/よい）', 'p'],
    "'taru' adjective": ['たる形容词', 'p'],
    "'ku' adjective (archaic)": ['ク活用形容词（古）', 'p'],
    "'shiku' adjective (archaic)": ['シク活用形容词（古）', 'p'],
    'archaic/formal form of na-adjective': ['なり形容词（古）', 'p'],
    'auxiliary adjective': ['补助形容词', 'p'],
    'pre-noun adjectival (rentaishi)': ['连体词', 'p'],
    'noun or verb acting prenominally': ['连体修饰', 'p'],
    'pronoun': ['代词', 'p'],
    'adverb (fukushi)': ['副词', 'p'],
    "adverb taking the 'to' particle": ['と副词', 'p'],
    'noun or participle which takes the aux. verb suru': ['する动词', 'p'],
    'interjection (kandoushi)': ['感叹词', 'p'],
    'conjunction': ['接续词', 'p'],
    'particle': ['助词', 'p'],
    'auxiliary verb': ['助动词', 'p'],
    'auxiliary': ['助词/助动词', 'p'],
    'copula': ['系动词', 'p'],
    'counter': ['量词', 'p'],
    'numeric': ['数词', 'p'],
    'prefix': ['接头词', 'p'],
    'suffix': ['接尾词', 'p'],
    'noun, used as a suffix': ['名词（作接尾）', 'p'],
    'noun, used as a prefix': ['名词（作接头）', 'p'],
    'transitive verb': ['他动词', 'p'],
    'intransitive verb': ['自动词', 'p'],
    'Ichidan verb': ['一段动词', 'p'],
    'Ichidan verb - zuru verb (alternative form of -jiru verbs)': ['一段动词（ずる）', 'p'],
    'Ichidan verb - kureru special class': ['一段动词（くれる特殊）', 'p'],
    'Godan verb - Iku/Yuku special class': ['五段动词（行く特殊）', 'p'],
    'Godan verb - -aru special class': ['五段动词（ある特殊）', 'p'],
    "Godan verb with 'ru' ending (irregular verb)": ['五段动词（る・不规则）', 'p'],
    "Godan verb with 'u' ending (special class)": ['五段动词（う・特殊）', 'p'],
    'Kuru verb - special class': ['カ变动词（来る）', 'p'],
    'suru verb - included': ['サ变动词', 'p'],
    'suru verb - special class': ['サ变动词（特殊）', 'p'],
    'su verb - precursor to the modern suru': ['す动词（する的古形）', 'p'],
    'irregular nu verb': ['ナ变动词', 'p'],
    'irregular ru verb, plain form ends with -ri': ['ラ变动词', 'p'],
    'verb unspecified': ['动词', 'p'],

    'word usually written using kana alone': ['通常写假名', 'm'],
    'abbreviation': ['缩略语', 'm'],
    'archaism': ['古语', 'm'],
    'yojijukugo': ['四字熟语', 'm'],
    'obscure term': ['生僻', 'm'],
    'onomatopoeic or mimetic word': ['拟声拟态词', 'm'],
    'colloquialism': ['口语', 'm'],
    'slang': ['俚语', 'm'],
    'idiomatic expression': ['惯用语', 'm'],
    'proverb': ['谚语', 'm'],
    'honorific or respectful (sonkeigo) language': ['尊敬语', 'm'],
    'obsolete term': ['废语', 'm'],
    'derogatory': ['贬义', 'm'],
    'polite (teineigo) language': ['郑重语', 'm'],
    'humble (kenjougo) language': ['谦让语', 'm'],
    'sensitive': ['敏感词', 'm'],
    'historical term': ['历史用语', 'm'],
    'jocular, humorous term': ['戏谑语', 'm'],
    'vulgar expression or word': ['粗俗语', 'm'],
    'familiar language': ['亲昵语', 'm'],
    "children's language": ['儿童用语', 'm'],
    'Internet slang': ['网络用语', 'm'],
    'dated term': ['旧式说法', 'm'],
    'literary or formal term': ['书面语', 'm'],
    'female term or language': ['女性用语', 'm'],
    'male term or language': ['男性用语', 'm'],
    'poetical term': ['诗语', 'm'],
    'manga slang': ['漫画用语', 'm'],
    'quotation': ['引语', 'm'],
    'rare': ['罕用', 'm'],
    'full name of a particular person': ['人名', 'm'],
    'place name': ['地名', 'm'],
    'work of art, literature, music, etc. name': ['作品名', 'm'],

    'computing': ['计算机', 'f'], 'Buddhism': ['佛教', 'f'], 'mathematics': ['数学', 'f'],
    'food, cooking': ['饮食', 'f'], 'medicine': ['医学', 'f'], 'linguistics': ['语言学', 'f'],
    'music': ['音乐', 'f'], 'sumo': ['相扑', 'f'], 'physics': ['物理', 'f'], 'sports': ['体育', 'f'],
    'astronomy': ['天文', 'f'], 'baseball': ['棒球', 'f'], 'chemistry': ['化学', 'f'], 'law': ['法律', 'f'],
    'biology': ['生物', 'f'], 'mahjong': ['麻将', 'f'], 'anatomy': ['解剖', 'f'], 'geology': ['地质', 'f'],
    'martial arts': ['武术', 'f'], 'finance': ['金融', 'f'], 'botany': ['植物', 'f'], 'military': ['军事', 'f'],
    'hanafuda': ['花札', 'f'], 'Shinto': ['神道', 'f'], 'shogi': ['将棋', 'f'], 'Christianity': ['基督教', 'f'],
    'architecture, building': ['建筑', 'f'], 'economics': ['经济', 'f'], 'engineering': ['工程', 'f'],
    'trademark': ['商标', 'f'], 'business': ['商务', 'f'], 'zoology': ['动物', 'f'], 'philosophy': ['哲学', 'f'],
    'physiology': ['生理', 'f'], 'video game': ['电子游戏', 'f'], 'biochemistry': ['生化', 'f'],
    'horse-racing': ['赛马', 'f'], 'art, aesthetics': ['艺术', 'f'], 'pharmacy': ['药学', 'f'],
    'aviation': ['航空', 'f'], 'electricity, elec. eng.': ['电气', 'f'], 'genetics': ['遗传', 'f'],
    'grammar': ['语法', 'f'], 'photography': ['摄影', 'f'], 'statistics': ['统计', 'f'], 'geometry': ['几何', 'f'],
    'psychology, psychiatry': ['心理', 'f'], 'entomology': ['昆虫', 'f'], 'archeology': ['考古', 'f'],
    'electronics': ['电子', 'f'], 'logic': ['逻辑', 'f'], 'printing': ['印刷', 'f'], 'audio-visual': ['视听', 'f'],
    'crystallography': ['晶体学', 'f'], 'ecology': ['生态', 'f'], 'mechanical engineering': ['机械', 'f'],
    'ornithology': ['鸟类', 'f'], 'telecommunications': ['通信', 'f'],

    'Kansai-ben': ['关西方言', 'd'], 'Ryuukyuu-ben': ['琉球方言', 'd'], 'Osaka-ben': ['大阪方言', 'd'],
    'Kantou-ben': ['关东方言', 'd'], 'Kyoto-ben': ['京都方言', 'd'], 'Touhoku-ben': ['东北方言', 'd'],
    'Hokkaido-ben': ['北海道方言', 'd'], 'Kyuushuu-ben': ['九州方言', 'd'], 'Tosa-ben': ['土佐方言', 'd'],
    'Tsugaru-ben': ['津轻方言', 'd'], 'Nagano-ben': ['长野方言', 'd'],

    'irregular okurigana usage': ['送假名不规范', 'i'],
    'word containing out-dated kanji': ['旧字体', 'i'],
    'word containing irregular kanji usage': ['汉字用法不规范', 'i'],
    'ateji (phonetic) reading': ['当て字', 'i'],
    'word containing irregular kana usage': ['假名用法不规范', 'i'],
    'out-dated or obsolete kana usage': ['旧假名', 'i'],
    'gikun (meaning as reading) or jukujikun (special kanji reading)': ['熟字训', 'i'],
  };

  const ENDING = { u: 'う', ku: 'く', gu: 'ぐ', su: 'す', tsu: 'つ', nu: 'ぬ', bu: 'ぶ', mu: 'む', ru: 'る',
    'hu/fu': 'ふ', yu: 'ゆ', dzu: 'づ', zu: 'ず' };

  function label(tag) {
    if (T[tag]) return T[tag][0];
    let m = /^Godan verb with '([^']+)' ending$/.exec(tag);
    if (m) return '五段动词（' + (ENDING[m[1]] || m[1]) + '）';
    m = /^Yodan verb with '([^']+)' ending/.exec(tag);
    if (m) return '四段动词（' + (ENDING[m[1]] || m[1]) + '・古）';
    m = /^Nidan verb(?: \((upper|lower) class\))? with '([^']+)' ending/.exec(tag);
    if (m) return (m[1] === 'upper' ? '上' : m[1] === 'lower' ? '下' : '') + '二段动词（' + (ENDING[m[2]] || m[2]) + '・古）';
    return tag;
  }
  function kind(tag) {
    if (T[tag]) return T[tag][1];
    return /verb|adjective/.test(tag) ? 'p' : 'm';
  }

  const LANG = {
    eng: '英语', ger: '德语', fre: '法语', por: '葡萄牙语', spa: '西班牙语', ita: '意大利语', dut: '荷兰语',
    rus: '俄语', chi: '汉语', kor: '韩语', lat: '拉丁语', grc: '古希腊语', gre: '希腊语', san: '梵语',
    ain: '阿伊努语', ara: '阿拉伯语', tha: '泰语', vie: '越南语', may: '马来语', ind: '印尼语', hin: '印地语',
    heb: '希伯来语', tur: '土耳其语', swe: '瑞典语', nor: '挪威语', dan: '丹麦语', fin: '芬兰语', pol: '波兰语',
    cze: '捷克语', hun: '匈牙利语', per: '波斯语', tib: '藏语', mon: '蒙古语', haw: '夏威夷语', tgl: '他加禄语',
    khm: '高棉语', bur: '缅甸语', urd: '乌尔都语', tam: '泰米尔语', epo: '世界语', afr: '南非语', swa: '斯瓦希里语',
    mao: '毛利语', pol_: '波兰语', scr: '克罗地亚语', rum: '罗马尼亚语', bul: '保加利亚语', yid: '意第绪语',
    ice: '冰岛语', lit: '立陶宛语', est: '爱沙尼亚语', slv: '斯洛文尼亚语', glg: '加利西亚语', amh: '阿姆哈拉语',
    alg: '阿尔冈昆语', arn: '马普切语', bnt: '班图语', chn: '奇努克语', fil: '菲律宾语', geo: '格鲁吉亚语',
    mal: '马拉雅拉姆语', mnc: '满语', mol: '摩尔多瓦语', som: '索马里语', tah: '塔希提语', kur: '库尔德语',
  };

  root.TAGS = { label, kind, lang: (code) => LANG[code] || code };
})(typeof self !== 'undefined' ? self : this);
