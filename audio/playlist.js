// ============================================================================
//  audio/playlist.js — LOCAL LOOP PLAYLIST
//
//  The site's audio.deck plays these in order, on loop, starting at the first click/keypress (the boot screen).
//  Files live in this audio/ folder. Order below = play order (from the "Fivestar" .m3u8 export).
//  Leave the array empty to show the Spotify embed of the "PR" playlist instead.
//  Note: this folder is published publicly with the site — only include music you have the rights to share.
// ============================================================================
window.AUDIO_PLAYLIST = [
  { file: "00-ken-carson-overseas.mp3",           title: "overseas",         artist: "Ken Carson" },
  { file: "01-hevvi-fivestar.m4a",             title: "Fivestar",         artist: "Hevvi" },
  { file: "02-twentythree-i-hate-drugs.m4a",   title: "I HATE DRUGS",     artist: "twentythree" },
  { file: "03-halfadedd-fortunate.m4a",        title: "fortunate",        artist: "halfadedd" },
  { file: "04-twentythree-one-thing-i-love.m4a", title: "One Thing I Love", artist: "twentythree" },
  { file: "05-twentythree-queen-st.m4a",       title: "Queen St",         artist: "twentythree" },
  { file: "06-twentythree-trust-nobody.m4a",   title: "Trust Nobody",     artist: "twentythree" },
];
