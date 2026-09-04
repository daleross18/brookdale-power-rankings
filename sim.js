// ============================================================================
//  sim.js — SEASON_SIM.exe : roll a 2026 Brookdale League season.
//
//  Model
//   • Each team's weekly score ~ Normal(BASE + strength_i, SD).  strength_i starts from the projected record
//     (probit of projected win%) and is then calibrated (a few hundred quick seasons) so that each team's
//     simulated playoff frequency matches IMPLIED_PLAYOFF_CHANCES from data.js.  So the dice are loaded
//     exactly as much as the power rankings say they should be.
//   • Schedule: 14 weeks — a full round-robin (every team plays everyone once) plus 5 repeat weeks, order shuffled
//     by the seed.  Higher score wins.  Scores within 0.5 pts tie … within 3.0 pts when Hogwash is involved,
//     because ONLY BELSKY WOULD TIE.
//   • Standings: win% (ties = half), then points for.  Top 6 → playoffs (1 & 2 get byes), 7–10 → consolation.
//   • Playoffs: WC (3v6, 4v5) → semis (1 vs lowest seed, 2 vs other) → final + 3rd-place game.
//     Consolation: 7v10, 8v9 → winners play for 7th, losers play the TOILET BOWL; its loser is LAST PLACE.
//   • Seeded PRNG (mulberry32) so a roll can be reproduced from its hex seed.
//
//  API (used by app.js):  SIM.mount(containerEl) → { destroy() }.  Everything else is internal.
//  Self-contained: injects its own CSS (uses the site's CSS variables when present).
// ============================================================================
window.SIM = (function () {
  'use strict';

  // ---------- RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randn(rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function shuffle(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // Acklam's inverse normal CDF approximation
  function probit(p) {
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425, ph = 1 - pl; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > ph) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  // ---------- MODEL ----------
  const SD = 19;          // per-game score standard deviation
  const BASE = 112;       // league-average weekly score
  const WEEKS = 14;
  const TIE_WINDOW = 0.5, BELSKY_TIE_WINDOW = 3.0;
  let teams = [];         // [{i, slug, name, short, manager, mu, implied:{playoff,finals,champ}, rank}]
  let calibrated = false;

  function shortName(t) { return t.file.replace(/^\d+_/, '').replace(/\.rank$/, ''); }
  function parseRecord(r) { const p = String(r).split('-').map(Number); return { w: p[0] || 0, l: p[1] || 0, t: p[2] || 0 }; }
  function init() {
    if (teams.length) return;
    const src = (window.BROOKDALE && window.BROOKDALE.teams) || [];
    teams = src.map((t, i) => {
      const rec = parseRecord(t.projectedRecord); const g = rec.w + rec.l + rec.t || 14;
      const p = Math.min(0.97, Math.max(0.03, (rec.w + 0.5 * rec.t) / g));
      return { i, slug: t.slug, name: t.name, short: shortName(t), manager: t.manager || '', rank: t.rank,
        mu: probit(p) * SD * Math.SQRT2,
        implied: { playoff: t.playoff.pct, finals: t.finals.pct, champ: t.championship.pct } };
    });
    calibrate();
  }
  // nudge strengths so simulated playoff% ≈ implied playoff% (quick, deterministic seed)
  function calibrate() {
    if (calibrated || teams.length < 4) return;
    for (let iter = 0; iter < 6; iter++) {
      const agg = monteCarlo(300, 0xC0FFEE + iter, false);
      teams.forEach((t) => { const obs = agg[t.i].playoff / 300 * 100; t.mu += (t.implied.playoff - obs) * 0.22; });
    }
    calibrated = true;
  }

  function schedule(rng) {
    // circle method round robin for n teams (n even) → n-1 rounds of n/2 games
    const n = teams.length; const ids = shuffle(teams.map((t) => t.i), rng);
    const rounds = [];
    const arr = ids.slice();
    for (let r = 0; r < n - 1; r++) {
      const games = [];
      for (let k = 0; k < n / 2; k++) games.push([arr[k], arr[n - 1 - k]]);
      rounds.push(games);
      arr.splice(1, 0, arr.pop()); // rotate all but first
    }
    const extra = shuffle(rounds, rng).slice(0, WEEKS - rounds.length);
    return shuffle(rounds.concat(extra), rng);
  }

  function playGame(a, b, rng, week) {
    const sa = BASE + teams[a].mu + randn(rng) * SD, sb = BASE + teams[b].mu + randn(rng) * SD;
    const belsky = teams[a].slug === 'hogwash' || teams[b].slug === 'hogwash';
    const win = belsky ? BELSKY_TIE_WINDOW : TIE_WINDOW;
    const tie = Math.abs(sa - sb) < win;
    return { a, b, sa: +sa.toFixed(1), sb: +sb.toFixed(1), tie, winner: tie ? null : (sa > sb ? a : b), loser: tie ? null : (sa > sb ? b : a), week };
  }

  function simulateSeason(seed) {
    init();
    const rng = mulberry32(seed >>> 0);
    const rec = teams.map((t) => ({ i: t.i, w: 0, l: 0, t: 0, pf: 0, pa: 0 }));
    const weeks = schedule(rng).map((games, wi) => games.map(([a, b]) => {
      const g = playGame(a, b, rng, wi + 1);
      rec[a].pf += g.sa; rec[a].pa += g.sb; rec[b].pf += g.sb; rec[b].pa += g.sa;
      if (g.tie) { rec[a].t++; rec[b].t++; } else { rec[g.winner].w++; rec[g.loser].l++; }
      return g;
    }));
    const pct = (r) => (r.w + 0.5 * r.t) / (r.w + r.l + r.t);
    const standings = rec.slice().sort((x, y) => pct(y) - pct(x) || y.pf - x.pf);
    standings.forEach((r, k) => { r.seed = k + 1; r.pf = +r.pf.toFixed(1); r.pa = +r.pa.toFixed(1); });
    const seedTeam = (n) => standings[n - 1].i;
    // playoffs
    const po = {};
    po.wc = [playGame(seedTeam(3), seedTeam(6), rng, 15), playGame(seedTeam(4), seedTeam(5), rng, 15)].map(untie(rng));
    const wcWinners = po.wc.map((g) => g.winner).sort((x, y) => seedOf(standings, x) - seedOf(standings, y)); // best seed first
    po.semi = [playGame(seedTeam(1), wcWinners[1], rng, 16), playGame(seedTeam(2), wcWinners[0], rng, 16)].map(untie(rng));
    po.final = untie(rng)(playGame(po.semi[0].winner, po.semi[1].winner, rng, 17));
    po.third = untie(rng)(playGame(po.semi[0].loser, po.semi[1].loser, rng, 17));
    // consolation
    const co = {};
    co.r1 = [playGame(seedTeam(7), seedTeam(10), rng, 15), playGame(seedTeam(8), seedTeam(9), rng, 15)].map(untie(rng));
    co.seventh = untie(rng)(playGame(co.r1[0].winner, co.r1[1].winner, rng, 16));
    co.toilet = untie(rng)(playGame(co.r1[0].loser, co.r1[1].loser, rng, 16));
    return { seed, weeks, standings, playoffs: po, consolation: co,
      champion: po.final.winner, runnerUp: po.final.loser, third: po.third.winner, lastPlace: co.toilet.loser,
      ties: weeks.flat().filter((g) => g.tie).length };
  }
  function seedOf(standings, i) { return standings.find((r) => r.i === i).seed; }
  // playoff games cannot tie: replay the coin until someone wins (tiny prob anyway)
  function untie(rng) { return function (g) { let x = g, n = 0; while (x.tie && n++ < 20) x = playGame(g.a, g.b, rng, g.week); if (x.tie) { x.tie = false; x.winner = g.a; x.loser = g.b; } return x; }; }

  function monteCarlo(n, seed0, needInit) {
    if (needInit !== false) init();
    const agg = teams.map((t) => ({ i: t.i, wins: 0, playoff: 0, finals: 0, champ: 0, last: 0, oneSeed: 0, ties: 0 }));
    const rng = mulberry32((seed0 || 1) >>> 0);
    for (let k = 0; k < n; k++) {
      const s = simulateSeason(Math.floor(rng() * 4294967296));
      s.standings.forEach((r) => { agg[r.i].wins += r.w; agg[r.i].ties += r.t; if (r.seed <= 6) agg[r.i].playoff++; if (r.seed === 1) agg[r.i].oneSeed++; });
      agg[s.champion].champ++; agg[s.champion].finals++; agg[s.runnerUp].finals++; agg[s.lastPlace].last++;
    }
    return agg;
  }

  // ---------- UI ----------
  const css = '' +
    '.sim{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--text,#4af626);font-size:13px;line-height:1.5}' +
    '.sim .cmd{color:var(--green,#4af626);margin-bottom:8px;word-break:break-all}' +
    '.sim .cmd .p{color:var(--muted,#a6a6a6)}' +
    '.sim .ctl{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 12px}' +
    '.sim button{font:inherit;color:var(--green,#4af626);background:transparent;border:1px solid var(--green-dim,#1f6e19);padding:6px 10px;cursor:pointer;min-height:36px;letter-spacing:.03em}' +
    '.sim button:hover,.sim button:focus-visible{background:#2a2a2a;color:var(--white,#eaeaea);outline:none}' +
    '.sim button[disabled]{opacity:.45;cursor:default}' +
    '.sim .seed{color:var(--amber,#ffb000)}' +
    '.sim .out{white-space:pre-wrap;margin:0;font:inherit;overflow-x:auto}' +
    '.sim .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px;align-items:start}' +
    '@media (max-width:820px){.sim .grid{grid-template-columns:minmax(0,1fr)}}' +
    '.sim h4{color:var(--green,#4af626);font-weight:normal;margin:14px 0 6px;letter-spacing:.06em}' +
    '.sim h4::before{content:"$ ";color:var(--muted,#a6a6a6)}' +
    '.sim table{border-collapse:collapse;width:100%;font-size:12.5px}' +
    '.sim th,.sim td{padding:2px 8px;text-align:left;white-space:nowrap;border-bottom:1px solid var(--green-ghost,#1f1f1f)}' +
    '.sim th{color:var(--muted,#a6a6a6);font-weight:normal}' +
    '.sim td.n{text-align:right;font-variant-numeric:tabular-nums}' +
    '.sim tr.po td{color:var(--green,#4af626)}.sim tr.bye td:first-child::after{content:" ★";color:var(--amber,#ffb000)}' +
    '.sim tr.out td{color:var(--muted,#a6a6a6)}' +
    '.sim .tbl{overflow-x:auto}.sim .full{margin-top:4px}.sim{-webkit-font-smoothing:antialiased}' +
    '.sim .wk{color:var(--muted,#a6a6a6)}.sim .win{color:var(--green,#4af626)}.sim .tie{color:var(--amber,#ffb000)}' +
    '.sim .champ{color:var(--green,#4af626);font-size:15px;letter-spacing:.08em}' +
    '.sim .last{color:var(--red,#ff4d4d)' +
    '.sim .bar{display:inline-block;height:8px;background:var(--green,#4af626);vertical-align:middle}' +
    '.sim .bar.i{background:var(--amber,#ffb000);box-shadow:none;opacity:.8}' +
    '.sim .note{color:var(--muted,#a6a6a6);font-size:12px;margin-top:10px}' +
    '.sim .prog{height:8px;border:1px solid var(--green-dim,#1f6e19);margin:8px 0;position:relative}.sim .prog i{position:absolute;left:0;top:0;bottom:0;background:var(--green,#4af626);width:0}' +
    '.sim .flash{animation:sim-flash .5s steps(2) 3}@keyframes sim-flash{50%{opacity:.2}}' +
    '@media (prefers-reduced-motion:reduce){.sim .flash{animation:none}}';
  let styleEl = null;
  function ensureCss() { if (styleEl) return; styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl); }

  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function hex(n) { return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0'); }
  function nm(i) { return teams[i].short; }
  function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
  function lpad(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  function mount(container) {
    init(); ensureCss();
    const timers = new Set(); let destroyed = false;
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!destroyed) fn(); }, ms); timers.add(id); return id; };
    const clear = () => { timers.forEach(clearTimeout); timers.clear(); };
    let seed = (Math.random() * 4294967296) >>> 0;
    let speed = 'fast';

    const root = el('div', 'sim');
    const cmd = el('div', 'cmd'); root.appendChild(cmd);
    const ctl = el('div', 'ctl');
    const bRoll = el('button', null, '[ENTER] ROLL SEASON');
    const bMC = el('button', null, 'RUN 10,000 SEASONS');
    const bSpeed = el('button', null, 'SPEED: FAST');
    const bSeed = el('button', null, 'NEW SEED');
    ctl.appendChild(bRoll); ctl.appendChild(bMC); ctl.appendChild(bSpeed); ctl.appendChild(bSeed);
    root.appendChild(ctl);
    const grid = el('div', 'grid');
    const left = el('div'), right = el('div');
    grid.appendChild(left); grid.appendChild(right); root.appendChild(grid);
    const note = el('div', 'note', 'model: weekly score ~ N(strength, ' + SD + '); strengths calibrated so playoff odds match the implied chances in each file. ' +
      'top 6 make the playoffs (1 & 2 bye); 7–10 play the consolation bracket; the toilet bowl loser finishes LAST. ties: scores within ' + TIE_WINDOW + ' pts (' + BELSKY_TIE_WINDOW + ' if Hogwash is involved — only Belsky would tie).');
    root.appendChild(note);
    container.appendChild(root);

    function setCmd(extra) {
      cmd.textContent = '';
      const p = el('span', 'p', 'brookdale@league:~/power-rankings/2026$ '); cmd.appendChild(p);
      cmd.appendChild(document.createTextNode('./season_sim.exe --model=' + ((window.BROOKDALE && window.BROOKDALE.version) || 'v1') + ' --weeks=' + WEEKS + ' --seed='));
      cmd.appendChild(el('span', 'seed', hex(seed)));
      if (extra) cmd.appendChild(document.createTextNode(' ' + extra));
    }
    setCmd('');

    function standingsTable(rec, live) {
      const wrap = el('div', 'tbl'); const t = el('table');
      const th = el('tr'); ['#', 'TEAM', 'MGR', 'W', 'L', 'T', 'PF', 'PA'].forEach((h) => th.appendChild(el('th', null, h))); t.appendChild(th);
      const pct = (r) => (r.w + 0.5 * r.t) / Math.max(1, r.w + r.l + r.t);
      rec.slice().sort((x, y) => pct(y) - pct(x) || y.pf - x.pf).forEach((r, k) => {
        const tr = el('tr', k < 6 ? 'po' + (k < 2 ? ' bye' : '') : 'out');
        [k + 1, nm(r.i), teams[r.i].manager.split(' ')[0], r.w, r.l, r.t, r.pf.toFixed(1), r.pa.toFixed(1)].forEach((v, j) => tr.appendChild(el('td', j >= 3 ? 'n' : null, v)));
        t.appendChild(tr);
      });
      wrap.appendChild(t); return wrap;
    }
    function gameLine(g, label) {
      const line = el('div');
      if (label) line.appendChild(el('span', 'wk', pad(label, 6)));
      if (g.tie) { line.appendChild(el('span', 'tie', nm(g.a) + ' ' + g.sa.toFixed(1) + ' — ' + g.sb.toFixed(1) + ' ' + nm(g.b) + '   TIE')); return line; }
      const w = g.winner === g.a ? g : { a: g.b, b: g.a, sa: g.sb, sb: g.sa };
      line.appendChild(el('span', 'win', nm(w.a) + ' ' + w.sa.toFixed(1)));
      line.appendChild(document.createTextNode('  def  ' + nm(w.b) + ' ' + w.sb.toFixed(1)));
      return line;
    }

    function clearFull() { root.querySelectorAll('.sim > .full').forEach((n) => n.remove()); }
    function roll() {
      clear(); clearFull(); bRoll.disabled = true; bMC.disabled = true;
      const s = simulateSeason(seed);
      setCmd('… rolling');
      left.textContent = ''; right.textContent = '';
      left.appendChild(el('h4', null, 'cat regular_season.log'));
      const log = el('div'); left.appendChild(log);
      right.appendChild(el('h4', null, 'watch standings'));
      const live = teams.map((t) => ({ i: t.i, w: 0, l: 0, t: 0, pf: 0, pa: 0 }));
      let tableEl = standingsTable(live); right.appendChild(tableEl);
      const delay = speed === 'instant' || reduced() ? 0 : 140;
      let wi = 0;
      function step() {
        if (wi >= s.weeks.length) return finish();
        const games = s.weeks[wi];
        const wk = el('div'); wk.appendChild(el('span', 'wk', 'WEEK ' + lpad(wi + 1, 2))); log.appendChild(wk);
        games.forEach((g) => { log.appendChild(gameLine(g, '')); const A = live[g.a], B = live[g.b]; A.pf += g.sa; A.pa += g.sb; B.pf += g.sb; B.pa += g.sa; if (g.tie) { A.t++; B.t++; } else { live[g.winner].w++; live[g.loser].l++; } });
        const nt = standingsTable(live); right.replaceChild(nt, tableEl); tableEl = nt;
        wi++;
        if (delay) later(step, delay); else step();
      }
      function finish() {
        const po = s.playoffs, co = s.consolation;
        const block = el('div');
        block.appendChild(el('h4', null, 'cat playoffs.log'));
        block.appendChild(el('div', 'wk', 'WEEK 15 — WILD CARD   (byes: ' + nm(s.standings[0].i) + ', ' + nm(s.standings[1].i) + ')'));
        po.wc.forEach((g) => block.appendChild(gameLine(g, '')));
        block.appendChild(el('div', 'wk', 'WEEK 16 — SEMIFINALS'));
        po.semi.forEach((g) => block.appendChild(gameLine(g, '')));
        block.appendChild(el('div', 'wk', 'WEEK 17 — CHAMPIONSHIP'));
        block.appendChild(gameLine(po.final, ''));
        block.appendChild(el('div', 'wk', '3RD PLACE GAME'));
        block.appendChild(gameLine(po.third, ''));
        block.appendChild(el('h4', null, 'cat consolation.log'));
        block.appendChild(el('div', 'wk', 'WEEK 15 — CONSOLATION ROUND 1'));
        co.r1.forEach((g) => block.appendChild(gameLine(g, '')));
        block.appendChild(el('div', 'wk', 'WEEK 16 — 7TH PLACE GAME'));
        block.appendChild(gameLine(co.seventh, ''));
        block.appendChild(el('div', 'wk', 'WEEK 16 — TOILET BOWL'));
        block.appendChild(gameLine(co.toilet, ''));
        const res = el('div'); res.style.marginTop = '12px';
        const champ = el('div', 'champ flash', '🏆 CHAMPION: ' + nm(s.champion) + ' (' + teams[s.champion].manager + ')'); res.appendChild(champ);
        res.appendChild(el('div', null, '   RUNNER-UP: ' + nm(s.runnerUp) + '   ·   3RD: ' + nm(s.third) + '   ·   7TH: ' + nm(co.seventh.winner)));
        res.appendChild(el('div', 'last', '☠ LAST PLACE (toilet bowl): ' + nm(s.lastPlace) + ' (' + teams[s.lastPlace].manager + ')'));
        const tieLine = el('div', 'wk', 'ties this season: ' + s.ties + (s.ties ? '   — only Belsky would tie' : '')); res.appendChild(tieLine);
        const oneSeed = s.standings[0];
        res.appendChild(el('div', 'wk', '1-seed: ' + nm(oneSeed.i) + ' (' + oneSeed.w + '-' + oneSeed.l + (oneSeed.t ? '-' + oneSeed.t : '') + ', PF ' + oneSeed.pf.toFixed(1) + ')   seed ' + hex(seed)));
        block.appendChild(res);
        right.appendChild(block);
        setCmd('— done. [ENTER] rolls a new seed.');
        bRoll.disabled = false; bMC.disabled = false;
        seed = (seed * 1664525 + 1013904223) >>> 0; // next seed
        if (typeof window.scrollTo === 'function' && delay) block.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' });
      }
      step();
    }

    function runMC() {
      clear(); clearFull(); bRoll.disabled = true; bMC.disabled = true;
      left.textContent = ''; right.textContent = '';
      left.appendChild(el('h4', null, './season_sim.exe --monte-carlo=10000'));
      const prog = el('div', 'prog'); const fill = el('i'); prog.appendChild(fill); left.appendChild(prog);
      const status = el('div', 'wk', 'simulating…'); left.appendChild(status);
      const N = 10000, CHUNK = 500; let done = 0;
      const agg = teams.map((t) => ({ i: t.i, wins: 0, playoff: 0, finals: 0, champ: 0, last: 0, oneSeed: 0, ties: 0 }));
      const rng = mulberry32(seed);
      function chunk() {
        const part = monteCarloWith(rng, CHUNK);
        part.forEach((p, k) => { const a = agg[k]; Object.keys(p).forEach((key) => { if (key !== 'i') a[key] += p[key]; }); });
        done += CHUNK; fill.style.width = (done / N * 100) + '%'; status.textContent = done.toLocaleString() + ' / ' + N.toLocaleString() + ' seasons';
        if (done < N) later(chunk, 0); else show();
      }
      function show() {
        status.textContent = N.toLocaleString() + ' seasons simulated — sim vs implied (from each team\'s file)';
        const wrap = el('div', 'tbl'); const t = el('table');
        const th = el('tr'); ['#', 'TEAM', 'AVG W', 'PLAYOFF% sim / implied', 'FINALS% sim / implied', 'TITLE% sim / implied', '1-SEED%', 'LAST%'].forEach((h) => th.appendChild(el('th', null, h))); t.appendChild(th);
        agg.slice().sort((x, y) => y.champ - x.champ).forEach((a, k) => {
          const tm = teams[a.i]; const tr = el('tr');
          const cell = (v, cls) => tr.appendChild(el('td', cls || null, v));
          cell(k + 1); cell(nm(a.i));
          cell((a.wins / N).toFixed(1), 'n');
          const pair = (sim, imp) => { const td = el('td', 'n'); td.appendChild(document.createTextNode(lpad(sim.toFixed(1), 5) + '% / ' + lpad(imp, 3) + '%  ')); const b1 = el('span', 'bar'); b1.style.width = Math.max(1, sim) + 'px'; td.appendChild(b1); td.appendChild(document.createTextNode(' ')); const b2 = el('span', 'bar i'); b2.style.width = Math.max(1, imp) + 'px'; td.appendChild(b2); tr.appendChild(td); };
          pair(a.playoff / N * 100, tm.implied.playoff); pair(a.finals / N * 100, tm.implied.finals); pair(a.champ / N * 100, tm.implied.champ);
          cell((a.oneSeed / N * 100).toFixed(1) + '%', 'n'); cell((a.last / N * 100).toFixed(1) + '%', 'n');
          t.appendChild(tr);
        });
        wrap.appendChild(t);
        const full = el('div', 'full'); root.insertBefore(full, note);
        full.appendChild(el('h4', null, 'cat monte_carlo.tsv')); full.appendChild(wrap);
        full.appendChild(el('div', 'wk', 'green bar = simulated · amber bar = implied.  ties per season: ' + (agg.reduce((s, a) => s + a.ties, 0) / 2 / N).toFixed(2)));
        setCmd('— monte carlo done.');
        bRoll.disabled = false; bMC.disabled = false;
      }
      later(chunk, 0);
    }
    function monteCarloWith(rng, n) {
      const agg = teams.map((t) => ({ i: t.i, wins: 0, playoff: 0, finals: 0, champ: 0, last: 0, oneSeed: 0, ties: 0 }));
      for (let k = 0; k < n; k++) {
        const s = simulateSeason(Math.floor(rng() * 4294967296));
        s.standings.forEach((r) => { agg[r.i].wins += r.w; agg[r.i].ties += r.t; if (r.seed <= 6) agg[r.i].playoff++; if (r.seed === 1) agg[r.i].oneSeed++; });
        agg[s.champion].champ++; agg[s.champion].finals++; agg[s.runnerUp].finals++; agg[s.lastPlace].last++;
      }
      return agg;
    }

    bRoll.addEventListener('click', roll);
    bMC.addEventListener('click', runMC);
    bSpeed.addEventListener('click', () => { speed = speed === 'fast' ? 'instant' : 'fast'; bSpeed.textContent = 'SPEED: ' + speed.toUpperCase(); });
    bSeed.addEventListener('click', () => { seed = (Math.random() * 4294967296) >>> 0; setCmd(''); });
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || destroyed) return;
      if (e.key === 'Enter' && !bRoll.disabled && !(e.target && /button/i.test(e.target.tagName))) { e.preventDefault(); roll(); }
    };
    document.addEventListener('keydown', onKey);

    return {
      destroy() { destroyed = true; clear(); document.removeEventListener('keydown', onKey); if (root.parentNode) root.parentNode.removeChild(root); },
      roll, runMC,
    };
  }

  return { mount, simulateSeason, monteCarlo, teams: () => { init(); return teams; } };
})();
