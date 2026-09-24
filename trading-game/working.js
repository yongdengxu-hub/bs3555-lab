/**
 * BS3555 FX Trading Game: "show the working" for the student dashboard.
 *
 * For each trade and each daily mark on a student's own book, this writes out
 * the calculation the way the exam wants it, with the student's own numbers.
 *
 * RULE: nothing here prices anything a second way. Every number comes from the
 * functions the engine itself uses: mktInputs_, fwdFor_, optGk_ and optFor_
 * (01_Pricing.gs), posValue_ and roundStats_ (03_Engine.gs). Each block then
 * checks its result against what the engine stored or returns, and says so.
 *
 * ROBUSTNESS: getMyState calls buildWorking_ inside try/catch, and every block
 * is built inside its own try/catch, so a failure here can cost at most one
 * block of working, never the dashboard.
 *
 * Student-visible text: plain English, no em-dashes. Lecture and question
 * labels follow the \examlink notes on the 2026 slides; no exam paper's
 * numbers appear anywhere.
 */

var WORK_MAX_POSITIONS = 30;       // newest positions shown, to keep the page short

// ---------------------------------------------------------------- formatting
function wf_(x, d) {
  return (x === null || x === undefined || !isFinite(x)) ? 'n/a' : Number(x).toFixed(d);
}
function wpct_(x, d) { return (x === null || !isFinite(x)) ? 'n/a' : (100 * x).toFixed(d) + '%'; }
function wgbp_(x) {
  if (x === null || x === undefined || !isFinite(x)) return 'n/a';
  var v = Math.abs(x).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (x < 0 ? '-£' : '£') + v;
}
function wqty_(x) {
  var a = Math.abs(x), s = (a % 1 === 0) ? a.toFixed(0) : a.toFixed(2);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function wpair_(ccy) {
  return ccy === 'usd' ? 'USD/GBP, pounds per dollar' : 'EUR/GBP, pounds per euro';
}
function wcheck_(shown, engine, tol, what) {
  var ok = isFinite(shown) && isFinite(engine) && Math.abs(shown - engine) <= tol;
  return { ok: ok, text: ok ? 'Check: this matches the ' + what + ' the game used.'
                            : 'Note: the ' + what + ' the game used is ' + wf_(engine, 6) +
                              '. A small difference can appear before the nightly update has run.' };
}

/** The time and interest-rate lines shared by forward, futures and option working. */
function wTimeLines_(m, ccy) {
  var fc = ccy.toUpperCase();
  return [
    'Time left: ' + m.days + ' trading days. The game uses 252 trading days a year, so T − t = ' +
      m.days + '/252 = ' + wf_(m.t, 4) + ' years. (In the exam, use the day count the question gives.)',
    'Effective returns for that time: r = ' + wpct_(m.rAnn, 2) + ' × ' + wf_(m.t, 4) + ' = ' +
      wpct_(m.r, 4) + ' on GBP (home), and r* = ' + wpct_(m.rsAnn, 2) + ' × ' + wf_(m.t, 4) +
      ' = ' + wpct_(m.rs, 4) + ' on ' + fc + ' (foreign).'
  ];
}

/** CIP forward lines; returns { lines, F } with F exactly the engine's fwdFor_. */
function wForwardLines_(px, ccy, days) {
  var m = mktInputs_(px, ccy, Math.max(days, 1));
  var F = cipForward(m.S, m.r, m.rs);
  var lines = ['Spot S = ' + wf_(m.S, 5) + ' (' + wpair_(ccy) + ').'].concat(wTimeLines_(m, ccy));
  lines.push('Covered interest parity: F = S × (1 + r) / (1 + r*) = ' + wf_(m.S, 5) + ' × ' +
             wf_(1 + m.r, 6) + ' / ' + wf_(1 + m.rs, 6) + ' = ' + wf_(F, 5) + '.');
  return { lines: lines, F: F, m: m };
}

/** Garman-Kohlhagen lines; the result is exactly the engine's optGk_. */
function wGkLines_(px, ccy, kind, X, daysLeft) {
  var m = mktInputs_(px, ccy, Math.max(daysLeft, 0.5));
  var g = optGk_(px, ccy, X, daysLeft);
  var prem = (kind === 'call') ? g.call : g.put;
  var sig = m.volAnn * Math.sqrt(m.t);
  var lines = ['Spot S = ' + wf_(m.S, 5) + ' (' + wpair_(ccy) + '), strike X = ' + wf_(X, 4) + '.']
    .concat(wTimeLines_(m, ccy));
  lines.push('Forward: F = S × (1 + r) / (1 + r*) = ' + wf_(g.F, 5) + '.');
  if (!(sig > 0) || !isFinite(g.d1)) {
    lines.push('Volatility is zero, so the option is worth its discounted forward payoff: ' +
               wf_(prem, 5) + ' per unit.');
    return { lines: lines, prem: prem, g: g, m: m };
  }
  var d1r = Math.round(g.d1 * 100) / 100, d2r = Math.round(g.d2 * 100) / 100;
  lines.push('Volatility: σ = ' + wpct_(m.volAnn, 2) + ' p.a. (realised). For that time, σ × √(T − t) = ' +
             wpct_(m.volAnn, 2) + ' × ' + wf_(Math.sqrt(m.t), 4) + ' = ' + wf_(sig, 4) + '.');
  lines.push('d1 = ln(F/X) / (σ√(T − t)) + σ√(T − t) / 2 = ' +
             wf_(Math.log(g.F / X), 5) + ' / ' + wf_(sig, 4) + ' + ' + wf_(sig / 2, 4) +
             ' = ' + wf_(g.d1, 4) + '.');
  lines.push('d2 = d1 - σ√(T − t) = ' + wf_(g.d1, 4) + ' - ' + wf_(sig, 4) + ' = ' +
             wf_(g.d2, 4) + '.');
  lines.push('N(d1) = ' + wf_(g.Nd1, 4) + ', N(d2) = ' + wf_(g.Nd2, 4) +
             '. The game uses the exact normal distribution. In the exam you round d to two ' +
             'decimals and read the table: N(' + wf_(d1r, 2) + ') = ' + wf_(normCdf(d1r), 4) +
             ', N(' + wf_(d2r, 2) + ') = ' + wf_(normCdf(d2r), 4) + '.');
  var sLeg = m.S / (1 + m.rs), xLeg = X / (1 + m.r);
  if (kind === 'call') {
    lines.push('Call = S/(1 + r*) × N(d1) - X/(1 + r) × N(d2) = ' + wf_(sLeg, 4) + ' × ' +
               wf_(g.Nd1, 4) + ' - ' + wf_(xLeg, 4) + ' × ' + wf_(g.Nd2, 4) + ' = ' +
               wf_(sLeg * g.Nd1, 5) + ' - ' + wf_(xLeg * g.Nd2, 5) + ' = ' + wf_(prem, 5) +
               ' per unit. Note r* discounts the spot and r discounts the strike.');
    lines.push('Delta = N(d1)/(1 + r*) = ' + wf_(g.Nd1, 4) + ' / ' + wf_(1 + m.rs, 6) + ' = ' +
               wf_(g.deltaCall, 4) + ' units of foreign currency per call.');
  } else {
    var dPut = -(1 - g.Nd1) / (1 + m.rs);
    lines.push('Put = X/(1 + r) × (1 - N(d2)) - S/(1 + r*) × (1 - N(d1)) = ' + wf_(xLeg, 4) +
               ' × ' + wf_(1 - g.Nd2, 4) + ' - ' + wf_(sLeg, 4) + ' × ' + wf_(1 - g.Nd1, 4) + ' = ' +
               wf_(xLeg * (1 - g.Nd2), 5) + ' - ' + wf_(sLeg * (1 - g.Nd1), 5) + ' = ' +
               wf_(prem, 5) + ' per unit. Note r discounts the strike and r* discounts the spot.');
    lines.push('Delta = -(1 - N(d1))/(1 + r*) = ' + wf_(dPut, 4) +
               ' units of foreign currency per put.');
  }
  return { lines: lines, prem: prem, g: g, m: m };
}

// ---------------------------------------------------------------- the blocks
function wKindName_(p) {
  return { fwd: 'Forward', fut: 'Future', call: 'Call', put: 'Put' }[p.kind] || p.kind;
}
function wSideName_(p) {
  if (p.kind === 'call' || p.kind === 'put') return p.qty > 0 ? 'bought' : 'written (sold)';
  return p.qty > 0 ? 'bought (long)' : 'sold (short)';
}

/** How the position was filled, on its fill day. */
function wFillBlock_(c, P, p) {
  var i0 = P.idx[p.openDate];
  if (i0 === undefined) return null;
  var px0 = P.rows[i0], ccy = p.ccy, days = p.matIdx - i0, fc = ccy.toUpperCase();
  var head = p.posId + ' ' + wKindName_(p) + ' ' + fc + ', ' + wqty_(p.qty) + ' ' + wSideName_(p) +
             ' on ' + p.openDate;

  if (p.kind === 'fwd' || p.kind === 'fut') {
    var w = wForwardLines_(px0, ccy, days);
    var cost = (p.kind === 'fwd') ? c.COST_FWD : c.COST_FUT, sgn = p.qty > 0 ? 1 : -1;
    var Ffill = w.F * (1 + sgn * cost);
    w.lines.push('Dealing cost: you ' + (sgn > 0 ? 'buy slightly above' : 'sell slightly below') +
                 ' the mid rate, as with a bank\'s ' + (sgn > 0 ? 'ask' : 'bid') + ' (Lecture 1): ' +
                 wf_(w.F, 5) + ' × (1 ' + (sgn > 0 ? '+ ' : '- ') + wpct_(cost, 2) + ') = ' +
                 wf_(Ffill, 5) + '. This is your contract rate.');
    if (p.kind === 'fut') {
      w.lines.push('Futures are priced off the same CIP rate (Lecture 4: the difference is negligible ' +
                   'at these maturities). Initial margin: ' + wpct_(c.MARGIN_FUT, 0) + ' × ' +
                   wqty_(p.qty) + ' × ' + wf_(px0[ccy], 4) + ' = ' +
                   wgbp_(c.MARGIN_FUT * Math.abs(p.qty) * px0[ccy]) + '.');
    }
    return { title: 'Fill: ' + head,
             label: p.kind === 'fwd'
               ? 'Lecture 2: covered interest parity, the forward rate behind exam Question 2'
               : 'Lecture 4: a futures price and its initial margin',
             lines: w.lines, check: wcheck_(Ffill, +p.entry, 1e-6, 'fill price') };
  }

  // options
  var o = wGkLines_(px0, ccy, p.kind, +p.strike, days);
  var cost2 = c.COST_OPT, sgn2 = p.qty > 0 ? 1 : -1;
  o.lines.push('Premium for ' + wqty_(p.qty) + ' units: ' + wqty_(p.qty) + ' × ' + wf_(o.prem, 5) +
               ' × (1 ' + (sgn2 > 0 ? '+ ' : '- ') + wpct_(cost2, 0) + ' dealing cost) = ' +
               wgbp_(Math.abs(p.qty) * o.prem * (1 + sgn2 * cost2)) +
               (sgn2 > 0 ? ' paid.' : ' received.'));
  return { title: 'Fill: ' + head + ', strike ' + wf_(+p.strike, 4),
           label: 'Lecture 6: Garman-Kohlhagen, like exam Question 4(i); delta as in Question 4(ii)',
           lines: o.lines,
           check: wcheck_(o.prem, +p.entry, 1e-6, 'premium') };
}

/** Today's value (forward, option) or today's marking-to-market flow (future). */
function wMarkBlock_(c, P, i, p, full) {
  var px = P.rows[i], ccy = p.ccy, i0 = P.idx[p.openDate], left = p.matIdx - i;
  var head = p.posId + ' ' + wKindName_(p) + ' ' + ccy.toUpperCase() + ', ' + wqty_(p.qty) + ' ' +
             wSideName_(p) + ', as of ' + px.date;
  var engineVal = posValue_(px, i, p);

  if (p.kind === 'fwd') {
    var w = wForwardLines_(px, ccy, Math.max(left, 1));
    var V = p.qty * (w.F - p.entry) / (1 + w.m.r);
    w.lines.push('Close it out with the opposite forward at today\'s rate: the currency legs cancel and ' +
                 'the net cash at maturity is (F_t - F_0) × size = (' + wf_(w.F, 5) + ' - ' +
                 wf_(p.entry, 5) + ') × ' + (p.qty < 0 ? '-' : '') + wqty_(p.qty) + ' = ' +
                 wgbp_(p.qty * (w.F - p.entry)) + '.');
    w.lines.push('Discount at the home rate: V = (F_t - F_0) / (1 + r) × size = ' +
                 wgbp_(p.qty * (w.F - p.entry)) + ' / ' + wf_(1 + w.m.r, 6) + ' = ' + wgbp_(V) + '.');
    return { title: 'Value today: ' + head, label:
             'Lecture 2: value of an outstanding forward, like exam Question 2(b)',
             lines: w.lines, check: wcheck_(V, engineVal, 1e-9, 'value') };
  }

  if (p.kind === 'fut') {
    var lines = [], chk = null;
    var fNow = fwdFor_(px, ccy, Math.max(left, 1));
    if (i0 === undefined || i <= i0) {
      lines.push('Opened today. The first daily cash flow comes at the next close.');
    } else {
      var fPrev = (i - 1 === i0) ? +p.entry : fwdFor_(P.rows[i - 1], ccy, Math.max(p.matIdx - (i - 1), 1));
      var flow = p.qty * (fNow - fPrev);
      lines.push('Settlement price: yesterday f = ' + wf_(fPrev, 5) + (i - 1 === i0 ? ' (your contract rate)' : '') +
                 ', today f = ' + wf_(fNow, 5) + ' (the CIP rate for the ' + Math.max(left, 1) +
                 ' trading days left).');
      lines.push('Today\'s cash flow = (f_today - f_yesterday) × size = (' + wf_(fNow, 5) + ' - ' +
                 wf_(fPrev, 5) + ') × ' + (p.qty < 0 ? '-' : '') + wqty_(p.qty) + ' = ' + wgbp_(flow) +
                 (flow >= 0 ? ', paid into your cash.' : ', taken from your cash.'));
      chk = (p.lastF === null || p.lastF === undefined || p.lastF === '') ? null
            : wcheck_(fNow, +p.lastF, 1e-6, 'settlement price');
    }
    var total = p.qty * (fNow - p.entry);
    var im = c.MARGIN_FUT * Math.abs(p.qty) * (i0 === undefined ? px[ccy] : P.rows[i0][ccy]);
    lines.push('Total since you opened = (f_today - f_entry) × size = (' + wf_(fNow, 5) + ' - ' +
               wf_(p.entry, 5) + ') × ' + (p.qty < 0 ? '-' : '') + wqty_(p.qty) + ' = ' + wgbp_(total) +
               '. The daily flows add up to this, ignoring interest.');
    lines.push('Margin account, exam style: initial margin ' + wgbp_(im) + ' plus the flows so far gives a balance of ' +
               wgbp_(im + total) + '. In the exam (Lecture 4) you test the balance after each day\'s flow: ' +
               'if it is below the maintenance level, the call tops it back up to the initial margin, ' +
               'call = initial - balance.');
    if (full) {
      lines.push('The game is simpler: one margin level, no maintenance level and no top-up. Each day it compares ' +
                 'your whole net worth with the margin required on all your futures and written options, ' +
                 'today ' + wgbp_(full.nav) + ' against ' + wgbp_(full.margin) + '. ' +
                 (full.nav >= full.margin ? 'Net worth is higher, so nothing happens.'
                   : 'Net worth is lower, so every position is closed at today\'s price.'));
    }
    return { title: 'Marking to market today: ' + head,
             label: 'Lecture 4: marking to market, like exam Question 3(a)', lines: lines, check: chk };
  }

  // options
  var o = wGkLines_(px, ccy, p.kind, +p.strike, left);
  var Vo = p.qty * o.prem;
  o.lines.push('Value of your ' + wqty_(p.qty) + ' ' + (p.qty > 0 ? 'bought' : 'written') + ' units: ' +
               (p.qty < 0 ? '-' : '') + wqty_(p.qty) + ' × ' + wf_(o.prem, 5) + ' = ' + wgbp_(Vo) + '.');
  if (isFinite(o.g.Nd1)) {
    var dUnit = (p.kind === 'call') ? o.g.deltaCall : -(1 - o.g.Nd1) / (1 + o.m.rs);
    var dPos = p.qty * dUnit, nFc = wqty_(Math.round(Math.abs(dPos))) + ' ' + ccy.toUpperCase();
    o.lines.push('Your position behaves like ' + (dPos >= 0 ? 'holding ' : 'owing ') + nFc +
                 ' (size × delta). To delta-hedge it (Lecture 6) you would ' +
                 (dPos >= 0 ? 'sell ' : 'buy ') + nFc + ', and adjust as delta changes.');
  }
  return { title: 'Value today: ' + head + ', strike ' + wf_(+p.strike, 4),
           label: 'Lecture 6: Garman-Kohlhagen, like exam Question 4(i); delta as in Question 4(ii)',
           lines: o.lines, check: wcheck_(Vo, engineVal, 1e-9, 'value') };
}

/** Settlement of a forward or an option that has reached its maturity date. */
function wExpiryBlock_(P, p) {
  if (p.kind === 'fut' || !P.rows[p.matIdx]) return null;
  var ST = P.rows[p.matIdx][p.ccy], lines = [], cash;
  var head = p.posId + ' ' + wKindName_(p) + ' ' + p.ccy.toUpperCase() + ', ' + wqty_(p.qty) + ' ' +
             wSideName_(p) + ', matured ' + P.rows[p.matIdx].date;
  if (p.kind === 'fwd') {
    cash = p.qty * (ST - p.entry);
    lines.push('At maturity the forward rate is the spot rate, so the value is (S_T - F_0) × size = (' +
               wf_(ST, 5) + ' - ' + wf_(p.entry, 5) + ') × ' + (p.qty < 0 ? '-' : '') + wqty_(p.qty) +
               ' = ' + wgbp_(cash) + ', settled in cash.');
    return { title: 'Settlement: ' + head, label: 'Lecture 2: value of a forward at expiry',
             lines: lines, check: null };
  }
  var X = +p.strike, pay = (p.kind === 'call') ? Math.max(ST - X, 0) : Math.max(X - ST, 0);
  cash = p.qty * pay;
  lines.push('Payoff per unit = ' + (p.kind === 'call' ? 'max(S_T - X, 0) = max(' + wf_(ST, 5) + ' - ' + wf_(X, 4)
                                                       : 'max(X - S_T, 0) = max(' + wf_(X, 4) + ' - ' + wf_(ST, 5)) +
             ', 0) = ' + wf_(pay, 5) + '. Times ' + (p.qty < 0 ? '-' : '') + wqty_(p.qty) + ' = ' + wgbp_(cash) +
             ', settled in cash.');
  return { title: 'Settlement: ' + head, label: 'Lecture 5: the payoff of an option at expiry',
           lines: lines, check: null };
}

/** A spot fill: mid rate plus or minus the dealing cost. */
function wSpotBlock_(c, P, o) {
  var d = ymd_(o.fillDate), k = P.idx[d], ccy = String(o.ccy).toLowerCase().trim();
  if (k === undefined || (ccy !== 'usd' && ccy !== 'eur')) return null;
  var sell = String(o.dir).toLowerCase().indexOf('sell') >= 0 || String(o.dir).indexOf('-') === 0 || +o.dir === -1;
  var q = Math.abs(Number(o.qty) || 0), S = P.rows[k][ccy];
  var paid = S * (1 + (sell ? -1 : 1) * c.COST_SPOT);
  return { title: 'Fill: spot ' + (sell ? 'sale' : 'purchase') + ' of ' + wqty_(q) + ' ' + ccy.toUpperCase() + ' on ' + d,
           label: 'Lecture 1: dealing at the bid or the ask',
           lines: ['Mid rate S = ' + wf_(S, 5) + ' (' + wpair_(ccy) + ').',
                   'You ' + (sell ? 'sell at the bank\'s bid, slightly below the mid' : 'buy at the bank\'s ask, slightly above the mid') +
                   ': ' + wf_(S, 5) + ' × (1 ' + (sell ? '- ' : '+ ') + wpct_(c.COST_SPOT, 2) + ') = ' + wf_(paid, 5) + '.',
                   (sell ? 'You receive ' : 'You pay ') + wqty_(q) + ' × ' + wf_(paid, 5) + ' = ' + wgbp_(q * paid) + '.'],
           check: wcheck_(S, +o.fillPx, 1e-6, 'mid rate') };
}

/** Hedge effectiveness so far this round, in one line with the numbers. */
function wHedgeBlock_(c, P, rd, myNav, frozen) {
  if (!rd) return null;
  var navs = myNav.filter(function (n) { return +n.round === +rd.round; })
                  .map(function (n) { return { d: ymd_(n.date), nav: +n.nav }; })
                  .sort(function (x, y) { return x.d < y.d ? -1 : (x.d > y.d ? 1 : 0); });
  var m = roundStats_(c, P, rd, navs);
  var lines = [], chk = null;
  if (m.he === null) {
    lines.push('Hedge effectiveness needs at least four trading days of this round. It will appear here then.');
  } else {
    lines.push('Your net worth, day to day over ' + m.nDays + ' days: standard deviation s = ' + wpct_(m.sdDaily, 4) + '.');
    lines.push('If you had done nothing (your capital plus the unhedged mandate): s₀ = ' + wpct_(m.benchSdDaily, 4) + '.');
    lines.push('Hedge effectiveness = 1 − (s / s₀)² = 1 − (' + wpct_(m.sdDaily, 4) + ' / ' + wpct_(m.benchSdDaily, 4) +
               ')² = ' + wpct_(m.he, 1) + '. It is the share of the variance you removed, the same idea as the R² of a hedge.');
    if (frozen && frozen.hedgeEff !== '' && frozen.hedgeEff !== null && frozen.hedgeEff !== undefined) {
      chk = wcheck_(Math.round(m.he * 100), +frozen.hedgeEff, 0.5, 'round score');
    }
  }
  return { title: 'Hedge effectiveness, round ' + rd.round + (frozen ? ' (final)' : ' so far'),
           label: 'Lecture 4: how much risk a hedge removes', lines: lines, check: chk };
}

/**
 * All the working for one student's current round.
 * positions: this player's positions (as getMyState maps them, with round);
 * myOrders / myNav / myResults: this player's rows from Orders / NAV / RoundResults;
 * full: stateOf_ today (nav, margin); rd: the current round from loadRounds_.
 */
function buildWorking_(c, P, i, a, positions, myOrders, myNav, myResults, full, rd) {
  var blocks = [];
  function add(fn) {
    try { var b = fn(); if (b) blocks.push(b); }
    catch (e) {
      blocks.push({ title: 'Working not available for one item', label: '',
                    lines: ['This item could not be worked out (' + e.message + '). Your book is not affected.'],
                    check: null });
    }
  }
  var frozen = null;
  (myResults || []).forEach(function (r) { if (rd && +r.round === +rd.round) frozen = r; });
  add(function () { return wHedgeBlock_(c, P, rd, myNav || [], frozen); });

  var mine = positions.filter(function (p) { return +p.round === +a.round; })
    .sort(function (x, y) {
      return parseInt(String(x.posId).replace(/\D/g, ''), 10) - parseInt(String(y.posId).replace(/\D/g, ''), 10);
    }).slice(-WORK_MAX_POSITIONS);
  mine.forEach(function (p) {
    add(function () { return wFillBlock_(c, P, p); });
    if (p.status === 'OPEN') add(function () { return wMarkBlock_(c, P, i, p, full); });
    else if (p.status === 'EXPIRED') add(function () { return wExpiryBlock_(P, p); });
  });

  if (rd) {
    (myOrders || []).forEach(function (o) {
      if (String(o.kind).toLowerCase().trim() !== 'spot' || String(o.status).toUpperCase() !== 'FILLED') return;
      var d = ymd_(o.fillDate);
      if (d < rd.startDate || d > rd.endDate) return;
      add(function () { return wSpotBlock_(c, P, o); });
    });
  }
  return { asOf: P.rows[i].date, round: a.round, blocks: blocks };
}
