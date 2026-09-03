# The Brookdale League — 2026 Preseason Power Rankings

Terminal-hacker themed static site. No build step. Open `index.html` or visit the GitHub Pages URL.

## Where to edit things

| File | What's in it |
|------|--------------|
| `writeups.js` | **Your write-ups** and the one-line taglines. One entry per team, plain text inside backticks. Blank line = new paragraph. |
| `data.js` | Rankings, projected records, implied odds, roster stats, win-condition code, rosters, manager names, thumbnail paths. |
| `history.js` | All-time league history 2014–2025 generated from `League Report.xlsx` (standings, PF/PA, team names, moves, titles). |
| `img/` | Thumbnails. Drop the 10 images in using the filenames referenced by `thumb` in `data.js` (`img/01-hoes-mad.png` … `img/10-hogwash.png`). PNG or JPG both work — just match the path. A NO_SIGNAL placeholder shows until the file exists. |

Read/unread checkmarks are stored in the browser (localStorage). Press `R` on the file list to reset them.

## Local preview

```
python3 -m http.server 8765
# open http://localhost:8765
```
