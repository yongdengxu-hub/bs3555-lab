# BST3553 interactive lab

Static, no-login browser widgets for BST3553 International Finance (Cardiff Business School,
autumn semester): FX quotes and arbitrage, covered interest parity, forward hedging, futures
margining (the real September 2022 mini-budget week), binomial and Garman-Kohlhagen option
pricing, and swap design. Each tool maps to one exam question type and ends with a
"Why this matters" panel of real episodes.

- Live site: https://yongdengxu-hub.github.io/bst3553-lab/
- Sibling project: https://yongdengxu-hub.github.io/bs3551-lab/ (Econometrics)

## Structure

- `index.html` - hub
- `widgets/*.html` - eight self-contained tools
- `assets/styles.css` - Cardiff claret design system (shared with bs3551-lab)
- `assets/fxlib.js` - all the finance maths from first principles (normal CDF, CIP,
  Garman-Kohlhagen, one-period binomial, marking-to-market, swap design)

Only external dependency: Chart.js via cdnjs. No build step, no data collected.

Real data embedded: GBP/USD daily closes 22-30 Sep 2022 (FRED series DEXUSUK) in the margin
simulator; market facts cited to the BIS Triennial Survey 2025 and BIS OTC statistics.

Dr Yongdeng Xu, Cardiff Business School.
