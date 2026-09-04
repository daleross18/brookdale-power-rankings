/* ============================================================================
   app.js — The Brookdale League · 2026 Preseason Power Rankings
   Vanilla ES2020, one IIFE, no globals beyond window.BROOKDALE / WRITEUPS / HISTORY.

   Layout of this file:
     1. data guards + helpers (el, fmt, lpad, firstNameOf)
     2. persistence  (localStorage 'brookdale.read.2026', all access in try/catch)
     3. anim registry (every timer / rAF / listener of the CURRENT VIEW; cancelAnimations()
        wipes them before a new view renders; finishers make skip idempotent)
     4. effects       (typewriter, scramble/decrypt reveal, glitch loop, flicker-in, Seq sequencer)
     5. chrome        (pane with title bar + dots, box-drawing frames, tables)
     6. matrix rain   (one canvas, ~24fps, DPR aware, pauses when hidden)
     7. boot sequence (kernel lines → bar → typed `import …` + Enter; always skippable, 9 s watchdog)
     8. views         (list #/ with the one-shot reverse-order decoy reveal, team detail #/t/<slug>, SEASON_SIM.exe #/sim
                      (body from sim.js → window.SIM.mount, destroyed centrally), league intel #/intel)
     9. status bar    (tmux-like: path · fake net log · clock · READ n/12) + the audio deck's --deck-h padding hook
    10. router + init
   All text is inserted with textContent / createElement — never innerHTML, so emoji, quotes and apostrophes are safe.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- 1. data */
  const DATA = window.BROOKDALE || { teams: [] };
  const WRITEUPS = window.WRITEUPS || {};
  const HISTORY = window.HISTORY || { managers: {}, seasons: [], champions: [], departedManagers: [] };
  const TEAMS = (DATA.teams || []).slice().sort((a, b) => a.rank - b.rank);
  const SEASON = DATA.season || 2026;
  const LEAGUE_ID = DATA.leagueId || '?';
  const STORE_KEY = 'brookdale.read.2026';
  const INTEL_ID = 'intel';
  const SIM_ID = 'sim';                       // SEASON_SIM.exe → #/sim (module sim.js → window.SIM)
  const TOTAL_FILES = TEAMS.length + 2;       // 10 team files + SEASON_SIM.exe + LEAGUE_INTEL.log = 12
  const HOME_PATH = '~/power-rankings/' + SEASON;
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const GLYPHS = '!@#$%&*<>?/\\|[]{}=+-_~^01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const chars = (s) => Array.from(String(s == null ? '' : s));
  const firstNameOf = (m) => String(m || '').trim().split(/\s+/)[0] || '';
  const lpad = (s, n) => { s = String(s); while (chars(s).length < n) s = ' ' + s; return s; };
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => (isNum(v) ? v.toFixed(d == null ? 0 : d) : '—');
  const nz = (v) => (v == null || v === '' ? '—' : String(v));
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][Math.min(n % 10, 4)] || 'th');
  const baseName = (t) => String(t.file || t.slug || '').replace(/^\d+_/, '').replace(/\.rank$/i, '');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /** el(tag, attrs, ...children) — attrs: {class, text, title, data:{}, on:{}, attr:{}} ; children: nodes | strings | arrays | null */
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'data') for (const d of Object.keys(v)) node.dataset[d] = v[d];
        else if (k === 'on') for (const e of Object.keys(v)) node.addEventListener(e, v[e]);
        else if (k === 'attr') for (const a of Object.keys(v)) node.setAttribute(a, v[a]);
        else node.setAttribute(k, v);
      }
    }
    append(node, children);
    return node;
  }
  function append(node, children) {
    for (const c of children) {
      if (c == null || c === false) continue;
      if (Array.isArray(c)) append(node, c);
      else node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }
  const span = (cls, text) => el('span', { class: cls, text: text });

  /* --------------------------------------------------------- 2. persistence */
  const store = {
    list() {
      try { const v = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; }
      catch (e) { return []; }
    },
    save(arr) { try { localStorage.setItem(STORE_KEY, JSON.stringify(arr)); } catch (e) { /* private mode / quota — ignore */ } },
    isRead(id) { return store.list().indexOf(id) !== -1; },
    markRead(id) { const l = store.list(); if (l.indexOf(id) === -1) { l.push(id); store.save(l); } },
    reset() { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } },
    count() { const l = store.list(); return TEAMS.filter((t) => l.indexOf(t.slug) !== -1).length + (l.indexOf(INTEL_ID) !== -1 ? 1 : 0) + (l.indexOf(SIM_ID) !== -1 ? 1 : 0); }
  };

  /* ------------------------------------------------------ 3. anim registry */
  const anim = {
    gen: 0,                 // bumped on cancel; rAF loops compare against it and bail
    timers: new Set(),
    intervals: new Set(),
    listeners: [],
    finishers: new Set(),
    timeout(fn, ms) {
      const id = setTimeout(() => { anim.timers.delete(id); fn(); }, REDUCED ? 0 : ms);
      anim.timers.add(id); return id;
    },
    interval(fn, ms) { const id = setInterval(fn, ms); anim.intervals.add(id); return id; },
    on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); anim.listeners.push([target, ev, fn, opts]); },
    finisher(fn) { anim.finishers.add(fn); return fn; },
    finishAll() {   // drains until empty so finishers registered DURING the drain (chained typewriters) also finish
      let guard = 0;
      while (anim.finishers.size && guard++ < 2000) {
        const f = anim.finishers.values().next().value; anim.finishers.delete(f);
        try { f(); } catch (e) { console.error(e); }
      }
      anim.finishers.clear();
    },
    cancelAll() {
      anim.gen++;
      for (const id of anim.timers) clearTimeout(id);
      for (const id of anim.intervals) clearInterval(id);
      anim.timers.clear(); anim.intervals.clear();
      for (const [t, e, f, o] of anim.listeners) t.removeEventListener(e, f, o);
      anim.listeners.length = 0;
      anim.finishers.clear();
    }
  };
  /** Handle returned by window.SIM.mount() while #/sim is open — destroyed centrally so its timers and its document-level Enter handler never leak. */
  let simHandle = null;
  /** Central kill-switch: clears every timer / interval / rAF / per-view listener (and the simulator) before a new view renders. */
  function cancelAnimations() {
    anim.cancelAll();
    if (simHandle) { const h = simHandle; simHandle = null; try { h.destroy(); } catch (e) { console.error(e); } }
  }

  /* ------------------------------------------------------------- 4. effects */
  /** Typewriter: types `text` into node at `cps` chars/sec (rAF, time based). Returns finish(); idempotent. */
  function typewriter(node, text, cps, done) {
    text = String(text == null ? '' : text);
    const g = anim.gen;
    const arr = chars(text);
    let finished = false, shown = 0;
    function finish() {
      if (finished) return; finished = true;
      anim.finishers.delete(finish);
      node.textContent = text; node.classList.remove('typing');
      if (done) done();
    }
    if (REDUCED || !isFinite(cps) || !arr.length) { finish(); return finish; }
    node.textContent = ''; node.classList.add('typing');
    anim.finishers.add(finish);
    const start = performance.now();
    (function frame(now) {
      if (finished || g !== anim.gen) return;
      const target = Math.min(arr.length, Math.floor(((now - start) / 1000) * cps));
      if (target > shown) { shown = target; node.textContent = arr.slice(0, shown).join(''); }
      if (shown >= arr.length) finish(); else requestAnimationFrame(frame);
    })(start);
    return finish;
  }

  /** Decrypt reveal: random glyphs resolve left → right into `text` over `dur` ms. */
  function scramble(node, text, dur, done) {
    text = String(text == null ? '' : text);
    const g = anim.gen, arr = chars(text), n = arr.length;
    let finished = false;
    function finish() { if (finished) return; finished = true; anim.finishers.delete(finish); node.textContent = text; if (done) done(); }
    if (REDUCED || !n) { finish(); return finish; }
    const res = span('', ''), scr = span('scr', '');
    node.textContent = ''; node.append(res, scr);
    anim.finishers.add(finish);
    const start = performance.now();
    (function frame(now) {
      if (finished || g !== anim.gen) return;
      const p = Math.min(1, (now - start) / dur), k = Math.floor(p * n);
      res.textContent = arr.slice(0, k).join('');
      scr.textContent = arr.slice(k).map((c) => (c === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join('');
      if (p >= 1) finish(); else requestAnimationFrame(frame);
    })(start);
    return finish;
  }

  /** Reveal a list of nodes one by one (flicker-in) with `step` ms stagger. Returns finish(). */
  function stagger(nodes, step, cls) {
    cls = cls || 'in';
    let i = 0, finished = false;
    function finish() { if (finished) return; finished = true; anim.finishers.delete(finish); nodes.forEach((n) => { n.classList.remove('ph'); n.classList.add(cls); }); }
    if (REDUCED) { finish(); return finish; }
    anim.finishers.add(finish);
    (function next() {
      if (finished) return;
      if (i >= nodes.length) { finish(); return; }
      nodes[i].classList.remove('ph'); nodes[i].classList.add(cls); i++;
      anim.timeout(next, step);
    })();
    return finish;
  }

  /** Random RGB-split glitch on .glitch elements inside root every 4–9 s (and on hover via CSS). */
  function glitchLoop(root) {
    if (REDUCED) return;
    (function tick() {
      anim.timeout(() => {
        const els = $$('.glitch', root);
        if (els.length) { const e = pick(els); e.classList.add('on'); anim.timeout(() => e.classList.remove('on'), 300); }
        tick();
      }, rnd(4000, 9000));
    })();
  }

  /** Sequencer: steps run with delays; finish() runs the remainder instantly (idempotent). */
  function Seq() { this.steps = []; this.i = 0; this.done = false; this.timer = null; }
  Seq.prototype.add = function (fn, delayAfter) { this.steps.push({ fn: fn, delay: delayAfter || 0 }); return this; };
  Seq.prototype.start = function () {
    const self = this, g = anim.gen;
    (function run() {
      if (self.done || g !== anim.gen) return;
      if (self.i >= self.steps.length) { self.done = true; return; }
      const s = self.steps[self.i++];
      try { s.fn(false); } catch (e) { console.error(e); }
      self.timer = anim.timeout(run, s.delay);
    })();
    return this;
  };
  Seq.prototype.finish = function () {
    if (this.done) return;
    this.done = true;
    if (this.timer != null) { clearTimeout(this.timer); anim.timers.delete(this.timer); }
    while (this.i < this.steps.length) { const s = this.steps[this.i++]; try { s.fn(true); } catch (e) { console.error(e); } }
    anim.finishAll();
  };
  /** Bind "any key / click / tap skips" for the current view; nav keys are left to the view handler. */
  function bindSkip(seq, root) {
    anim.on(document, 'keydown', (e) => { if (!e.metaKey && !e.ctrlKey && !e.altKey && ['Shift', 'Meta', 'Control', 'Alt', 'Tab'].indexOf(e.key) === -1) seq.finish(); });
    anim.on(root || document, 'pointerdown', () => seq.finish());
  }

  /* -------------------------------------------------------------- 5. chrome */
  /** Window pane: title bar (three green dots, title, meta) + body. */
  function pane(title, meta, cls) {
    const ttl = el('span', { class: 'ttl' });
    if (Array.isArray(title)) append(ttl, title); else ttl.textContent = title;
    const bar = el('div', { class: 'pane-title' },
      el('span', { class: 'dots', attr: { 'aria-hidden': 'true' } }, el('i'), el('i'), el('i')),
      ttl,
      el('span', { class: 'meta', text: meta || '' }));
    const body = el('div', { class: 'pane-body' });
    const p = el('section', { class: 'pane ' + (cls || '') + (REDUCED ? '' : ' sweep') }, bar, body);
    p.body = body;
    return p;
  }
  /** Box-drawing frame ┌─┤ TITLE ├───┐ around content (css border + corner glyphs). */
  function box(title, ...children) {
    const b = el('div', { class: 'box' },
      span('c tl', '┌'), span('c tr', '┐'), span('c bl', '└'), span('c br', '┘'),
      title ? el('span', { class: 'bt' }, span('l', '┤ '), title, span('l', ' ├')) : null);
    append(b, children);
    return b;
  }
  /** Table: cols = [{h, cls, num}] ; rows = [{cells:[node|string], cls}] */
  function table(cols, rows, cls) {
    const thead = el('thead', null, el('tr', null, cols.map((c) => el('th', { class: (c.num ? 'num ' : '') + (c.cls || ''), text: c.h }))));
    const tbody = el('tbody');
    rows.forEach((r) => {
      const tr = el('tr', { class: r.cls || '' });
      r.cells.forEach((cell, i) => {
        const td = el('td', { class: (cols[i] && cols[i].num ? 'num ' : '') + ((r.cellCls && r.cellCls[i]) || '') });
        append(td, [cell]);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    const t = el('table', { class: 'tt ' + (cls || '') }, thead, tbody);
    t.tbodyEl = tbody;
    return t;
  }
  const scrollx = (...children) => el('div', { class: 'scrollx' }, ...children);
  const bar = (pct, width) => { const n = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width); return { on: '█'.repeat(n), off: '░'.repeat(width - n) }; };
  function meterNode(pct, width) { const b = bar(pct, width); return el('span', { class: 'meter' }, '[', el('b', { text: b.on }), b.off, ']'); }
  function tbtn(key, label, onClick, title) {
    return el('button', { class: 'tbtn', type: 'button', title: title || label, on: { click: onClick } }, span('k', '[' + key + ']'), ' ' + label);
  }

  /* --------------------------------------------------------- 6. matrix rain */
  function startMatrix() {
    const canvas = $('#matrix');
    if (!canvas || REDUCED) { if (canvas) canvas.style.display = 'none'; return; }
    const ctx = canvas.getContext('2d');
    const CH = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0101010$#%&';
    const FS = 15;
    let cols = 0, drops = [], w = 0, h = 0, dpr = 1, last = 0;
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / FS);
      drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -60));
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    }
    function frame(now) {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      if (now - last < 1000 / 24) return;   // ~24fps throttle
      last = now;
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(0, 0, w, h);
      ctx.font = FS + 'px ' + '"IBM Plex Mono", Menlo, monospace';
      for (let i = 0; i < cols; i++) {
        const y = drops[i] * FS;
        if (y > 0) {
          ctx.fillStyle = Math.random() < 0.08 ? '#7dff5a' : '#4af626';
          ctx.fillText(CH[Math.floor(Math.random() * CH.length)], i * FS, y);
        }
        if (y > h && Math.random() > 0.975) drops[i] = Math.floor(Math.random() * -30);
        drops[i]++;
      }
    }
    resize();
    window.addEventListener('resize', resize);   // single listener, never re-added
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------- 7. boot sequence */
  const IMPORT_ID = 'BROOKDALE_LEAGUE_PRESEASON_POWER_RANKINGS_' + (DATA.version || 'V213174');
  const IMPORT_PATH = DATA.importPath || '~/league-treasurer/ben-blackmail/../power-rankings/' + SEASON;
  const HIST_SEASONS = (HISTORY.seasons || []).length;

  function bootLines() {
    let q = 0, cel = 0, players = 0;
    TEAMS.forEach((t) => { const all = [].concat((t.roster && t.roster.starters) || [], (t.roster && t.roster.bench) || []); players += all.length; all.forEach((p) => { if (p.status === 'Q') q++; if (p.status === 'CEL') cel++; }); });
    const champs = HISTORY.champions || [];
    const distinct = new Set(champs.map((c) => c.manager)).size;
    const stillHere = new Set(champs.filter((c) => c.current).map((c) => c.manager)).size;
    const failures = TEAMS.filter((t) => /return\s+"FAILURE/.test(t.winCondition || '')).length;
    const hist = HIST_SEASONS;
    const belsky = TEAMS.find((t) => /belsky/i.test(t.manager)) || TEAMS[TEAMS.length - 1];
    const ts = (n) => '[' + lpad(n.toFixed(6), 11) + '] ';
    // deliberately compressed: kernel lines + bar + the typed import line must all land inside ~7 s
    return [
      { cls: 'p', text: 'brookdale@league:~$ ./decrypt --target power_rankings_' + SEASON + ' --season ' + SEASON, cps: 220, wait: 120 },
      { cls: 'k', ts: ts(0.000004), text: 'BROOKDALE_KERNEL v' + (hist + 1) + '.0 (' + (hist + 1) + ' seasons, ' + TEAMS.length + ' idiots) booting...', wait: 140 },
      { tag: 'ok', text: 'Mounting ' + IMPORT_PATH.replace(/\/\.\..*$/, ''), wait: 110 },
      { tag: 'ok', text: 'Bypassing Yahoo Fantasy firewall (ID# ' + LEAGUE_ID + ')', wait: 150 },
      { tag: 'ok', text: 'Importing rosters .......... ' + TEAMS.length + '/' + TEAMS.length + ' (' + players + ' players)', wait: 110 },
      { tag: 'ok', text: 'Loading ' + hist + ' seasons of history ... ' + champs.length + ' titles, ' + distinct + ' champions found, ' + stillHere + ' of them still here', wait: 150 },
      { tag: 'warn', text: (belsky ? firstNameOf(belsky.manager) : 'Belsky') + ' detected. Adjusting tie probability +∞', wait: 190 },
      { tag: 'ok', text: 'Calibrating burger status: NOT EATEN', wait: 110 },
      { tag: 'warn', text: q + ' players flagged Q, ' + cel + ' flagged CEL (Jacobs, violence >= 1.0)', wait: 130 },
      { tag: 'fail', text: "Locating Ben's league dues .................. NOT FOUND", wait: 190 },
      { tag: 'ok', text: 'Compiling winCondition() x' + TEAMS.length + ' ... ' + (TEAMS.length - failures) + ' passed, ' + failures + ' FAILURE: WIN CONDITION NOT ATTAINABLE', wait: 200 },
      { cls: 'bar', wait: 0 }
    ];
  }

  /**
   * Boot: kernel lines → progress bar → (the ENDING) a fresh prompt types the `import …` statement char by char,
   * a simulated Enter prints one echo line, then glitch/flash into the file list. Any key / click / tap skips straight
   * to the list; a real Enter while the import line is typing completes it and opens the list. A 9 s watchdog
   * force-routes so the boot can never trap the user.
   */
  function runBoot(onDone) {
    let finished = false, watchdog = null, enterNow = null;
    function finish() {
      if (finished) return; finished = true;
      clearTimeout(watchdog);
      try { anim.finishAll(); } catch (e) { /* ignore */ }
      cancelAnimations();
      try { onDone(); } catch (e) { console.error(e); location.hash = '#/'; }
    }
    try {
      const p = pane([el('b', { text: '-bash' })], 'tty0 · 80×24', 'boot');
      const lines = el('div', { class: 'boot-lines' });
      p.body.append(lines, el('div', { class: 'boot-skip', text: '[press any key to skip]' }));
      app.appendChild(p);
      const LINE_CPS = 1600;

      function transition() {   // glitch / flash into the file list
        p.classList.add('tear');
        anim.timeout(() => { app.classList.add('flash'); anim.timeout(() => { app.classList.remove('flash'); finish(); }, 180); }, 120);
      }
      let endingStarted = false;
      function startEnding() {
        if (finished || endingStarted) return; endingStarted = true;
        const ln = el('span', { class: 'ln imp' }, span('host', 'brookdale@league'), ':', span('path', '~'), '$ ');
        const cmd = el('span', { class: 'cmd typing' });
        ln.appendChild(cmd); lines.appendChild(ln);
        const segs = [['import', 'kw'], [' ', ''], [IMPORT_ID, 'id'], [' ', ''], ['from', 'kw'], [' ', ''], ['"' + IMPORT_PATH + '"', 'str']];
        const spans = segs.map((sg) => { const s = span(sg[1], ''); cmd.appendChild(s); return s; });
        const flat = []; segs.forEach((sg, i) => chars(sg[0]).forEach((ch) => flat.push([i, ch])));
        let k = 0, typed = false, entered = false;
        function completeLine() { if (typed) return; typed = true; anim.finishers.delete(completeLine); spans.forEach((s, i) => { s.textContent = segs[i][0]; }); }
        anim.finishers.add(completeLine);
        function pressEnter() {
          if (entered || finished) return; entered = true;
          completeLine(); cmd.classList.remove('typing');
          lines.appendChild(el('span', { class: 'ln' }, span('ok', '[ OK ] '), TEAMS.length + ' files · ' + HIST_SEASONS + ' seasons · 1 Belsky'));
          anim.timeout(transition, 70);
        }
        enterNow = pressEnter;
        if (REDUCED) { pressEnter(); return; }
        (function tick() {
          if (finished || typed) return;
          if (k >= flat.length) { typed = true; anim.finishers.delete(completeLine); anim.timeout(pressEnter, 250); return; }   // beat, then Enter
          const c = flat[k++]; spans[c[0]].textContent += c[1];
          anim.timeout(tick, 21 + Math.random() * 10);   // ~25–30 ms per char, jittered
        })();
      }

      const seq = new Seq();
      bootLines().forEach((L) => {
        const ln = el('span', { class: 'ln' });
        lines.appendChild(ln);
        if (L.cls === 'bar') {
          seq.add((instant) => {
            const lbl = span('', 'DECRYPTING POWER RANKINGS  ');
            const on = span('bar', ''), off = span('e', ''), pct = span('', '');
            ln.append(lbl, span('bar', '['), on, el('span', { class: 'bar' }, off), span('bar', ']  '), pct);
            const W = 24;
            const set = (v) => { const b = bar(v, W); on.textContent = b.on; off.textContent = b.off; pct.textContent = lpad(Math.round(v) + '%', 4); };
            let v = 0, done = false;
            const fin = anim.finisher(() => { done = true; set(100); });
            const complete = () => { if (done) return; done = true; anim.finishers.delete(fin); set(100); anim.timeout(startEnding, 100); };
            if (instant || REDUCED) { complete(); return; }
            (function step() {
              if (done) return;
              v += v < 78 ? rnd(7, 14) : v < 81 ? rnd(1.5, 3) : rnd(9, 15);   // stalls around 81% for a beat
              if (v >= 100) { complete(); return; }
              set(v);
              anim.timeout(step, v > 78 && v < 84 ? 170 : rnd(30, 55));
            })();
          }, 0);
          return;
        }
        seq.add((instant) => {
          if (L.cls === 'p') { ln.classList.add('p'); typewriter(ln, L.text, instant ? Infinity : L.cps || 60); return; }
          if (L.cls === 'k') { ln.append(span('ts', L.ts)); const t = span('', ''); ln.appendChild(t); typewriter(t, L.text, instant ? Infinity : LINE_CPS); return; }
          const tagTxt = { ok: '[ OK ] ', warn: '[WARN] ', fail: '[FAIL] ' }[L.tag] || '';
          ln.append(span(L.tag, tagTxt)); const t = span('', ''); ln.appendChild(t);
          typewriter(t, L.text, instant ? Infinity : LINE_CPS);
        }, Math.round(L.wait * 0.35 + ((L.text || '').length / (L.cls === 'p' ? (L.cps || 60) : LINE_CPS)) * 1000));
      });
      anim.on(document, 'keydown', (e) => {
        if (['Shift', 'Meta', 'Control', 'Alt'].indexOf(e.key) !== -1) return;
        e.preventDefault();
        if (e.key === 'Enter' && enterNow) { enterNow(); return; }   // real Enter during the typed import: complete + open
        finish();
      });
      anim.on(document, 'pointerdown', finish);
      anim.on(document, 'touchstart', finish, { passive: true });
      watchdog = setTimeout(finish, 9000);   // never trap the user
      seq.start();
    } catch (e) {
      console.error('boot failed', e);
      finish();
    }
  }

  /* ---------------------------------------------------------------- 8. views */
  const app = $('#app');
  const readCountText = () => 'READ ' + store.count() + '/' + TOTAL_FILES;
  const kb = (v) => (v >= 1024 ? (v / 1024).toFixed(1) + 'K' : v + 'B');

  /* ---- 8a. file list (#/) ---- */
  let decoyDone = false;            // the reverse-order decoy reveal runs once per page load (module flag)
  const DECOY_MS = 5000;
  const rank2 = (n) => lpad(n, 2).replace(' ', '0');
  const isTeamId = (id) => TEAMS.some((t) => t.slug === id);

  /** Full-screen white → green flash (~120 ms), used by the decoy reveal. */
  function flashScreen() {
    if (REDUCED) return;
    const f = el('div', { class: 'fx-flash', attr: { 'aria-hidden': 'true' } });
    document.body.appendChild(f);
    f.addEventListener('animationend', () => f.remove());
    setTimeout(() => f.remove(), 600);   // plain timer on purpose: must fire even if the view is cancelled mid-flash
  }

  function renderList() {
    document.title = 'brookdale@league: ' + HOME_PATH;
    setStatusPath(HOME_PATH);
    const p = pane([el('b', { text: 'brookdale@league' }), ': ' + HOME_PATH], TOTAL_FILES + ' files · bash', 'list');
    app.appendChild(p);
    const body = p.body;
    const prompt = el('div', { class: 'prompt' }, span('host', 'brookdale@league'), ':', span('path', HOME_PATH), '$ ');
    const cmd = span('cmd', '');
    prompt.appendChild(cmd);
    body.appendChild(prompt);

    /* decoy state: rows locked + reversed until revealOrder() runs */
    const decoy = !decoyDone && !REDUCED && TEAMS.length > 1;
    decoyDone = true;
    let locked = decoy, decoyT0 = 0, decoyTimer = null;

    const decoyLine = el('div', { class: 'stat-hdr decoy-hdr ph', attr: { 'aria-hidden': 'true' } });
    const total = el('div', { class: 'dim ph', text: 'total ' + TOTAL_FILES });
    const lshead = el('div', { class: 'lshead ph' },
      span('chk', ''), span('perms', 'mode'), span('size', 'size'), span('rank', 'rank'), span('thumb', ''), span('file', 'file'),
      span('mgr', 'owner'), span('rec', 'proj'), span('tag', 'tagline'));
    const ls = el('div', { class: 'ls' + (decoy ? ' decoy' : ''), attr: { role: 'list' } });
    if (decoy) body.appendChild(decoyLine);
    body.append(total, lshead, ls);

    const rows = [];
    function rowNode(id, d) {
      const th = el('span', { class: 'thumb', attr: { 'aria-hidden': 'true' } });
      if (d.img) {
        const im = el('img', { class: 'pthumb', alt: '', attr: { decoding: 'async' } });
        im.addEventListener('error', () => { th.textContent = ''; th.appendChild(span('noimg', 'NO_IMG')); });
        im.src = d.img; th.appendChild(im);
      } else th.appendChild(span('noimg', d.glyph || '≡'));
      const r = el('div', { class: 'row ph' + (d.cls ? ' ' + d.cls : ''), attr: { role: 'listitem', tabindex: '0', 'data-id': id, 'aria-label': d.file } },
        span('chk', ''), span('perms', ''), span('size', d.size), span('rank', d.rank), th,
        el('span', { class: 'file' }, d.file, d.exec ? span('xtag', '[EXEC]') : null), span('br', ''), span('mgr', d.mgr), span('rec', d.rec),
        el('span', { class: 'tag' }, d.tag ? d.tag : '', span('badge', '')));
      r.rw = d.rw; r.ro = d.ro; r.dataset.rank = d.rank;
      r.addEventListener('click', () => open(id));
      r.addEventListener('focus', () => setCur(rows.indexOf(r), true));
      r.addEventListener('mouseenter', () => { if (locked) return; rows.forEach((x) => x.classList.remove('cur')); curIdx = rows.indexOf(r); });
      return r;
    }
    TEAMS.forEach((t) => {
      const w = WRITEUPS[t.slug] || {};
      rows.push(rowNode(t.slug, {
        size: kb(JSON.stringify(t).length), rank: '#' + rank2(t.rank), file: t.file, img: t.profile || '',
        mgr: t.manager, rec: t.projectedRecord,
        tag: (w.tagline || '').trim() || (t.subtitle || '').trim() || '', rw: '-rw-r--r--', ro: '-r--r--r--'
      }));
    });
    rows.push(rowNode(SIM_ID, {   // executable: -rwxr-xr-x, bright green bold name + [EXEC] tag → #/sim (sits after the team files, before the log)
      size: kb(24576), rank: 'exe', file: 'SEASON_SIM.exe', mgr: 'league', rec: '',
      tag: 'roll a ' + SEASON + ' season · 10,000-season monte carlo · toilet bowl', rw: '-rwxr-xr-x', ro: '-rwxr-xr-x', cls: 'exe', glyph: '▶', exec: true
    }));
    rows.push(rowNode(INTEL_ID, {
      size: kb(JSON.stringify(HISTORY).length), rank: 'log', file: 'LEAGUE_INTEL.log', mgr: 'league', rec: '',
      tag: 'champions · all-time table · insights · standings grid', rw: '-r-xr-xr-x', ro: '-r-xr-xr-x', cls: 'intel', glyph: '≡'
    }));
    /* decoy: team rows enter in REVERSE rank order wearing fake position numbers; extra rows (intel / sim) stay at the bottom, dimmed */
    const teamRows = rows.filter((r) => isTeamId(r.dataset.id)), extraRows = rows.filter((r) => !isTeamId(r.dataset.id));
    const initialOrder = decoy ? teamRows.slice().reverse().concat(extraRows) : rows;
    initialOrder.forEach((r) => ls.appendChild(r));
    if (decoy) {
      teamRows.slice().reverse().forEach((r, i) => { $('.rank', r).textContent = '#' + rank2(i + 1); });
      rows.forEach((r) => { r.setAttribute('aria-disabled', 'true'); r.setAttribute('tabindex', '-1'); });
      extraRows.forEach((r) => r.classList.add('dimlock'));
    }

    const foot = el('div', { class: 'ls-foot ph' + (decoy ? ' locked' : '') },
      span('lock', '[locked] decrypting rank order…'),
      el('button', { type: 'button', on: { click: () => setCur(curIdx + 1) } }, span('k', '[↑/↓]'), ' navigate'),
      el('button', { type: 'button', on: { click: () => open(rows[Math.max(0, curIdx)].dataset.id) } }, span('k', '[ENTER]'), ' open'),
      el('button', { type: 'button', on: { click: askReset } }, span('k', '[R]'), ' reset read status'),
      el('button', { type: 'button', on: { click: toggleHelp } }, span('k', '[?]'), ' help'));
    const statusEl = el('div', { class: 'statusline', attr: { 'aria-live': 'polite' } });
    const help = el('div', { class: 'helpbox', hidden: '' });
    help.appendChild(box('HELP', el('pre', null,
      span('k', '↑ / ↓  or  j / k'), '   move the cursor\n',
      span('k', 'ENTER'), '              open the highlighted file  (inside SEASON_SIM.exe: roll a season)\n',
      span('k', 'ESC'), '                (in a file) back to this index\n',
      span('k', '← / →'), '              (in a file) previous / next ranked team\n',
      span('k', 'R'), '                  reset read status (asks y/n)\n',
      span('k', '?'), '                  toggle this help\n',
      span('k', 'any key / tap'), '      skip animations\n')));
    body.append(foot, statusEl, help);

    let curIdx = -1, confirming = false;
    function status(msg, cls) { statusEl.textContent = msg || ''; statusEl.className = 'statusline' + (cls ? ' ' + cls : ''); }
    function applyRead(r) {
      const isRead = store.isRead(r.dataset.id);
      r.classList.toggle('read', isRead);
      const chk = $('.chk', r); chk.textContent = isRead ? '[x]' : '[ ]'; chk.classList.toggle('unread', !isRead);
      $('.perms', r).textContent = isRead ? r.ro : r.rw;
      $('.badge', r).textContent = isRead ? '✓ READ' : '';
    }
    function drawDecoyLine() {
      const elapsed = decoyT0 ? performance.now() - decoyT0 : 0, pct = Math.min(100, (elapsed / DECOY_MS) * 100), b = bar(pct, 20);
      decoyLine.textContent = '';
      decoyLine.append(span('amber', 'decrypting rank order…'), el('span', { class: 'pb' }, '[', el('b', { text: b.on }), b.off, ']'),
        span('', lpad(Math.round(pct) + '%', 4)), span('dim', 'T-' + (Math.max(0, DECOY_MS - elapsed) / 1000).toFixed(1) + 's'));
    }
    function refresh() { rows.forEach(applyRead); $('#sb-read').textContent = readCountText(); if (locked) drawDecoyLine(); }
    function setCur(i, fromFocus) {
      if (!rows.length || locked) return;
      rows.forEach((r) => r.classList.remove('cur'));
      curIdx = ((i % rows.length) + rows.length) % rows.length;
      rows[curIdx].classList.add('cur');
      if (!fromFocus) { rows[curIdx].focus({ preventScroll: true }); rows[curIdx].scrollIntoView({ block: 'nearest' }); }
    }
    function open(id) {
      if (!id || locked) return;
      store.markRead(id);
      navigate(id === INTEL_ID ? '#/intel' : id === SIM_ID ? '#/sim' : '#/t/' + id);
    }
    function askReset() { if (locked) return; confirming = true; status('reset read status? [y/n]'); }
    function toggleHelp() { help.hidden = !help.hidden; }

    /* decoy: 5 s countdown → full-screen flash + glitch burst → FLIP the rows into the real order → unlock */
    function startDecoy() {
      if (!locked || decoyT0) return;
      decoyT0 = performance.now();
      decoyTimer = anim.interval(() => {
        drawDecoyLine();
        if (performance.now() - decoyT0 >= DECOY_MS) { clearInterval(decoyTimer); anim.intervals.delete(decoyTimer); revealOrder(); }
      }, 100);
    }
    function revealOrder() {
      if (!locked) return;
      flashScreen();
      p.classList.add('burst');
      anim.timeout(() => p.classList.remove('burst'), 420);
      const before = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
      rows.forEach((r) => ls.appendChild(r));                                          // real rank order in the DOM
      rows.forEach((r) => { const dy = before.get(r) - r.getBoundingClientRect().top; r.style.transition = 'none'; r.style.transform = dy ? 'translateY(' + dy + 'px)' : 'none'; });
      void ls.offsetHeight;                                                             // flush: paint the inverse transform first
      requestAnimationFrame(() => {
        rows.forEach((r, i) => { r.style.transition = 'transform 700ms cubic-bezier(.22, .8, .2, 1) ' + (i * 35) + 'ms'; r.style.transform = 'translateY(0)'; });
      });
      teamRows.forEach((r, i) => anim.timeout(() => scramble($('.rank', r), r.dataset.rank, 520), 140 + i * 35));   // fake → real rank numbers
      anim.timeout(unlock, 700 + rows.length * 35 + 220);
    }
    function unlock() {
      if (!locked) return; locked = false;
      rows.forEach((r) => { r.style.transition = ''; r.style.transform = ''; r.removeAttribute('aria-disabled'); r.setAttribute('tabindex', '0'); r.classList.remove('dimlock'); $('.rank', r).textContent = r.dataset.rank; });
      ls.classList.remove('decoy'); foot.classList.remove('locked');
      decoyLine.remove();
    }

    refresh();
    const seq = new Seq();
    seq.add((instant) => typewriter(cmd, 'ls -la --sort=rank', instant ? Infinity : 40), 520)
      .add(() => { decoyLine.classList.remove('ph'); total.classList.remove('ph'); lshead.classList.remove('ph'); startDecoy(); }, 140)
      .add(() => stagger(initialOrder, 60), rows.length * 60 + 80)
      .add(() => { foot.classList.remove('ph'); prompt.appendChild(span('cur', '')); }, 0)
      .start();
    bindSkip(seq, app);
    glitchLoop(app);

    anim.on(document, 'keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (confirming) {
        if (e.key === 'y' || e.key === 'Y') { store.reset(); refresh(); status('read status cleared — ' + TOTAL_FILES + ' files re-encrypted.', 'ok'); }
        else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') status('cancelled.');
        else return;
        confirming = false; e.preventDefault(); return;
      }
      if (locked && ['Enter', 'ArrowDown', 'ArrowUp', 'j', 'k', 'Home', 'End', 'r', 'R'].indexOf(e.key) !== -1) { e.preventDefault(); return; }   // rows are locked during the decoy
      switch (e.key) {
        case 'ArrowDown': case 'j': e.preventDefault(); setCur(curIdx + 1); break;
        case 'ArrowUp': case 'k': e.preventDefault(); setCur(curIdx - 1); break;
        case 'Home': e.preventDefault(); setCur(0); break;
        case 'End': e.preventDefault(); setCur(rows.length - 1); break;
        case 'Enter': if (curIdx >= 0) { e.preventDefault(); open(rows[curIdx].dataset.id); } break;
        case 'r': case 'R': e.preventDefault(); askReset(); break;
        case '?': e.preventDefault(); toggleHelp(); break;
        case 'Escape': if (!help.hidden) toggleHelp(); status(''); break;
        default: break;
      }
    });
  }

  /* ---- write-up lexicon: players green · managers/nicknames blue · team names blue bold · numbers amber · verdict words green-2 / red ---- */
  const STOP = new Set(['love', 'little', 'price', 'hall', 'cook', 'rice', 'lane', 'marks', 'mason', 'tate', 'loop', 'flowers', 'brown', 'downs', 'white', 'hill', 'bell', 'chase', 'watson', 'wilson', 'moore', 'reed', 'hunt', 'walker', 'lemon', 'burden', 'jones', 'smith', 'williams', 'johnson', 'robinson', 'harvey', 'irving', 'washington', 'evans', 'adams', 'olave', 'cool', 'fields', 'likely', 'golden', 'swift', 'hurts', 'pierce', 'london', 'kraft', 'bowers', 'dart', 'rome', 'trey']);
  const MANAGER_WORDS = ['Alex', 'ANK', 'Caleb', 'Gabe', 'Dale', 'Chris', 'Ben', 'Van', 'Sam', 'Oliver', 'Ethan', 'Belsky'];
  const PLAYER_NICKS = ['CeeDee', 'AJ', 'A.J.', 'Bijan', 'Achane', 'Jettas', 'CMC', 'Nabers', 'K9', 'KW9', 'JSN', 'Amon-Ra', 'Amon Ra', 'Bucky', 'Puka', 'Kelce', 'Kittle', 'Henry', 'Saquon', 'Lamar', 'Burrow', 'Allen',
    'Jamo', 'Jamarr', 'Jamarr Chase', "Ja'Marr", 'Kyren', 'Ladd', 'Jeanty', 'Jacobs', 'Rashee', 'Higgins', 'Dowdle', 'Pickens', 'Mayfield', 'Aubrey', 'McConkey'];
  const GOOD_WORDS = ['TRUE', 'FALSE', 'PLAYOFFS', 'PLAYOFF', 'CHAMPION', 'CHAMPIONS', 'CHAMPIONSHIP', 'WINNER'];
  const BAD_WORDS = ['LOSE', 'LOSER', 'LOSERS', 'BUST', 'INJURED', 'WASHED', 'FAILURE', 'IMPLODE', 'IMPLODES', 'IMPLODED'];
  const NAMES = (function buildNameIndex() {
    const map = new Map();
    const add = (s, cls, min) => { s = String(s || '').replace(/\s+/g, ' ').trim(); if (s.length >= (min || 3) && !map.has(s.toLowerCase())) map.set(s.toLowerCase(), cls); };
    const addSafe = (s, cls, min) => { if (!STOP.has(String(s || '').trim().toLowerCase())) add(s, cls, min); };
    // managers + nicknames first, so "Chris" / "Sam" beat the player first-name rule below
    TEAMS.forEach((t) => { add(firstNameOf(t.manager), 'wu-mgr', 2); (String(t.manager).match(/\(([^)]+)\)/g) || []).forEach((n) => add(n.slice(1, -1), 'wu-mgr', 2)); });
    MANAGER_WORDS.forEach((n) => add(n, 'wu-mgr', 2));
    // the ten fantasy teams (with and without emoji) + the league
    const clean = (s) => String(s || '').replace(/[^\w\s'’.&!?-]/g, '').replace(/\s+/g, ' ').trim();
    TEAMS.forEach((t) => { add(t.name, 'wu-team'); add(clean(t.name), 'wu-team'); add(baseName(t).replace(/_/g, ' '), 'wu-team'); });
    add(DATA.league, 'wu-team'); add('Brookdale League', 'wu-team'); add('Brookdale', 'wu-team');
    GOOD_WORDS.forEach((w) => add(w, 'wu-good')); BAD_WORDS.forEach((w) => add(w, 'wu-bad'));
    PLAYER_NICKS.forEach((n) => add(n, 'wu-player', 2));
    // every rostered player: full name, name without suffix/dots, last name (≥5 letters), unique first name (≥4 letters)
    const mgrFirst = new Set(TEAMS.map((t) => firstNameOf(t.manager).toLowerCase()));
    const firstCount = {}, players = [];
    TEAMS.forEach((t) => [].concat((t.roster && t.roster.starters) || [], (t.roster && t.roster.bench) || []).forEach((pl) => players.push(pl)));
    const noSuffix = (n) => n.replace(/\./g, '').split(' ').filter((x) => !/^(jr|sr|ii|iii|iv)$/i.test(x));
    players.forEach((pl) => {
      if (pl.pos === 'DEF') { add(pl.name, 'wu-team'); return; }
      add(pl.name, 'wu-player'); add(pl.name.replace(/\./g, ''), 'wu-player');
      const parts = noSuffix(pl.name);
      add(parts.join(' '), 'wu-player');
      firstCount[parts[0].toLowerCase()] = (firstCount[parts[0].toLowerCase()] || 0) + 1;
      if (parts.length > 1) addSafe(parts[parts.length - 1], 'wu-player', 5);
    });
    players.forEach((pl) => { if (pl.pos === 'DEF') return; const first = noSuffix(pl.name)[0]; if (firstCount[first.toLowerCase()] === 1 && !mgrFirst.has(first.toLowerCase())) addSafe(first, 'wu-player', 4); });
    const keys = Array.from(map.keys()).sort((a, b) => b.length - a.length);
    return { map: map, re: keys.length ? new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi') : null };
  })();
  const NUM_RE = /[+-]?\d[\d,]*(?:\.\d+)?%?(?:-\d+(?:-\d+)?)?(?:st|nd|rd|th|s)?/gi;
  const isWord = (c) => !!c && /[A-Za-z0-9]/.test(c);
  /** Split write-up text into [{t, cls}] segments for coloring (word-bounded, case-insensitive). Built into spans with textContent only. */
  function segmentize(text) {
    const out = [];
    const pushPlain = (s) => {   // numbers / records / odds / years → amber
      let last = 0, m; NUM_RE.lastIndex = 0;
      while ((m = NUM_RE.exec(s))) {
        if (isWord(s[m.index - 1]) || isWord(s[m.index + m[0].length])) continue;
        if (m.index > last) out.push({ t: s.slice(last, m.index) });
        out.push({ t: m[0], cls: 'wu-num' }); last = m.index + m[0].length;
      }
      if (last < s.length) out.push({ t: s.slice(last) });
    };
    if (!NAMES.re) { pushPlain(text); return out; }
    let last = 0, m; NAMES.re.lastIndex = 0;
    while ((m = NAMES.re.exec(text))) {
      const end = m.index + m[0].length;
      if (isWord(text[m.index - 1]) || isWord(text[end])) { NAMES.re.lastIndex = m.index + 1; continue; }
      if (m.index > last) pushPlain(text.slice(last, m.index));
      out.push({ t: m[0], cls: NAMES.map.get(m[0].toLowerCase()) || 'wu-player' }); last = end;
    }
    if (last < text.length) pushPlain(text.slice(last));
    return out;
  }
  /** Typewriter across colored segments (one paragraph). Returns finish(); idempotent. */
  function typeSegments(node, segs, cps, done) {
    const g = anim.gen;
    const spans = segs.map((sg) => { const sp = el('span', { class: sg.cls || '' }); node.appendChild(sp); return sp; });
    const lens = segs.map((sg) => chars(sg.t).length), total = lens.reduce((a, b) => a + b, 0);
    let finished = false, shown = 0;
    function finish() { if (finished) return; finished = true; anim.finishers.delete(finish); spans.forEach((sp, i) => { sp.textContent = segs[i].t; }); node.classList.remove('typing'); if (done) done(); }
    if (REDUCED || !isFinite(cps) || !total) { finish(); return finish; }
    node.classList.add('typing'); anim.finishers.add(finish);
    const start = performance.now();
    (function frame(now) {
      if (finished || g !== anim.gen) return;
      const target = Math.min(total, Math.floor(((now - start) / 1000) * cps));
      if (target > shown) {
        shown = target; let left = shown;
        spans.forEach((sp, i) => { const n = Math.max(0, Math.min(lens[i], left)); sp.textContent = n === lens[i] ? segs[i].t : chars(segs[i].t).slice(0, n).join(''); left -= n; });
      }
      if (shown >= total) finish(); else requestAnimationFrame(frame);
    })(start);
    return finish;
  }

  /* ---- 8b. team detail (#/t/<slug>) ---- */
  const yrs = (n) => (isNum(n) ? n + (n === 1 ? '_YR' : '_YRS') : '—');
  const pctOdds = (o) => (o && isNum(o.pct) ? o.pct + '% (' + (o.odds || '±0') + ')' : '—');
  const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'W/R/T', 'K', 'DEF'];

  function highlightPy(src) {
    const pre = el('pre', { class: 'code' });
    const re = /("(?:[^"\\]|\\.)*")|(\b(?:def|if|elif|else|and|or|not|return|for|in|any|all|while|is|None)\b)|(\bTrue\b)|(\bFalse\b)|(\b\d+(?:\.\d+)?\b)|(\bwinCondition\b)|([=<>!+\-*\/%]+|[()])|(#.*$)/gm;
    let last = 0, m;
    while ((m = re.exec(src))) {
      if (m.index > last) pre.appendChild(document.createTextNode(src.slice(last, m.index)));
      const txt = m[0];
      const cls = m[1] ? (/^"FAILURE/.test(txt) ? 'fail' : 'str') : m[2] ? 'kw' : m[3] ? 't' : m[4] ? 'f' : m[5] ? 'n' : m[6] ? 'fn' : m[7] ? 'op' : 'cm';
      pre.appendChild(span(cls, txt));
      last = m.index + txt.length;
    }
    if (last < src.length) pre.appendChild(document.createTextNode(src.slice(last)));
    return pre;
  }

  function renderNotFound(slug) {
    setStatusPath(HOME_PATH);
    const p = pane([el('b', { text: 'cat' }), ' ' + slug], 'exit 1');
    p.body.append(el('div', { class: 'red', text: 'cat: ' + slug + ': No such file or directory' }),
      el('div', { class: 'eof' }, tbtn('ESC', '← back to index', () => navigate('#/'))));
    app.appendChild(p);
    anim.on(document, 'keydown', (e) => { if (e.key === 'Escape') navigate('#/'); });
  }

  function renderTeam(slug) {
    const idx = TEAMS.findIndex((t) => t.slug === slug);
    if (idx < 0) { renderNotFound(slug); return; }
    const t = TEAMS[idx];
    store.markRead(slug);
    $('#sb-read').textContent = readCountText();
    document.title = 'cat ' + t.file;
    setStatusPath(HOME_PATH + '/' + t.file);
    const prev = TEAMS[(idx - 1 + TEAMS.length) % TEAMS.length], next = TEAMS[(idx + 1) % TEAMS.length];
    const goPrev = () => navigate('#/t/' + prev.slug), goNext = () => navigate('#/t/' + next.slug), goHome = () => navigate('#/');

    const p = pane([el('b', { text: 'cat' }), ' ' + t.file], 'rank ' + t.rank + '/' + TEAMS.length + ' · ' + kb(JSON.stringify(t).length), 'detail');
    const nav = el('div', { class: 'dnav' },
      tbtn('ESC', '← back to index', goHome), tbtn('←', 'prev #' + rank2(prev.rank), goPrev, 'prev: ' + prev.file), tbtn('→', 'next #' + rank2(next.rank), goNext, 'next: ' + next.file),
      el('span', { class: 'sp' }), el('span', { class: 'rbadge', text: 'READ ✓' }));
    p.insertBefore(nav, p.body);
    app.appendChild(p);
    const body = p.body;

    /* header: <1> NAME </1> · subtitle · `// manager:` — no avatar, no big RANK numeral, no `// team:` line (user decisions #10, #12, #13) */
    const nameEl = el('span', { class: 'glitch', attr: { 'data-text': baseName(t) } });
    const subEl = el('p', { class: 'subtitle' });
    const head = el('div', { class: 'dhead ph' },
      el('div', { class: 'tname' }, span('br', '<' + t.rank + '> '), nameEl, span('br', ' </' + t.rank + '>')),
      t.subtitle ? subEl : null,
      el('div', { class: 'mgr' }, '// manager: ', el('b', { text: t.manager })));

    /* image row: profile photo (left) + meme (right), each in its own scanlined frame with a signal lock-on, then full colour.
       Equal height, aspect preserved (styles.css .imgrow); NO caption / label of any kind (user decisions #9, #10). */
    function imgFrame(src, alt) {
      const img = el('img', { alt: alt, attr: { decoding: 'async' } });
      const lockline = el('div', { class: 'lockline' });
      const frame = el('div', { class: 'thumb-frame' }, img, el('div', { class: 'static' }), lockline);
      let failed = false;
      img.addEventListener('error', () => {
        if (failed) return; failed = true;
        img.src = 'img/placeholder.svg'; frame.classList.add('nosig', 'locked');   // the placeholder itself says NO_SIGNAL
      });
      img.src = src || 'img/placeholder.svg';                                       // set now so the row has its final size before it is revealed
      return {
        wrap: el('div', { class: 'imgbox' }, box(null, frame)),
        start() { lockline.remove(); frame.appendChild(lockline); },               // restart the sweep the moment the frame becomes visible
        lockOn() { frame.classList.add('locked'); }
      };
    }
    const frames = [imgFrame(t.profile || t.thumb || '', t.manager + ' — profile picture'), imgFrame(t.meme || t.thumb || '', t.name + ' — meme')];
    const imgrow = el('div', { class: 'imgrow ph' }, frames.map((f) => f.wrap));

    /* stats block */
    const po = t.playoff || {}, fi = t.finals || {}, ch = t.championship || {};
    const drought = isNum(t.playoffDrought) && t.playoffDrought > 0;
    const statDefs = [
      ['PROJECTED_RECORD', nz(t.projectedRecord), null, t.projectedRecordNote],
      ['IMPLIED_PLAYOFF_CHANCES', pctOdds(po), po.pct],
      ['IMPLIED_FINALS_CHANCES', pctOdds(fi), fi.pct],
      ['IMPLIED_CHAMPIONSHIP_CHANCES', pctOdds(ch), ch.pct],
      ['AVERAGE_AGE', fmt(t.avgAge, 1)],
      ['TOP_30_RBS', nz(t.top30RBs)],
      drought ? ['PLAYOFF_DROUGHT', yrs(t.playoffDrought)] : ['PLAYOFF_STREAK', yrs(isNum(t.playoffStreak) ? t.playoffStreak : 0)],
      ['AVG_PF_HALF', fmt(t.avgPFHalf, 1)],
      ['AVG_PA_HALF', fmt(t.avgPAHalf, 1)],
      ['LEAGUE_TENURE', yrs(t.tenure)]
    ];
    const stats = el('div', { class: 'stats' });
    const statLines = statDefs.map((d) => {
      const v = span('v', d[1]); v.dataset.text = d[1];
      const ln = el('span', { class: 'ln ph' }, span('k', d[0]), span('eq', ' = '), v, span('semi', ';'),
        isNum(d[2]) ? meterNode(d[2], 16) : null, d[3] ? span('note', '// ' + d[3]) : null);
      stats.appendChild(ln); return ln;
    });

    /* win condition (code block only — no fake evaluation line) */
    const code = highlightPy(t.winCondition || 'def winCondition():\n    pass');
    code.classList.add('ph');

    /* write-up: ALL CAPS, lexicon-coloured spans, typed in */
    const w = WRITEUPS[t.slug] || {};
    const paras = String(w.text || '').split(/\n[ \t]*\n/).map((s) => s.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    const notes = el('div', { class: 'notes ph' });
    const paraEls = paras.map((txt) => { const pe = el('p', { class: 'wu' }); pe.segs = segmentize(txt); notes.appendChild(pe); return pe; });
    const fillPara = (pe) => { pe.textContent = ''; pe.segs.forEach((sg) => pe.appendChild(el('span', { class: sg.cls || '', text: sg.t }))); };
    if (!paras.length) notes.appendChild(el('p', { class: 'redacted', text: '[REDACTED] — write-up pending decryption' }));

    /* roster */
    const starters = (t.roster && t.roster.starters) || [], bench = (t.roster && t.roster.bench) || [];
    const statusCell = (s) => (s === 'Q' ? span('st-q', 'Q') : s === 'CEL' ? span('st-cel', 'CEL') : span('dim', '—'));
    const rosterTable = (list) => table([{ h: 'POS' }, { h: 'PLAYER' }, { h: 'NFL' }, { h: 'STATUS' }],
      list.map((pl) => ({ cells: [pl.pos, pl.name, pl.team, statusCell(pl.status)], cls: 'ph' })));
    const tS = rosterTable(starters), tB = rosterTable(bench);
    const roster = el('div', { class: 'roster ph' }, box('STARTERS', scrollx(tS)), box('BENCH', scrollx(tB)));

    /* history */
    const m = HISTORY.managers[firstNameOf(t.manager)];
    const hist = el('div', { class: 'ph' });
    let histRows = [];
    if (!m) {
      hist.appendChild(el('div', { class: 'amber', text: '// no history on file for ' + t.manager + ' — rookie, or the spreadsheet forgot them' }));
    } else {
      const seasons = (m.seasons || []).slice().sort((a, b) => a.year - b.year);
      const first = m.firstYear || (seasons[0] && seasons[0].year), last = seasons.length ? seasons[seasons.length - 1].year : first;
      const part = (label, val) => [span('sep', ' · '), label, el('b', { text: val })];
      const sumLine = el('div', { class: 'hsum' }, el('b', { text: m.name }), ' — ' + m.seasonsPlayed + ' season' + (m.seasonsPlayed === 1 ? '' : 's') + ' (' + (first === last ? first : first + '–' + last) + ')',
        part('avg finish ', fmt(m.avgFinish, 2)), part('titles: ', m.titles.length ? m.titles.join(', ') : '—'),
        part('runner-up: ', m.runnerUps.length ? m.runnerUps.join(', ') : '—'), part('last place: ', m.lastPlace.length ? m.lastPlace.join(', ') : '—'),
        part('playoffs ', m.playoffAppearances + '/' + m.seasonsPlayed),
        m.totalMoves ? part('', m.totalMoves + ' transactions' + (m.movesSeasons && m.movesSeasons < m.seasonsPlayed ? ' (' + m.movesSeasons + ' szn logged)' : '')) : null,
        m.bestSeason ? part('best PPG ', fmt(m.bestSeason.pfpg, 1) + ' (' + m.bestSeason.year + (m.bestSeason.team ? ', ' + m.bestSeason.team : '') + ')') : null);
      const chart = el('pre', { class: 'chart' });
      seasons.forEach((s) => {
        const r = isNum(s.rank) ? s.rank : 10;
        const ln = el('span', { class: 'fx-line ' + (s.playoffs ? 'po' : 'no') }, span('yr', s.year + ' │'), span('bar', '█'.repeat(Math.max(0, 11 - r)) + ' '.repeat(Math.max(0, r - 1))), ' ', span('fin', lpad(ordinal(r), 4)),
          r === 1 ? span('win', ' 🏆') : r === 10 ? span('last', ' ☠ [LAST]') : null, '\n');
        chart.appendChild(ln);
      });
      const ht = table([{ h: 'YEAR' }, { h: 'TEAM NAME' }, { h: 'FINISH', num: true }, { h: 'RECORD' }, { h: 'PF', num: true }, { h: 'PA', num: true }, { h: 'PPG', num: true }, { h: 'MOVES', num: true }],
        seasons.map((s) => ({
          cls: 'ph' + (s.playoffs ? '' : ' dimrow'),
          cells: [String(s.year), nz(s.team), isNum(s.rank) ? (s.rank === 1 ? el('span', { class: 'amber' }, '1st 🏆') : s.rank === 10 ? span('red', '10th') : ordinal(s.rank)) : '—', nz(s.record), fmt(s.pf, 2), fmt(s.pa, 2), fmt(s.pfpg, 2), nz(s.moves)]
        })));
      histRows = $$('tr.ph', ht);
      hist.append(sumLine, chart, box('SEASONS', scrollx(ht)));
    }

    const foot = el('div', { class: 'eof ph' }, tbtn('ESC', 'back', goHome), tbtn('←', 'prev #' + rank2(prev.rank), goPrev), tbtn('→', 'next #' + rank2(next.rank), goNext), span('e', 'EOF'));
    const sect = (txt) => { const s = el('div', { class: 'sect ph' }); s.dataset.text = txt; return s; };
    const sRoster = sect('$ cat roster.txt'), sHist = sect('$ cat history.log');
    body.append(head, imgrow, stats, code, notes, sRoster, roster, sHist, hist, foot);

    /* animate in sequence — fully rendered in ~2.5s, any key/click skips idempotently */
    const seq = new Seq();
    const show = (n) => n.classList.remove('ph');
    const header = (n, instant) => { show(n); scramble(n, n.dataset.text, instant ? 0 : 260); };
    seq.add((i) => { show(head);
      scramble(nameEl, baseName(t), i ? 0 : 520, () => { if (!REDUCED) { nameEl.classList.add('on'); anim.timeout(() => nameEl.classList.remove('on'), 300); } });
      if (t.subtitle) scramble(subEl, t.subtitle, i ? 0 : 500); }, 220)
      .add((i) => { show(imgrow); frames.forEach((f, k) => { if (i || REDUCED) { f.lockOn(); return; } f.start(); anim.finisher(f.lockOn); anim.timeout(f.lockOn, 900 + k * 250); }); }, 180)
      // a skip mid-stagger must resolve every value instantly: timeouts already queued check seq.done and scramble with dur 0
      .add((i) => { stagger(statLines, 40); statLines.forEach((ln, k) => { const v = $('.v', ln); anim.timeout(() => scramble(v, v.dataset.text, i || seq.done ? 0 : 220), i ? 0 : k * 40); }); }, 440)
      .add(() => show(code), 240)
      .add((i) => { show(notes);
        (function typePara(k) { if (k >= paraEls.length) return; const pe = paraEls[k]; if (i || seq.done || REDUCED) { fillPara(pe); typePara(k + 1); return; } typeSegments(pe, pe.segs, 600, () => typePara(k + 1)); })(0); }, 320)
      .add((i) => { header(sRoster, i); show(roster); stagger($$('tr.ph', tS).concat($$('tr.ph', tB)), 28); }, 420)
      .add((i) => { header(sHist, i); show(hist); stagger(histRows, 30); }, 260)
      .add(() => show(foot), 0)
      .start();
    bindSkip(seq, app);
    glitchLoop(app);
    anim.on(document, 'keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); goHome(); }
      else if (e.key === 'ArrowLeft' || e.key === 'h') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight' || e.key === 'l') { e.preventDefault(); goNext(); }
    });
  }

  /* ---- 8d. SEASON_SIM.exe (#/sim) — the body comes from sim.js (window.SIM.mount); Enter belongs to the simulator ---- */
  function renderSim() {
    store.markRead(SIM_ID);
    $('#sb-read').textContent = readCountText();
    document.title = './season_sim.exe';
    setStatusPath(HOME_PATH + '/SEASON_SIM.exe');
    const goHome = () => navigate('#/');
    const p = pane([el('b', { text: './season_sim.exe' })], TEAMS.length + ' teams · 14 wk · ' + kb(24576), 'simpane');
    const nav = el('div', { class: 'dnav' }, tbtn('ESC', '← back to index', goHome), el('span', { class: 'sp' }), el('span', { class: 'rbadge', text: 'READ ✓' }));
    p.insertBefore(nav, p.body);
    app.appendChild(p);
    const host = el('div', { class: 'sim-host' });
    p.body.append(host, el('div', { class: 'eof' }, tbtn('ESC', 'back', goHome), span('e', 'EOF')));
    if (window.SIM && typeof window.SIM.mount === 'function') {
      try { simHandle = window.SIM.mount(host); }   // returns { destroy() } — called from cancelAnimations() on every navigation
      catch (e) { console.error('sim mount failed', e); host.appendChild(el('div', { class: 'red', text: 'SEASON_SIM.exe: segmentation fault (core dumped) — ' + (e && e.message ? e.message : e) })); }
    } else {
      host.appendChild(el('div', { class: 'red', text: 'SEASON_SIM.exe: cannot execute binary file — sim.js not loaded' }));
    }
    /* keyboard: only Esc here. Enter / ↑ / ↓ belong to the simulator (sim.js); ← / → do nothing — this file is not in the team cycle. */
    anim.on(document, 'keydown', (e) => { if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); goHome(); } });
  }

  /* ---- 8c. league intel (#/intel) — everything computed from HISTORY + BROOKDALE ---- */
  function computeIntel() {
    const mgrs = Object.keys(HISTORY.managers || {}).map((k) => HISTORY.managers[k]);
    const departed = new Set(HISTORY.departedManagers || []);
    const champs = (HISTORY.champions || []).slice().sort((a, b) => a.year - b.year);
    const seasons = (HISTORY.seasons || []).slice().sort((a, b) => a.year - b.year);
    const teamByFirst = {}; TEAMS.forEach((t) => { teamByFirst[firstNameOf(t.manager)] = t; });
    const isCurrent = (name) => !!HISTORY.managers[name] || !!teamByFirst[name];
    const lastYear = seasons.length ? seasons[seasons.length - 1].year : SEASON - 1;
    const gByYear = {}; mgrs.forEach((m) => (m.seasons || []).forEach((s) => { if (isNum(s.g)) gByYear[s.year] = s.g; }));
    const dep = (name) => (departed.has(name) || !isCurrent(name) ? ' [departed]' : '');
    const names = (arr) => arr.map((m) => m.name).join(' & ');
    const maxBy = (arr, f) => { let best = -Infinity; arr.forEach((x) => { const v = f(x); if (isNum(v) && v > best) best = v; }); return { v: best, items: arr.filter((x) => f(x) === best) }; };
    const minBy = (arr, f) => { let best = Infinity; arr.forEach((x) => { const v = f(x); if (isNum(v) && v < best) best = v; }); return { v: best, items: arr.filter((x) => f(x) === best) }; };

    // per-standing rows across ALL managers (departed included), with derived ppg
    const rowsAll = [];
    seasons.forEach((s) => (s.standings || []).forEach((st) => rowsAll.push(Object.assign({ year: s.year, ppg: isNum(st.pf) && gByYear[s.year] ? st.pf / gByYear[s.year] : null }, st))));
    const totalsAll = {}; rowsAll.forEach((r) => { if (isNum(r.moves)) totalsAll[r.manager] = (totalsAll[r.manager] || 0) + r.moves; });
    const totalsList = Object.keys(totalsAll).map((k) => ({ name: k, moves: totalsAll[k] }));
    const yoy = [];
    const byMgr = {}; rowsAll.forEach((r) => { (byMgr[r.manager] = byMgr[r.manager] || []).push(r); });
    Object.keys(byMgr).forEach((k) => { const l = byMgr[k].sort((a, b) => a.year - b.year); for (let i = 1; i < l.length; i++) if (l[i].year === l[i - 1].year + 1 && isNum(l[i].rank) && isNum(l[i - 1].rank)) yoy.push({ name: k, from: l[i - 1], to: l[i], d: l[i - 1].rank - l[i].rank }); });

    const titleCount = {}; champs.forEach((c) => { if (isCurrent(c.manager)) titleCount[c.manager] = (titleCount[c.manager] || 0) + 1; });
    const titled = Object.keys(titleCount).sort((a, b) => titleCount[b] - titleCount[a] || a.localeCompare(b));
    const never = mgrs.filter((m) => !(m.titles || []).length).sort((a, b) => b.seasonsPlayed - a.seasonsPlayed);

    const ins = [];
    const add = (label, value, cls) => ins.push({ label: label, value: value, cls: cls });
    const reign = champs[champs.length - 1];
    if (reign) {
      const prevC = champs[champs.length - 2], rm = HISTORY.managers[reign.manager];
      const n = rm ? rm.titles.length : 1, others = rm ? rm.titles.filter((y) => y !== reign.year) : [];
      add('reigning champion (' + reign.year + ')', reign.manager + ' · ' + nz(reign.team) + ' — ' + ordinal(n) + ' title' + (others.length ? ' (also ' + others.join(', ') + ')' : '') + (prevC && prevC.manager === reign.manager ? ' — BACK-TO-BACK' : ''), 'a');
    }
    const st = maxBy(mgrs, (m) => m.activePlayoffStreak); if (st.v > 0) add('longest active playoff streak', names(st.items) + ' · ' + st.v + ' straight');
    const dr = maxBy(mgrs, (m) => m.activePlayoffDrought); if (dr.v > 0) add('longest active playoff drought', names(dr.items) + ' · ' + dr.v + ' season' + (dr.v === 1 ? '' : 's') + ' and counting', 'r');
    const wait = maxBy(never, (m) => m.seasonsPlayed); if (wait.items.length) add('longest wait for a first title', names(wait.items) + ' · ' + wait.v + ' seasons, 0 rings', 'r');
    const since = minBy(mgrs.filter((m) => isNum(m.lastTitle)), (m) => m.lastTitle); if (since.items.length) add('longest since last title', names(since.items) + ' · last ring ' + since.v + ' (' + (lastYear - since.v) + ' seasons ago)');
    const bestAvg = minBy(mgrs, (m) => m.avgFinish); add('best all-time avg finish', names(bestAvg.items) + ' · ' + fmt(bestAvg.v, 2), 'a');
    const worstAvg = maxBy(mgrs, (m) => m.avgFinish); add('worst all-time avg finish', names(worstAvg.items) + ' · ' + fmt(worstAvg.v, 2) + (worstAvg.items.every((m) => m.seasonsPlayed < 3) ? ' (' + worstAvg.items[0].seasonsPlayed + ' season sample)' : ''), 'r');
    const worst3 = maxBy(mgrs.filter((m) => m.seasonsPlayed >= 3), (m) => m.avgFinish); if (worst3.items.length && worst3.items[0] !== worstAvg.items[0]) add('worst avg finish, 3+ seasons', names(worst3.items) + ' · ' + fmt(worst3.v, 2), 'r');
    const hiPPG = maxBy(rowsAll, (r) => r.ppg); if (hiPPG.items.length) { const r = hiPPG.items[0]; add('highest single-season PPG ever', r.manager + dep(r.manager) + ' · ' + fmt(r.ppg, 2) + ' (' + r.year + ', ' + nz(r.team) + ')', 'a'); }
    const loPPG = minBy(rowsAll, (r) => r.ppg); if (loPPG.items.length) { const r = loPPG.items[0]; add('lowest single-season PPG ever', r.manager + dep(r.manager) + ' · ' + fmt(r.ppg, 2) + ' (' + r.year + ', ' + nz(r.team) + ')', 'r'); }
    const hiPA = maxBy(rowsAll, (r) => r.pa); if (hiPA.items.length) { const r = hiPA.items[0]; add('most points against in a season', r.manager + dep(r.manager) + ' · ' + fmt(r.pa, 2) + ' (' + r.year + ', ' + nz(r.team) + ')'); }
    const mvAll = maxBy(totalsList, (x) => x.moves); const mvCur = maxBy(mgrs, (m) => m.totalMoves);
    if (mvAll.items.length) add('most transactions all-time', mvAll.items.map((x) => x.name + dep(x.name)).join(' & ') + ' · ' + mvAll.v + (mvCur.items.length && mvAll.items.every((x) => x.name !== mvCur.items[0].name) ? ' — current leader: ' + names(mvCur.items) + ' ' + mvCur.v : ''));
    const mvS = maxBy(rowsAll, (r) => r.moves); if (mvS.items.length) add('most transactions in one season', mvS.items.map((r) => r.manager + dep(r.manager) + ' (' + r.year + ')').join(' & ') + ' · ' + mvS.v);
    const mvF = minBy(rowsAll, (r) => r.moves); if (mvF.items.length) add('fewest transactions in one season', mvF.items.map((r) => r.manager + dep(r.manager) + ' (' + r.year + ')').join(' & ') + ' · ' + mvF.v);
    const totalMoves = totalsList.reduce((a, x) => a + x.moves, 0); if (totalMoves) add('transactions logged, all managers, all time', totalMoves.toLocaleString());
    const unl = maxBy(mgrs, (m) => m.avgPAHalf); add('unluckiest (highest PA/G since 2019)', names(unl.items) + ' · ' + fmt(unl.v, 2), 'r');
    const luck = minBy(mgrs, (m) => m.avgPAHalf); add('luckiest (lowest PA/G since 2019)', names(luck.items) + ' · ' + fmt(luck.v, 2), 'a');
    const lp = maxBy(mgrs, (m) => (m.lastPlace || []).length); if (lp.v > 0) add('most last-place finishes', lp.items.map((m) => m.name + ' (' + m.lastPlace.join(', ') + ')').join(' & ') + ' · ' + lp.v, 'r');
    const ru = maxBy(never, (m) => (m.runnerUps || []).length); if (ru.v > 0) add('most runner-ups without a title', ru.items.map((m) => m.name + ' (' + m.runnerUps.join(', ') + ')').join(' & ') + ' · ' + ru.v);
    // projected vs history
    const histRank = {}; mgrs.slice().sort((a, b) => a.avgFinish - b.avgFinish).forEach((m, i) => { histRank[m.name] = i + 1; });
    const gaps = TEAMS.filter((t) => histRank[firstNameOf(t.manager)]).map((t) => ({ t: t, h: histRank[firstNameOf(t.manager)], d: t.rank - histRank[firstNameOf(t.manager)] }));
    const under = maxBy(gaps, (g) => g.d), over = minBy(gaps, (g) => g.d);
    if (under.items.length && under.v > 0) add('history says higher (projected vs all-time)', under.items.map((g) => firstNameOf(g.t.manager) + ' · all-time #' + g.h + ' → projected #' + g.t.rank).join(' & '), 'a');
    if (over.items.length && over.v < 0) add('history says lower (projected vs all-time)', over.items.map((g) => firstNameOf(g.t.manager) + ' · all-time #' + g.h + ' → projected #' + g.t.rank).join(' & '), 'r');
    const jump = maxBy(yoy, (y) => y.d); if (jump.items.length) add('biggest year-over-year jump ever', jump.items.map((y) => y.name + dep(y.name) + ' · ' + ordinal(y.from.rank) + ' (' + y.from.year + ') → ' + ordinal(y.to.rank) + ' (' + y.to.year + ')').join(' & '), 'a');
    const fall = minBy(yoy, (y) => y.d); if (fall.items.length) add('biggest collapse ever', fall.items.map((y) => y.name + dep(y.name) + ' · ' + ordinal(y.from.rank) + ' (' + y.from.year + ') → ' + ordinal(y.to.rank) + ' (' + y.to.year + ')').join(' & '), 'r');
    const rate = maxBy(mgrs.filter((m) => m.seasonsPlayed >= 3), (m) => Math.round((m.playoffAppearances / m.seasonsPlayed) * 1000)); if (rate.items.length) add('best playoff rate (3+ seasons)', rate.items.map((m) => m.name + ' · ' + m.playoffAppearances + '/' + m.seasonsPlayed).join(' & ') + ' (' + (rate.v / 10).toFixed(0) + '%)');
    const renames = maxBy(mgrs, (m) => new Set((m.teamNames || []).map((x) => x.team).filter(Boolean)).size); if (renames.v > 1) add('most team-name identities', names(renames.items) + ' · ' + renames.v + ' names in ' + renames.items[0].seasonsPlayed + ' seasons');
    const old = maxBy(TEAMS, (t) => t.avgAge), young = minBy(TEAMS, (t) => t.avgAge);
    if (old.items.length) add(SEASON + ' oldest / youngest roster', old.items.map((t) => firstNameOf(t.manager)).join(' & ') + ' ' + fmt(old.v, 1) + ' / ' + young.items.map((t) => firstNameOf(t.manager)).join(' & ') + ' ' + fmt(young.v, 1));
    const flags = maxBy(TEAMS, (t) => [].concat(t.roster.starters, t.roster.bench).filter((p) => p.status).length); if (flags.v > 0) add(SEASON + ' most injury flags on roster', flags.items.map((t) => firstNameOf(t.manager)).join(' & ') + ' · ' + flags.v + ' flagged', 'r');
    const rbs = maxBy(TEAMS, (t) => t.top30RBs); if (rbs.items.length) add(SEASON + ' most top-30 RBs', rbs.items.map((t) => firstNameOf(t.manager)).join(', ') + ' · ' + rbs.v + ' each');
    return { mgrs: mgrs, champs: champs, seasons: seasons, teamByFirst: teamByFirst, isCurrent: isCurrent, departed: departed, titleCount: titleCount, titled: titled, never: never, ins: ins };
  }

  function renderIntel() {
    store.markRead(INTEL_ID);
    $('#sb-read').textContent = readCountText();
    document.title = 'cat LEAGUE_INTEL.log';
    setStatusPath(HOME_PATH + '/LEAGUE_INTEL.log');
    const I = computeIntel();
    const goHome = () => navigate('#/');
    const p = pane([el('b', { text: 'cat' }), ' LEAGUE_INTEL.log'], I.seasons.length + ' seasons · ' + kb(JSON.stringify(HISTORY).length), 'intel');
    const nav = el('div', { class: 'dnav' }, tbtn('ESC', '← back to index', goHome), el('span', { class: 'sp' }), el('span', { class: 'rbadge', text: 'READ ✓' }));
    p.insertBefore(nav, p.body);
    app.appendChild(p);
    const body = p.body;
    const sect = (txt) => { const s = el('div', { class: 'sect ph' }); s.dataset.text = txt; return s; };

    /* 1. champions */
    const s1 = sect('$ cat champions.txt');
    const ct = table([{ h: 'YEAR' }, { h: 'CHAMPION' }, { h: 'TEAM NAME' }, { h: 'PF', num: true }, { h: 'RECORD' }],
      I.champs.map((c) => { const cur = I.isCurrent(c.manager) && !I.departed.has(c.manager); return {
        cls: 'ph ' + (cur ? 'champ-cur' : 'champ-dep'), cellCls: [null, 'who'],
        cells: [String(c.year), cur ? c.manager : el('span', null, c.manager, span('tag dep', '[departed]')), nz(c.team), fmt(c.pf, 2), nz(c.record)] }; }));
    const titleLine = el('span', { class: 'ln' }, 'title count: ', I.titled.length ? I.titled.map((n, i) => [i ? span('dim', ' · ') : null, el('b', { text: n + ' ' + I.titleCount[n] })]) : '—');
    const neverLine = el('span', { class: 'ln' }, 'never won: ', I.never.length ? I.never.map((m, i) => [i ? span('dim', ' · ') : null, el('b', { text: m.name }), ' (' + m.seasonsPlayed + ' season' + (m.seasonsPlayed === 1 ? '' : 's') + ')']) : '—');
    const champLines = el('div', { class: 'lines ph' }, titleLine, neverLine);
    const champBox = el('div', { class: 'ph' }, box('CHAMPIONS ' + I.champs[0].year + '–' + I.champs[I.champs.length - 1].year, scrollx(ct)));

    /* 2. all-time table (sortable) */
    const s2 = sect('$ ./alltime --sort=avgFinish');
    const cols = [
      { h: 'MANAGER', key: 'name' }, { h: 'CURRENT TEAM', key: 'team' }, { h: 'SEASONS', key: 'seasons', num: true, better: 'high' },
      { h: 'AVG FINISH', key: 'avg', num: true, better: 'low', d: 2 }, { h: 'TITLES', key: 'titles', num: true, better: 'high' }, { h: 'RUNNER-UP', key: 'ru', num: true, better: 'high' },
      { h: 'LAST', key: 'last', num: true, better: 'low' }, { h: 'PLAYOFFS', key: 'po', num: true, better: 'high' }, { h: 'PPG (half)', key: 'ppg', num: true, better: 'high', d: 2 },
      { h: 'PA/G (half)', key: 'pag', num: true, better: 'low', d: 2 }, { h: 'MOVES', key: 'moves', num: true, better: 'high' }];
    const data = I.mgrs.map((m) => ({ name: m.name, team: (I.teamByFirst[m.name] && I.teamByFirst[m.name].name) || m.currentTeam || '—', seasons: m.seasonsPlayed, avg: m.avgFinish,
      titles: m.titles.length, ru: m.runnerUps.length, last: m.lastPlace.length, po: m.playoffAppearances, poTxt: m.playoffAppearances + '/' + m.seasonsPlayed, ppg: m.avgPFHalf, pag: m.avgPAHalf, moves: m.totalMoves }));
    const ext = {}; cols.forEach((c) => { if (c.num) { const vals = data.map((r) => r[c.key]).filter(isNum); ext[c.key] = { max: Math.max.apply(null, vals), min: Math.min.apply(null, vals) }; } });
    const at = table(cols.map((c) => ({ h: c.h, num: c.num, cls: 'sortable' })), []);
    const ths = $$('th', at);
    let sortKey = 'avg', sortDir = 1;
    function drawRows() {
      const rows = data.slice().sort((a, b) => { const x = a[sortKey], y = b[sortKey]; if (typeof x === 'string') return x.localeCompare(y) * sortDir; return ((x == null ? Infinity : x) - (y == null ? Infinity : y)) * sortDir || a.avg - b.avg; });
      at.tbodyEl.textContent = '';
      rows.forEach((r) => {
        const tr = el('tr');
        cols.forEach((c) => {
          const v = r[c.key];
          let cls = c.num ? 'num' : '';
          if (c.num && ext[c.key].max !== ext[c.key].min) { const bestV = c.better === 'low' ? ext[c.key].min : ext[c.key].max, worstV = c.better === 'low' ? ext[c.key].max : ext[c.key].min; if (v === bestV) cls += ' best'; else if (v === worstV) cls += ' worst'; }
          tr.appendChild(el('td', { class: cls, text: c.key === 'po' ? r.poTxt : c.num ? fmt(v, c.d || 0) : String(v) }));
        });
        at.tbodyEl.appendChild(tr);
      });
      ths.forEach((th, i) => { const c = cols[i]; th.classList.toggle('active', c.key === sortKey); th.textContent = c.h + (c.key === sortKey ? (sortDir === 1 ? ' ▲' : ' ▼') : ''); th.setAttribute('aria-sort', c.key === sortKey ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'); });
      s2.dataset.text = '$ ./alltime --sort=' + (cols.find((c) => c.key === sortKey) || cols[0]).key + (sortDir === 1 ? '' : ' --desc');
      if (!s2.classList.contains('ph')) s2.textContent = s2.dataset.text;
    }
    ths.forEach((th, i) => {
      const c = cols[i];
      th.setAttribute('tabindex', '0'); th.setAttribute('role', 'button'); th.title = 'sort by ' + c.h;
      const sortBy = () => { if (sortKey === c.key) sortDir = -sortDir; else { sortKey = c.key; sortDir = c.num && c.better === 'high' ? -1 : 1; } drawRows(); };
      th.addEventListener('click', sortBy);
      th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(); } });
    });
    drawRows();
    const atBox = el('div', { class: 'ph' }, box('ALL-TIME · current managers', scrollx(at)), el('div', { class: 'legend', text: 'click a column header to sort · green = best in column · red = worst' }));

    /* 3. insights */
    const s3 = sect('$ ./insights --season ' + SEASON);
    const insEl = el('div', { class: 'ins ph' });
    const insItems = I.ins.map((x, k) => { const lbl = span('lbl', ''), val = span('val', ''); lbl.dataset.text = x.label; val.dataset.text = x.value; if (x.cls) val.classList.add(x.cls); const it = el('div', { class: 'it ph' }, span('i', '[' + lpad(k + 1, 2).replace(' ', '0') + ']'), lbl, span('lead', ''), val); insEl.appendChild(it); return it; });

    /* 4. standings grid */
    const s4 = sect('$ cat standings_by_year.txt');
    const colMgrs = TEAMS.map((t) => firstNameOf(t.manager)).filter((n) => HISTORY.managers[n]);
    const gt = table([{ h: 'YEAR' }].concat(colMgrs.map((n) => ({ h: n }))),
      I.seasons.map((s) => ({ cls: 'ph', cells: [String(s.year)].concat(colMgrs.map((n) => {
        const st = (s.standings || []).find((x) => x.manager === n);
        if (!st || !isNum(st.rank)) return span('na', '·');
        if (st.rank === 1) return span('g1', '1 🏆');
        return span(st.rank === 10 ? 'g10' : st.playoffs ? 'po' : 'np', String(st.rank));
      })) })).concat([{ cls: 'ph', cells: ['AVG'].concat(colMgrs.map((n) => span('np', fmt(HISTORY.managers[n].avgFinish, 2)))) }]), 'grid');
    $$('td > span', gt).forEach((sp) => { sp.parentNode.className = sp.className; sp.parentNode.textContent = sp.textContent; });
    const gridBox = el('div', { class: 'ph' }, box('FINISH BY YEAR', scrollx(gt)), el('div', { class: 'legend', text: '1 🏆 = champion · red = last place · bright = playoffs · dim = missed · = not in league' }));

    const foot = el('div', { class: 'eof ph' }, tbtn('ESC', 'back', goHome), span('e', 'EOF'));
    body.append(s1, champBox, champLines, s2, atBox, s3, insEl, s4, gridBox, foot);

    const seq = new Seq();
    const show = (n) => n.classList.remove('ph');
    const header = (n, instant) => { show(n); scramble(n, n.dataset.text, instant ? 0 : 260); };
    seq.add((i) => { header(s1, i); show(champBox); stagger($$('tr.ph', ct), 40); }, 480)
      .add(() => show(champLines), 200)
      .add((i) => { header(s2, i); show(atBox); }, 260)
      .add((i) => { header(s3, i); show(insEl);
        (function next(k) { if (k >= insItems.length) return; const it = insItems[k]; show(it); const lbl = $('.lbl', it), val = $('.val', it);
          if (i || seq.done || REDUCED) { lbl.textContent = lbl.dataset.text; val.textContent = val.dataset.text; next(k + 1); return; }
          typewriter(lbl, lbl.dataset.text, 400, () => { scramble(val, val.dataset.text, 260); anim.timeout(() => next(k + 1), 40); }); })(0); }, 320)
      .add((i) => { header(s4, i); show(gridBox); stagger($$('tr.ph', gt), 35); }, 200)
      .add(() => show(foot), 0)
      .start();
    bindSkip(seq, app);
    glitchLoop(app);
    anim.on(document, 'keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); goHome(); } });
  }

  /* ---------------------------------------------------------- 9. status bar */
  function setStatusPath(path) {
    const e = $('#sb-path'); if (!e) return;
    const i = path.lastIndexOf('/');
    e.textContent = ''; e.title = path;
    e.append(span('sb-dir', i >= 0 ? path.slice(0, i + 1) : ''), span('sb-file', i >= 0 ? path.slice(i + 1) : path));
  }
  function startStatusBar() {
    const clock = $('#sb-clock'), log = $('#sb-log');
    const tick = () => { const d = new Date(); clock.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':'); };
    tick(); setInterval(tick, 1000);
    $('#sb-read').textContent = readCountText();
    if (!log) return;
    if (REDUCED) { log.textContent = 'link yahoo.com [OK] · tick'; return; }
    const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    const msgs = [
      ['rx', () => 'rx 0x' + hex() + ' ← yahoo.com'], ['tx', () => 'tx 0x' + hex() + ' → league/' + LEAGUE_ID], ['', () => 'tick'],
      ['w', () => 'ARP who-has belsky.local'], ['rx', () => 'rx 0x' + hex() + ' ← espn.com [blocked]'], ['', () => 'keepalive ' + Math.round(rnd(8, 40)) + 'ms'],
      ['', () => 'decrypt ' + store.count() + '/' + TOTAL_FILES + ' ok'], ['w', () => 'burger.status = NOT_EATEN'],
      ['tx', () => 'syn → ' + (TEAMS.length ? pick(TEAMS).slug : 'league') + ':22'], ['w', () => 'cron: ben.dues.reminder FAILED'], ['', () => 'tick']
    ];
    const items = [];
    const push = () => { const m = pick(msgs); const s = span(m[0], m[1]()); log.appendChild(s); items.push(s); while (items.length > 4) items.shift().remove(); };
    push(); push(); push();
    setInterval(() => { if (!document.hidden) push(); }, 1400);
  }

  /* ------------------------------------------------------- 10. router + init */
  function parseHash() {
    const h = location.hash || '#/';
    let m;
    if ((m = h.match(/^#\/t\/([A-Za-z0-9_-]+)/))) return { view: 'team', slug: m[1] };
    if (/^#\/intel/.test(h)) return { view: 'intel' };
    if (/^#\/sim/.test(h)) return { view: 'sim' };
    return { view: 'list' };
  }
  function navigate(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function render() {
    cancelAnimations();
    app.textContent = '';
    app.classList.remove('flash');
    window.scrollTo(0, 0);
    const r = parseHash();
    try {
      if (r.view === 'team') renderTeam(r.slug);
      else if (r.view === 'intel') renderIntel();
      else if (r.view === 'sim') renderSim();
      else renderList();
    } catch (e) {
      console.error('render failed', e);
      cancelAnimations(); app.textContent = '';
      renderNotFound(r.view === 'team' ? r.slug : r.view);
    }
    $('#sb-read').textContent = readCountText();
  }
  /* audio deck: player.js loads after this file and appends a fixed .adeck bottom-right. Publish its live height as --deck-h so the
     body padding (styles.css) keeps the last list rows / the EOF footer clear of deck + status bar whether the deck is open or closed. */
  function watchDeck() {
    const deck = $('.adeck');
    if (!deck) return false;
    const set = () => document.documentElement.style.setProperty('--deck-h', deck.offsetHeight + 'px');
    set();
    if (window.ResizeObserver) new ResizeObserver(set).observe(deck);
    else { deck.addEventListener('click', () => setTimeout(set, 0)); document.addEventListener('keydown', () => setTimeout(set, 0)); }
    return true;
  }
  let booted = false;
  function init() {
    try { startMatrix(); } catch (e) { console.error(e); }
    try { startStatusBar(); } catch (e) { console.error(e); }
    setTimeout(() => { try { if (!watchDeck()) window.addEventListener('load', watchDeck); } catch (e) { console.error(e); } }, 0);
    window.addEventListener('hashchange', () => { if (booted) render(); });
    runBoot(() => { booted = true; if (parseHash().view !== 'list') decoyDone = true; render(); });   // direct deep links bypass the decoy reveal
  }
  init();
})();
