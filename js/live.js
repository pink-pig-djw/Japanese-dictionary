/* Brings a still mascot picture to life: breathing, a slow head sway, swaying hair
 * tips, ear twitches and blinking.  One WebGL quad per picture; the fragment shader
 * bends the image a little every frame.  Falls back to the plain <img> when WebGL
 * is missing, when the user prefers reduced motion, or when the setting is off.
 *
 * All positions are fractions of the FULL bust picture (x right, y down).
 * They match artwork framed like assets/mascot/idle.webp; pass a different rig
 * for a mood whose face sits elsewhere (see RIGS in mascot.js).
 */
(function (root) {
  'use strict';

  const PAD = 0.07;   // transparent margin around the picture so ears and hair can move past its edge

  const VERT = 'attribute vec2 aPos; varying vec2 vUv;' +
    'void main(){ vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5); gl_Position = vec4(aPos, 0., 1.); }';

  const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uT;        // seconds
uniform float uBlink;    // 0 open .. 1 closed
uniform vec2 uTwitch;    // current twitch angle of the left / right ear
uniform vec4 uEyes;      // left xy, right xy
uniform vec4 uEars;      // left xy, right xy (middle of each ear)
uniform vec4 uBox;       // part of the full picture this texture holds: left, top, width, height
uniform float uPad;

vec2 rot(vec2 p, vec2 c, float a) {
  vec2 d = p - c; float s = sin(a), k = cos(a);
  return c + vec2(d.x * k - d.y * s, d.x * s + d.y * k);
}
vec2 ear(vec2 p, vec2 e, float angle, float side) {
  float w = exp(-pow((p.x - e.x) / 0.13, 2.0)) * (1.0 - smoothstep(0.06, 0.25, p.y));
  return rot(p, vec2(e.x + side * 0.03, 0.25), -angle * w);
}
vec2 blink(vec2 p, vec2 e) {
  vec2 d = (p - e) / vec2(0.075, 0.05);
  float lid = e.y + 0.03;                                   // the lower lash line stays put
  float w = exp(-dot(d, d)) * smoothstep(lid + 0.006, lid - 0.012, p.y);
  p.y = lid + (p.y - lid) / (1.0 - 0.86 * uBlink * w);      // pull the upper lid down to it
  return p;
}
void main() {
  // where this pixel sits in the full picture
  vec2 p = uBox.xy + (vUv - uPad) / (1.0 - 2.0 * uPad) * uBox.zw;

  // each step is the inverse of a small movement: we ask "which point of the still picture ends up here?"
  float breath = sin(uT * 1.7);
  float head = 1.0 - smoothstep(0.60, 0.78, p.y);
  float sway = 0.020 * sin(uT * 0.8) + 0.008 * sin(uT * 1.9 + 1.0);
  p = rot(p, vec2(0.5, 0.72), -sway * head);                // head tilts around the neck
  p.y += 0.006 * breath * head;                             // and rises with each breath
  float body = smoothstep(0.66, 0.86, p.y);
  p.x = 0.5 + (p.x - 0.5) / (1.0 + 0.014 * breath * body);  // chest widens a touch
  p.y += 0.004 * breath * body;

  float side = smoothstep(0.20, 0.34, abs(p.x - 0.5));
  float tips = smoothstep(0.40, 0.62, p.y) * (1.0 - smoothstep(0.70, 0.80, p.y));
  p.x -= 0.011 * sin(uT * 1.5 - p.y * 7.0) * side * tips;   // hair tips trail behind

  p = ear(p, uEars.xy, uTwitch.x, 1.0);
  p = ear(p, uEars.zw, -uTwitch.y, -1.0);
  p = blink(p, uEyes.xy);
  p = blink(p, uEyes.zw);

  vec2 uv = (p - uBox.xy) / uBox.zw;
  vec2 edge = smoothstep(vec2(0.0), vec2(0.004), uv) * smoothstep(vec2(0.0), vec2(0.004), 1.0 - uv);
  // the picture's own bottom edge is a straight cut, so it may run off the canvas instead of fading
  float inside = edge.x * (uv.y > 0.5 ? step(uv.y, 1.0) : edge.y);
  gl_FragColor = texture2D(uTex, clamp(uv, 0.0, 1.0)) * inside;
}`;

  const DEFAULT_RIG = {
    eyes: [0.392, 0.418, 0.612, 0.418],
    ears: [0.27, 0.12, 0.73, 0.12],
    blink: true,
  };
  const FULL = [0, 0, 1, 1];

  const live = new Set();
  let running = false;
  let enabled = true;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)');

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  function start(img, opts) {
    const holder = img.parentElement;
    const canvas = document.createElement('canvas');
    canvas.className = 'live-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) return null;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const rig = Object.assign({}, DEFAULT_RIG, opts && opts.rig);
    const box = (opts && opts.box) || FULL;
    const u = (name) => gl.getUniformLocation(prog, name);
    gl.uniform4fv(u('uEyes'), rig.eyes);
    gl.uniform4fv(u('uEars'), rig.ears);
    gl.uniform4f(u('uBox'), box[0], box[1], box[2] - box[0], box[3] - box[1]);
    gl.uniform1f(u('uPad'), PAD);

    const now = performance.now() / 1000;
    const inst = {
      canvas, gl, img, holder, rig,
      uT: u('uT'), uBlink: u('uBlink'), uTwitch: u('uTwitch'),
      phase: Math.random() * 20,
      nextBlink: now + 1 + Math.random() * 2, blinkAt: -9, blinks: 1,
      nextTwitch: now + 2 + Math.random() * 3, twitchAt: -9, twitchEar: 0,
      size: 0, drawn: false,
    };
    holder.append(canvas);
    live.add(inst);
    if (!running) { running = true; requestAnimationFrame(frame); }
    return inst;
  }

  function stop(inst) {
    live.delete(inst);
    inst.img.classList.remove('live-on');
    inst.canvas.remove();
    const lose = inst.gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }

  function frame(ms) {
    const t = ms / 1000;
    for (const inst of [...live]) {
      if (!inst.canvas.isConnected || !enabled) { stop(inst); continue; }
      const rect = inst.img.getBoundingClientRect();
      if (rect.width < 2 || rect.bottom < 0 || rect.top > innerHeight) continue;   // hidden or scrolled away
      const { gl, canvas } = inst;
      const px = Math.round(rect.width / (1 - 2 * PAD) * Math.min(devicePixelRatio || 1, 2));
      if (px !== inst.size) { inst.size = canvas.width = canvas.height = px; gl.viewport(0, 0, px, px); }

      // blink: quick close, slower open; now and then a double blink
      if (inst.rig.blink && t > inst.nextBlink) {
        inst.blinkAt = t;
        inst.blinks = Math.random() < 0.2 ? 2 : 1;
        inst.nextBlink = t + 2.4 + Math.random() * 3.6;
      }
      let b = 0;
      const since = t - inst.blinkAt;
      if (since < 0.22 * inst.blinks) {
        const k = (since % 0.22) / 0.22;
        b = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
        b = b * b * (3 - 2 * b);
      }
      // ear twitch: a short damped flick of one ear
      if (t > inst.nextTwitch) {
        inst.twitchAt = t;
        inst.twitchEar = Math.random() < 0.5 ? 0 : 1;
        inst.nextTwitch = t + 3 + Math.random() * 5;
      }
      let tw = 0;
      const k2 = (t - inst.twitchAt) / 0.55;
      if (k2 < 1) tw = 0.2 * Math.sin(k2 * Math.PI * 3) * (1 - k2);

      gl.uniform1f(inst.uT, t + inst.phase);
      gl.uniform1f(inst.uBlink, b);
      gl.uniform2f(inst.uTwitch, inst.twitchEar ? 0 : tw, inst.twitchEar ? tw : 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!inst.drawn) { inst.drawn = true; inst.img.classList.add('live-on'); }   // hide the still picture only once the canvas shows
    }
    if (live.size) requestAnimationFrame(frame); else running = false;
  }

  /** Animate every not-yet-animated mascot picture inside `el`. */
  function animate(el) {
    if (!enabled || (reduced && reduced.matches)) return;
    for (const img of el.querySelectorAll('img[data-live]:not([data-live-started])')) {
      img.dataset.liveStarted = '1';
      const go = () => {
        if (!img.isConnected) return;
        try {
          start(img, { box: img.dataset.box ? img.dataset.box.split(',').map(Number) : null, rig: img.dataset.rig ? JSON.parse(img.dataset.rig) : null });
        } catch (e) { /* no WebGL: the still picture stays */ }
      };
      if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
    }
  }

  function setEnabled(on) {
    enabled = on;
    if (!on) { for (const inst of [...live]) stop(inst); for (const img of document.querySelectorAll('[data-live-started]')) delete img.dataset.liveStarted; }
  }

  root.Live = { animate, setEnabled, PAD };
})(this);
