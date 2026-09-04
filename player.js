// ============================================================================
//  player.js — site soundtrack. Autoplays audio/playlist.js in order, on loop. No track info, no controls
//  except one small play/pause button pinned at the bottom of the screen (class .adeck). M also toggles play/pause.
//
//  Browsers block sound until the visitor interacts once; the boot screen's "press any key" / first click is that
//  gesture, so playback starts there. Track position is remembered across reloads (localStorage).
//  Self-contained: builds its own DOM and injects its own CSS; no dependency on app.js.
// ============================================================================
(function () {
  'use strict';
  var STORE_KEY = 'brookdale.audio.2026';
  var playlist = (window.AUDIO_PLAYLIST || []).filter(function (t) { return t && t.file; });
  if (!playlist.length) return;

  var state = load({ index: 0 });
  function load(d) { try { var raw = localStorage.getItem(STORE_KEY); return raw ? Object.assign({}, d, JSON.parse(raw)) : d; } catch (e) { return d; } }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  var css = '' +
    '.adeck{position:fixed;right:14px;bottom:34px;z-index:60;font-family:"IBM Plex Mono","JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1}' +
    '.adeck button{font:inherit;color:var(--green,#4af626);background:#000;border:1px solid var(--green-dim,#1f6e19);padding:6px 10px;min-width:44px;min-height:30px;cursor:pointer;letter-spacing:.04em;-webkit-font-smoothing:antialiased}' +
    '.adeck button:hover,.adeck button:focus-visible{background:#2a2a2a;color:var(--white,#eaeaea);outline:none}' +
    '.adeck button[aria-pressed="true"]{border-color:var(--green,#4af626)}' +
    '@media (max-width:600px){.adeck{right:8px;bottom:30px}}';
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  var audio = new Audio();
  audio.preload = 'auto';
  // Automated/headless browsers (site checks) get a muted player so they never make noise on the machine running them.
  if (navigator.webdriver) audio.muted = true;
  var idx = Math.min(Math.max(0, state.index | 0), playlist.length - 1);
  var wantPlaying = true;

  var deck = document.createElement('div'); deck.className = 'adeck';
  var btn = document.createElement('button');
  btn.type = 'button'; btn.setAttribute('aria-label', 'play / pause soundtrack'); btn.title = 'play / pause  [M]';
  deck.appendChild(btn);
  function mount() { document.body.appendChild(deck); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  function render() { var playing = !audio.paused && !audio.ended; btn.textContent = playing ? '♫ ⏸' : '♫ ▶'; btn.setAttribute('aria-pressed', playing ? 'true' : 'false'); }
  function loadTrack(i) { idx = (i + playlist.length) % playlist.length; audio.src = 'audio/' + playlist[idx].file; state.index = idx; save(); }
  function play() { wantPlaying = true; var p = audio.play(); if (p && p.catch) p.catch(function () { /* blocked until a gesture */ }); }
  function pause() { wantPlaying = false; audio.pause(); }
  function toggle() { if (audio.paused) play(); else pause(); }

  audio.addEventListener('ended', function () { loadTrack(idx + 1); play(); });
  audio.addEventListener('error', function () { loadTrack(idx + 1); if (wantPlaying) setTimeout(play, 800); });
  audio.addEventListener('play', render); audio.addEventListener('pause', render);
  btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.key === 'm' || e.key === 'M') && !/input|textarea|select/i.test((e.target && e.target.tagName) || '')) toggle();
  });

  // Pause when the tab is hidden (switching away / minimizing); resume when it is visible again.
  var pausedByHide = false;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (!audio.paused) { pausedByHide = true; audio.pause(); } }
    else if (pausedByHide) { pausedByHide = false; if (wantPlaying) play(); }
  });
  window.addEventListener('pagehide', function () { try { audio.pause(); } catch (e) { /* ignore */ } });

  // Autoplay: try immediately; if the browser blocks it, start on the first gesture (boot screen keypress / click).
  loadTrack(idx);
  render();
  play();
  var gesture = function () {
    if (wantPlaying && audio.paused) play();
    document.removeEventListener('keydown', gesture, true);
    document.removeEventListener('pointerdown', gesture, true);
  };
  document.addEventListener('keydown', gesture, true);
  document.addEventListener('pointerdown', gesture, true);
})();
