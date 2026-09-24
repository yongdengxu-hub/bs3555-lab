# BS3555 trading game — Apps Script source

Published here so the Apps Script editor can pull it directly (the editor page
cannot reach a local server). Nothing secret lives in these files: they are the
pricing engine, the round logic and the metrics, all of which the module teaches
openly. No exam answers, no student data.

- `engine.gs.txt`     — the whole Apps Script project as one file
- `dashboard.html.txt` — the student dashboard
- `working.js`: the dashboard's "show the working" (07_Working.gs), also
  loaded by `widgets/trading-sim.html` so the practice widget explains trades
  with the same code

These are copies. After any change to the split files, run
`node test/sync_check.js --write` in the module folder to refresh them.

Canonical source, split into readable files, lives in the module folder under
`2026 Autumn (Xu)/TradingGame/apps-script/`.
