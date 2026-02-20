# BTC Wealth Projection Studio

A slick Next.js web app to project Bitcoin wealth over the next 50 years using:
- Fixed annual growth model
- CAGR scenarios (bear/base/bull with probability band)
- Stock-to-flow style curve
- Power-law trend model
- Monte Carlo simulation (p10/p50/p90)
- Halving-cycle model
- Nominal and inflation-adjusted views
- Manual or auto-fetched BTC starting price

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Notes

- Live BTC price is fetched from CoinGecko's public API.
- Projections are hypothetical and not financial advice.
