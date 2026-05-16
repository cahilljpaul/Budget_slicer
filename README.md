# Budget Slice

Budget Slice is a small browser-based budgeting tool that helps you track how much you can spend each day until your next payday.

## Features

**Budget** (`index.html`)

- Set your next payday (last weekday, fixed date, or custom)
- Track remaining money and target daily spend
- **Log today's spend** — subtracts from balance and compares to your daily target
- Sustainable daily spend, gap vs target, and what-if slider
- Saves settings in local browser storage

**Save & grow** (`savings.html`)

- Monthly take-home and savings percentage
- Goal pots (holiday, car, etc.) with suggested monthly amounts
- Quick wage-split examples (pay yourself first, 50/30/20, envelopes, 1/12 rule)
- Suggested split: living costs, emergency fund, pots, invest/grow
- Illustrative savings and investment product outlines (not financial advice)

## Files

- `index.html` — daily budget page
- `savings.html` — savings planner page
- `shared.js` — storage, money formatting, payday helpers
- `app.js` — budget page logic
- `savings.js` — savings page logic
- `styles.css` — shared styles

## Usage

1. Open `index.html` in your browser (or run a local server).
2. Use the **Budget** tab for daily spending until payday.
3. Use the **Save** tab to plan pots and longer-term savings.

## Notes

- The app runs entirely in the browser; no backend or build step is required.
- Your settings are persisted in local storage so they remain after refreshing the page.
