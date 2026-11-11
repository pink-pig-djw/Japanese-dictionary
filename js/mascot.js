/* The mascot: an orange-haired cat-eared girl.
 *
 * This file draws a simple PLACEHOLDER in SVG.  To use real artwork instead,
 * drop image files (png / webp / gif) into assets/mascot/ and list them in
 * IMAGES below -- any mood left as null keeps the placeholder drawing.
 * Recommended: square, transparent background, at least 512x512.
 */
(function (root) {
  'use strict';

  const IMAGES = {
    idle: null,    // e.g. 'assets/mascot/idle.png'   -- home page greeting
    happy: null,   // e.g. 'assets/mascot/happy.gif'  -- word saved, empty states with good news
    think: null,   // searching / loading
    sorry: null,   // nothing found, errors
    sleep: null,   // empty word book
  };

  const EYES = {
    idle: '<ellipse cx="44" cy="68" rx="6.500" ry="8" fill="#7a4a2a"/><ellipse cx="76" cy="68" rx="6.500" ry="8" fill="#7a4a2a"/>' +
      '<circle cx="46.500" cy="64.500" r="2.600" fill="#fff"/><circle cx="78.500" cy="64.500" r="2.600" fill="#fff"/>' +
      '<circle cx="42" cy="71" r="1.200" fill="#fff"/><circle cx="74" cy="71" r="1.200" fill="#fff"/>',
    happy: '<path d="M37 70q7-9 14 0M69 70q7-9 14 0" fill="none" stroke="#7a4a2a" stroke-width="3" stroke-linecap="round"/>',
    think: '<ellipse cx="46" cy="66" rx="6" ry="7.500" fill="#7a4a2a"/><ellipse cx="78" cy="66" rx="6" ry="7.500" fill="#7a4a2a"/>' +
      '<circle cx="48.500" cy="62.500" r="2.400" fill="#fff"/><circle cx="80.500" cy="62.500" r="2.400" fill="#fff"/>' +
      '<path d="M69 55q7-4 14 0" fill="none" stroke="#c9631a" stroke-width="2.200" stroke-linecap="round"/>',
    sorry: '<path d="M38 64l11 5-11 5M82 64l-11 5 11 5" fill="none" stroke="#7a4a2a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M88 74q3 5 0 8q-3-3 0-8" fill="#8fd3ff"/>',
    sleep: '<path d="M37 69q7 5 14 0M69 69q7 5 14 0" fill="none" stroke="#7a4a2a" stroke-width="3" stroke-linecap="round"/>' +
      '<text x="92" y="40" font-size="13" font-weight="700" fill="#b9a4e8">z</text><text x="101" y="30" font-size="9" font-weight="700" fill="#b9a4e8">z</text>',
  };
  const MOUTH = {
    idle: '<path d="M54 82q3 4 6 0q3 4 6 0" fill="none" stroke="#c0564b" stroke-width="2.200" stroke-linecap="round"/>',
    happy: '<path d="M52 80q8 11 16 0z" fill="#e9736b" stroke="#c0564b" stroke-width="1.500" stroke-linejoin="round"/>',
    think: '<circle cx="62" cy="83" r="2.400" fill="#c0564b"/>',
    sorry: '<path d="M54 85q6-5 12 0" fill="none" stroke="#c0564b" stroke-width="2.200" stroke-linecap="round"/>',
    sleep: '<ellipse cx="60" cy="84" rx="3" ry="2.200" fill="#c0564b"/>',
  };

  function svg(mood) {
    const m = EYES[mood] ? mood : 'idle';
    return '<svg viewBox="0 0 120 120" role="img" aria-label="吉祥物">' +
      // back hair
      '<path d="M18 74C10 36 34 16 60 16s50 20 42 58c-2 14-6 26-12 34H30c-6-8-10-20-12-34z" fill="#ff9a3c"/>' +
      // ears
      '<path d="M22 44L20 8l30 18zM98 44l2-36-30 18z" fill="#ff9a3c"/>' +
      '<path d="M27 36L26 18l15 9zM93 36l1-18-15 9z" fill="#ffc9d6"/>' +
      // face
      '<ellipse cx="60" cy="70" rx="33" ry="30" fill="#ffe9db"/>' +
      // fringe
      '<path d="M26 66C22 36 42 24 60 24s38 12 34 42c-6-10-12-16-20-20c0 6-2 10-6 14c-2-6-6-10-12-14c-4 8-10 14-18 16c2-6 2-10 0-14c-6 4-10 10-12 18z" fill="#ffab52"/>' +
      '<path d="M48 26q10-8 22 0" fill="none" stroke="#ffd29a" stroke-width="3" stroke-linecap="round" opacity=".8"/>' +
      // blush
      '<ellipse cx="38" cy="80" rx="6" ry="3.500" fill="#ffb3c1" opacity=".75"/><ellipse cx="82" cy="80" rx="6" ry="3.500" fill="#ffb3c1" opacity=".75"/>' +
      EYES[m] + MOUTH[m] +
      // hair clip
      '<path d="M84 40l3.200 3.200 4.400-.9-2 4 2.200 3.900-4.500-.6-3 3.300-.8-4.400-4.100-1.900 4-2z" fill="#ff7aa8"/>' +
      '</svg>';
  }

  /** HTML for the mascot in a given mood. */
  function html(mood, size) {
    const cls = 'mascot' + (size ? ' mascot-' + size : '');
    const src = IMAGES[mood] || (mood !== 'idle' && IMAGES.idle) || null;
    if (src) return '<span class="' + cls + '"><img src="' + src + '" alt="吉祥物" decoding="async"></span>';
    return '<span class="' + cls + '">' + svg(mood) + '</span>';
  }

  root.Mascot = { html };
})(this);
