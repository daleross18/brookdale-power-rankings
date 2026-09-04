# The Brookdale League — 2026 Preseason Power Rankings

Terminal-style static site. No build step. Open `index.html` or visit the GitHub Pages URL.

## Where to edit things

| File | What's in it |
|------|--------------|
| `writeups.js` | **The write-ups** and optional one-line taglines. One entry per team, plain text inside backticks. Blank line = new paragraph. Rendered in all caps with terminal coloring. |
| `data.js` | Rankings, projected records, implied odds, roster stats, win-condition code, rosters, manager names, subtitles, image paths. |
| `history.js` | All-time league history 2014–2025 generated from `League Report.xlsx` (standings, PF/PA, team names, moves, titles). |
| `img/` | `<slug>-profile.jpg` = manager photo (list thumbnail + file page), `<slug>-meme.jpg` = meme on the file page. Replace files, keep the names (or change the paths in `data.js`). |
| `audio/` | Soundtrack. `audio/playlist.js` lists the tracks in play order; they autoplay on loop with a single play/pause button (M toggles). |
| `sim.js` | `SEASON_SIM.exe` — the season simulator (calibrated to the implied odds in `data.js`). |

Read/unread checkmarks are stored in the browser (localStorage). Press `R` on the file list to reset them.

## Local preview

```
python3 -m http.server 8765
# open http://localhost:8765
```
