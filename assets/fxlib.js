/* fxlib.js — all FX/derivatives maths for the BS3555 lab, from first principles.
   No dependencies. Everything runs client-side; nothing is collected. */

// ---------- basics ----------
function fmt(x, d = 4) { return Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmt0(x) { return Number(x).toLocaleString("en-GB", { maximumFractionDigits: 0 }); }
function money(x, d = 0) { const s = x < 0 ? "−" : "+"; return s + Math.abs(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }); }

// Mulberry32 PRNG so quizzes are reproducible within a session
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- standard normal ----------
function normCdf(x) {
  // Abramowitz–Stegun 7.1.26, |err| < 7.5e-8
  const b1 = 0.319381530, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429, p = 0.2316419;
  const ax = Math.abs(x), t = 1 / (1 + p * ax);
  const z = Math.exp(-ax * ax / 2) / Math.sqrt(2 * Math.PI);
  const c = 1 - z * (((((b5 * t + b4) * t) + b3) * t + b2) * t + b1) * t;
  return x >= 0 ? c : 1 - c;
}

// ---------- CIP / forwards ----------
// S = HC per FC, r/rstar are EFFECTIVE returns over the period (decimals)
function cipForward(S, r, rstar) { return S * (1 + r) / (1 + rstar); }
function forwardValue(Fnew, Fold, r, size) { return (Fnew - Fold) / (1 + r) * size; }

// ---------- Garman–Kohlhagen (Sercu discrete-rate form) ----------
function gk(S, X, r, rstar, sigmaEff) {
  // sigmaEff = sigma * sqrt(T-t); r, rstar effective over the period
  const F = cipForward(S, r, rstar);
  if (sigmaEff <= 0) { const c = Math.max((F - X) / (1 + r), 0); return { F, d1: NaN, d2: NaN, Nd1: NaN, Nd2: NaN, call: c, put: Math.max((X - F) / (1 + r), 0), deltaCall: NaN, deltaPut: NaN }; }
  const d1 = Math.log(F / X) / sigmaEff + sigmaEff / 2;
  const d2 = d1 - sigmaEff;
  const Nd1 = normCdf(d1), Nd2 = normCdf(d2);
  const call = S / (1 + rstar) * Nd1 - X / (1 + r) * Nd2;
  const put = X / (1 + r) * (1 - Nd2) - S / (1 + rstar) * (1 - Nd1);
  return { F, d1, d2, Nd1, Nd2, call, put, deltaCall: Nd1 / (1 + rstar), deltaPut: -(1 - Nd1) / (1 + rstar) };
}

// ---------- one-period binomial ----------
function binom1(S0, u, d, r, rstar, X, type = "call") {
  const Su = S0 * u, Sd = S0 * d;
  const F = cipForward(S0, r, rstar);
  const payoff = s => type === "call" ? Math.max(s - X, 0) : Math.max(X - s, 0);
  const Cu = payoff(Su), Cd = payoff(Sd);
  const B = (Cu - Cd) / (Su - Sd);                    // exposure / hedge ratio
  const V1 = Cu - B * (Su - F);                        // riskless deposit payoff
  const q = (F - Sd) / (Su - Sd);
  const price = (q * Cu + (1 - q) * Cd) / (1 + r);
  return { Su, Sd, F, Cu, Cd, B, V1, q, price, priceRepl: V1 / (1 + r) };
}

// ---------- marking to market ----------
function mtmPath(settles, entry, size, nContracts, im, mm, longPosition = true) {
  // returns rows {settle, change, cash, balBefore, call, balAfter}; im/mm are TOTALS
  const rows = []; let bal = im, prev = entry, totalCalls = 0, liquidated = false;
  for (let i = 0; i < settles.length; i++) {
    const f = settles[i];
    const dfut = f - prev;
    const cash = (longPosition ? dfut : -dfut) * size * nContracts;
    let call = 0;
    bal += cash;
    const balBefore = bal;
    if (bal < mm) { call = im - bal; totalCalls += call; bal = im; }
    rows.push({ settle: f, change: dfut, cash, balBefore, call, balAfter: bal });
    prev = f;
  }
  return { rows, totalCalls, totalCash: (settles[settles.length - 1] - entry) * size * nContracts * (longPosition ? 1 : -1) };
}

// The real mini-budget week: GBP/USD daily closes (FRED DEXUSUK), 22–30 Sep 2022
const MINIBUDGET = {
  label: ["22 Sep (entry)", "23 Sep", "26 Sep", "27 Sep", "28 Sep", "29 Sep", "30 Sep"],
  rates: [1.1269, 1.0921, 1.0703, 1.0753, 1.0832, 1.1048, 1.1134]
};

// ---------- swap designer ----------
function swapDesign(fixA, fixB, fltA, fltB, bankBp) {
  // fix in %, flt as spread over benchmark in %, bank in % p.a.
  const spreadFix = fixB - fixA, spreadFlt = fltB - fltA;
  const gain = Math.abs(spreadFix - spreadFlt) - bankBp;
  const each = gain / 2;
  return { spreadFix, spreadFlt, gain, each };
}

// ---------- payoffs ----------
function payoffAt(sT, leg) {
  // leg: {kind: 'call'|'put'|'forward'|'spot', dir: +1 long / -1 short, X, prem}
  let v = 0;
  if (leg.kind === "call") v = Math.max(sT - leg.X, 0);
  else if (leg.kind === "put") v = Math.max(leg.X - sT, 0);
  else if (leg.kind === "forward") v = sT - leg.X;
  else v = sT;
  return leg.dir * (v - (leg.prem || 0) * (leg.kind === "call" || leg.kind === "put" ? 1 : 0));
}

// ---------- chart helpers ----------
const BRAND = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#8A1538";
const INK = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#222";
function baseChartOpts(xTitle, yTitle) {
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { labels: { boxWidth: 18 } } },
    scales: {
      x: { title: { display: !!xTitle, text: xTitle }, grid: { display: false } },
      y: { title: { display: !!yTitle, text: yTitle } }
    }
  };
}
