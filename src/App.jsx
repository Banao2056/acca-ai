import { useState, useEffect } from 'react';

// =============================================================
// WINSMART - AI Football Accumulator
// Keys go in Vercel → Settings → Environment Variables:
//   VITE_APISPORTS_KEY  = api-sports.io key
//   VITE_ODDS_KEY       = the-odds-api.com key
//   VITE_ANTHROPIC_KEY  = Anthropic key
// =============================================================

const APISPORTS_KEY = import.meta.env.VITE_APISPORTS_KEY || '';
const ODDS_KEY      = import.meta.env.VITE_ODDS_KEY      || '';
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || '';
const HAS_FIXTURES  = APISPORTS_KEY.length > 5;
const HAS_ODDS      = ODDS_KEY.length > 5;

// =============================================================
// DATE HELPERS
// =============================================================
const fmtDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

const dayLabel = (n) => {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const toTime = (ts) =>
  new Date(ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// =============================================================
// LEAGUES
// =============================================================
const LEAGUES = [
  { id: 39,  name: 'Premier League',   country: 'England',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier: 1 },
  { id: 140, name: 'La Liga',          country: 'Spain',       flag: '🇪🇸', tier: 1 },
  { id: 78,  name: 'Bundesliga',       country: 'Germany',     flag: '🇩🇪', tier: 1 },
  { id: 135, name: 'Serie A',          country: 'Italy',       flag: '🇮🇹', tier: 1 },
  { id: 61,  name: 'Ligue 1',          country: 'France',      flag: '🇫🇷', tier: 1 },
  { id: 2,   name: 'Champions League', country: 'Europe',      flag: '🏆', tier: 1 },
  { id: 3,   name: 'Europa League',    country: 'Europe',      flag: '🥈', tier: 1 },
  { id: 40,  name: 'Championship',     country: 'England',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier: 2 },
  { id: 88,  name: 'Eredivisie',       country: 'Netherlands', flag: '🇳🇱', tier: 2 },
  { id: 94,  name: 'Primeira Liga',    country: 'Portugal',    flag: '🇵🇹', tier: 2 },
  { id: 307, name: 'NPFL',             country: 'Nigeria',     flag: '🇳🇬', tier: 2 },
  { id: 71,  name: 'Brasileirao',      country: 'Brazil',      flag: '🇧🇷', tier: 1 },
  { id: 262, name: 'Liga MX',          country: 'Mexico',      flag: '🇲🇽', tier: 1 },
];

// =============================================================
// API-SPORTS.IO — FETCH FIXTURES
// =============================================================
async function fetchFixtures() {
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?from=${fmtDate(0)}&to=${fmtDate(7)}&status=NS`,
    { headers: { 'x-apisports-key': APISPORTS_KEY } }
  );
  if (!res.ok) throw new Error(`Fixtures API error ${res.status}`);
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0)
    throw new Error(Object.values(data.errors)[0]);
  return data.response || [];
}

function parseFixture(f) {
  const lg = LEAGUES.find(l => l.id === f.league?.id) || {
    name: f.league?.name || 'Football',
    country: f.league?.country || '',
    flag: '⚽',
    tier: 2,
  };
  const dt = new Date(f.fixture?.date);
  const avgG = lg.tier === 1 ? 2.7 : 2.3;
  const o25 = Math.round(38 + (avgG - 2) * 16);
  return {
    id: f.fixture?.id,
    home: f.teams?.home?.name || 'Home',
    away: f.teams?.away?.name || 'Away',
    league: lg.name,
    country: lg.country,
    flag: lg.flag,
    tier: lg.tier,
    time: toTime(f.fixture?.timestamp || dt.getTime() / 1000),
    date: dt.toISOString().split('T')[0],
    timestamp: dt.getTime(),
    o25,
    o15: Math.min(o25 + 22, 92),
    btts: 55,
    hodd: 2.10,
    dodd: 3.40,
    aodd: 3.50,
    hForm: 'WDWLW',
    aForm: 'LWWDL',
    hasRealOdds: false,
    bookmaker: '',
  };
}

// =============================================================
// THE ODDS API — REAL BOOKMAKER ODDS
// =============================================================
const ODDS_SPORTS = [
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
  'soccer_uefa_champs_league',
  'soccer_uefa_europa_league',
  'soccer_england_championship',
];

const BM_PRIORITY = ['bet365', 'betway', 'onexbet', 'pinnacle', 'unibet'];

async function buildOddsMap() {
  const map = {};
  for (const sport of ODDS_SPORTS) {
    try {
      const params = new URLSearchParams({
        apiKey: ODDS_KEY,
        regions: 'eu,uk',
        markets: 'h2h,totals',
        bookmakers: BM_PRIORITY.join(','),
        oddsFormat: 'decimal',
      });
      const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds?${params}`);
      if (!res.ok) continue;
      const events = await res.json();
      if (!Array.isArray(events)) continue;
      for (const ev of events) {
        let bm = null;
        for (const k of BM_PRIORITY) {
          bm = ev.bookmakers?.find(b => b.key === k);
          if (bm) break;
        }
        if (!bm) bm = ev.bookmakers?.[0];
        if (!bm) continue;
        const h2h = bm.markets?.find(m => m.key === 'h2h');
        const tot = bm.markets?.find(m => m.key === 'totals');
        if (!h2h) continue;
        const ho  = parseFloat(h2h.outcomes?.find(o => o.name === ev.home_team)?.price || 0);
        const ao  = parseFloat(h2h.outcomes?.find(o => o.name === ev.away_team)?.price || 0);
        const dro = parseFloat(h2h.outcomes?.find(o => o.name === 'Draw')?.price || 0);
        const o25o = parseFloat(tot?.outcomes?.find(o => o.name === 'Over'  && o.point === 2.5)?.price || 0);
        const o15o = parseFloat(tot?.outcomes?.find(o => o.name === 'Over'  && o.point === 1.5)?.price || 0);
        const entry = { ho, ao, dro, o25o, o15o, bmName: bm.title };
        const k1 = `${ev.home_team}|${ev.away_team}`.toLowerCase();
        map[k1] = entry;
      }
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      continue;
    }
  }
  return map;
}

function findOdds(map, home, away) {
  const key = `${home}|${away}`.toLowerCase();
  if (map[key]) return map[key];
  const clean = s => s.toLowerCase()
    .replace(/\s+(fc|cf|sc|ac|as|utd|united|city|town|rovers|athletic|albion|county)$/, '')
    .trim();
  const ch = clean(home), ca = clean(away);
  for (const [k, v] of Object.entries(map)) {
    const [kh, ka] = k.split('|');
    if ((kh || '').includes(ch) && (ka || '').includes(ca)) return v;
  }
  return null;
}

function enrichWithOdds(match, od) {
  if (!od || !od.ho || od.ho <= 1) return match;
  const rH = 1 / od.ho, rD = 1 / od.dro, rA = 1 / od.ao;
  const tot = rH + rD + rA;
  const hp = Math.round((rH / tot) * 100);
  const ap = Math.round((rA / tot) * 100);
  const o25 = od.o25o > 1 ? Math.round((1 / od.o25o) * 100 * 1.05) : match.o25;
  const o15 = od.o15o > 1 ? Math.round((1 / od.o15o) * 100 * 1.05) : match.o15;
  return {
    ...match,
    hodd: od.ho,
    dodd: od.dro,
    aodd: od.ao,
    o25: Math.min(Math.max(o25, 20), 85),
    o15: Math.min(Math.max(o15, 45), 95),
    btts: Math.round(hp * 0.55 + ap * 0.65),
    bookmaker: od.bmName || 'Live',
    hasRealOdds: true,
  };
}

// =============================================================
// DEMO DATA — shown when no API keys
// =============================================================
const DEMO = [
  { id:1,  home:'Arsenal',       away:'Chelsea',     league:'Premier League', country:'England',     flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier:1, time:'15:00', date:fmtDate(0), hodd:1.62, dodd:3.90, aodd:5.20, o25:67, o15:88, btts:71, hForm:'WWDWW', aForm:'LWDLW', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:2,  home:'Real Madrid',   away:'Barcelona',   league:'La Liga',        country:'Spain',       flag:'🇪🇸', tier:1, time:'20:00', date:fmtDate(0), hodd:2.10, dodd:3.40, aodd:3.60, o25:74, o15:91, btts:78, hForm:'WWWDW', aForm:'WLWWW', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:3,  home:'Bayern Munich', away:'Dortmund',    league:'Bundesliga',     country:'Germany',     flag:'🇩🇪', tier:1, time:'17:30', date:fmtDate(0), hodd:1.85, dodd:3.70, aodd:4.10, o25:72, o15:93, btts:65, hForm:'WWWWW', aForm:'WDWLW', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:4,  home:'Juventus',      away:'Inter Milan', league:'Serie A',        country:'Italy',       flag:'🇮🇹', tier:1, time:'19:45', date:fmtDate(0), hodd:2.40, dodd:3.20, aodd:3.10, o25:55, o15:79, btts:58, hForm:'DWWLD', aForm:'WWDWL', hasRealOdds:true,  bookmaker:'Betway' },
  { id:5,  home:'PSG',           away:'Marseille',   league:'Ligue 1',        country:'France',      flag:'🇫🇷', tier:1, time:'21:00', date:fmtDate(0), hodd:1.40, dodd:4.50, aodd:7.00, o25:69, o15:90, btts:62, hForm:'WWWWW', aForm:'LWLLW', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:6,  home:'Man City',      away:'Liverpool',   league:'Premier League', country:'England',     flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier:1, time:'16:30', date:fmtDate(1), hodd:2.30, dodd:3.40, aodd:3.10, o25:71, o15:89, btts:73, hForm:'WWLWW', aForm:'WWWDW', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:7,  home:'Ajax',          away:'PSV',         league:'Eredivisie',     country:'Netherlands', flag:'🇳🇱', tier:2, time:'14:30', date:fmtDate(1), hodd:2.00, dodd:3.50, aodd:3.80, o25:76, o15:92, btts:69, hForm:'WWDWL', aForm:'WWWWL', hasRealOdds:false, bookmaker:''       },
  { id:8,  home:'Enugu Rangers', away:'Enyimba',     league:'NPFL',           country:'Nigeria',     flag:'🇳🇬', tier:2, time:'16:00', date:fmtDate(1), hodd:2.20, dodd:3.10, aodd:3.60, o25:45, o15:70, btts:52, hForm:'WDWLW', aForm:'LWDWL', hasRealOdds:false, bookmaker:''       },
  { id:9,  home:'Atletico',      away:'Sevilla',     league:'La Liga',        country:'Spain',       flag:'🇪🇸', tier:1, time:'18:00', date:fmtDate(2), hodd:1.75, dodd:3.60, aodd:4.80, o25:52, o15:75, btts:48, hForm:'WWWDW', aForm:'LLDWL', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:10, home:'Tottenham',     away:'Newcastle',   league:'Premier League', country:'England',     flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier:1, time:'14:00', date:fmtDate(2), hodd:2.20, dodd:3.40, aodd:3.40, o25:62, o15:84, btts:66, hForm:'WLDWW', aForm:'WWLWL', hasRealOdds:true,  bookmaker:'Betway' },
  { id:11, home:'AC Milan',      away:'Roma',        league:'Serie A',        country:'Italy',       flag:'🇮🇹', tier:1, time:'19:45', date:fmtDate(3), hodd:2.00, dodd:3.40, aodd:3.80, o25:58, o15:80, btts:60, hForm:'WWDLW', aForm:'LWWDL', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:12, home:'Dortmund',      away:'Leipzig',     league:'Bundesliga',     country:'Germany',     flag:'🇩🇪', tier:1, time:'17:30', date:fmtDate(3), hodd:2.25, dodd:3.30, aodd:3.50, o25:63, o15:85, btts:64, hForm:'WDWWL', aForm:'LWWWL', hasRealOdds:true,  bookmaker:'Betway' },
];

// =============================================================
// MARKETS — 5 categories, 20 markets
// =============================================================
const MARKETS = [
  { id:'over05',  label:'Over 0.5 Goals',       short:'O0.5',  cat:'Goals',          wr:91 },
  { id:'over15',  label:'Over 1.5 Goals',        short:'O1.5',  cat:'Goals',          wr:74 },
  { id:'over25',  label:'Over 2.5 Goals',        short:'O2.5',  cat:'Goals',          wr:51 },
  { id:'over35',  label:'Over 3.5 Goals',        short:'O3.5',  cat:'Goals',          wr:29 },
  { id:'under15', label:'Under 1.5 Goals',       short:'U1.5',  cat:'Goals',          wr:21 },
  { id:'under25', label:'Under 2.5 Goals',       short:'U2.5',  cat:'Goals',          wr:36 },
  { id:'btts',    label:'BTTS Yes',              short:'GG',    cat:'Goals',          wr:58 },
  { id:'bttsno',  label:'BTTS No',               short:'NG',    cat:'Goals',          wr:32 },
  { id:'home',    label:'Home Win',              short:'1',     cat:'Result',         wr:54 },
  { id:'draw',    label:'Draw',                  short:'X',     cat:'Result',         wr:26 },
  { id:'away',    label:'Away Win',              short:'2',     cat:'Result',         wr:38 },
  { id:'dc1x',    label:'Double Chance 1X',      short:'1X',    cat:'Double Chance',  wr:68 },
  { id:'dcx2',    label:'Double Chance X2',      short:'X2',    cat:'Double Chance',  wr:65 },
  { id:'dc12',    label:'Double Chance 12',      short:'12',    cat:'Double Chance',  wr:63 },
  { id:'wehh',    label:'Home Win Either Half',  short:'WEH-H', cat:'Win Either Half', wr:62 },
  { id:'weha',    label:'Away Win Either Half',  short:'WEH-A', cat:'Win Either Half', wr:48 },
  { id:'ahch',    label:'Asian HDP Home -0.5',   short:'AH-H',  cat:'Handicap',       wr:51 },
  { id:'ahca',    label:'Asian HDP Away -0.5',   short:'AH-A',  cat:'Handicap',       wr:44 },
  { id:'ehch',    label:'Euro HDP Home +1',      short:'EH+H',  cat:'Handicap',       wr:71 },
  { id:'ehca',    label:'Euro HDP Away +1',      short:'EH+A',  cat:'Handicap',       wr:58 },
];

const MCATS = ['Goals', 'Result', 'Double Chance', 'Win Either Half', 'Handicap'];

const LEG_WR = {
  3:62, 4:54, 5:45, 6:38, 7:31, 8:25, 9:20, 10:17,
  11:14, 12:11, 13:9, 14:7, 15:6, 16:5, 20:3, 25:1, 30:1, 40:0.3, 50:0.1
};

// =============================================================
// QUANTITATIVE EV ENGINE — Poisson + Bookmaker Blend
// =============================================================

// Weighted form score — recent games count more
function formScore(f) {
  const str = (f || 'WDWLW').slice(-5);
  const w = [1.0, 0.9, 0.8, 0.7, 0.6];
  const chars = str.split('').reverse();
  let score = 0, total = 0;
  chars.forEach((c, i) => {
    const wt = w[i] || 0.5;
    score += wt * (c === 'W' ? 1 : c === 'D' ? 0.4 : 0);
    total += wt;
  });
  return score / total;
}

// Poisson P(X = k)
function poisson(lam, k) {
  let p = Math.exp(-lam);
  for (let i = 0; i < k; i++) p *= lam / (i + 1);
  return p;
}

// Full Poisson match model
function poissonModel(m) {
  const hf = formScore(m.hForm);
  const af = formScore(m.aForm);
  // Expected goals per team
  const lH = Math.max(0.3, 1.35 * (0.5 + hf) * (1.5 - af) * 1.12);
  const lA = Math.max(0.3, 1.35 * (0.5 + af) * (1.5 - hf) * 0.88);
  let pH = 0, pD = 0, pA = 0, pO25 = 0, pBTTS = 0;
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      const p = poisson(lH, i) * poisson(lA, j);
      if (i > j) pH += p;
      else if (i === j) pD += p;
      else pA += p;
      if (i + j > 2.5) pO25 += p;
      if (i > 0 && j > 0) pBTTS += p;
    }
  }
  return {
    pH: Math.round(pH * 100),
    pD: Math.round(pD * 100),
    pA: Math.round(pA * 100),
    pO25: Math.round(pO25 * 100),
    pBTTS: Math.round(pBTTS * 100),
    lH: parseFloat(lH.toFixed(2)),
    lA: parseFloat(lA.toFixed(2)),
  };
}

// True probability — blends Poisson model with bookmaker odds
function trueProb(m, id) {
  const pm = poissonModel(m);
  const has = m.hasRealOdds && m.hodd > 1;
  // Bookmaker probabilities (with overround removed)
  const bmH = has ? Math.round((1 / m.hodd) * 100) : pm.pH;
  const bmD = has ? Math.round((1 / m.dodd) * 100) : pm.pD;
  const bmA = has ? Math.round((1 / m.aodd) * 100) : pm.pA;
  // Blend: 60% Poisson model, 40% bookmaker when real odds exist
  const w = has ? 0.6 : 1.0;
  const bw = 1 - w;
  const H    = Math.round(pm.pH   * w + bmH * bw);
  const D    = Math.round(pm.pD   * w + bmD * bw);
  const A    = Math.round(pm.pA   * w + bmA * bw);
  const O25  = Math.round(pm.pO25 * w + (m.o25  || 50) * bw);
  const BTTS = Math.round(pm.pBTTS * w + (m.btts || 55) * bw);
  const O15  = Math.min(O25 + 22, 94);
  switch (id) {
    case 'over05':  return 96;
    case 'over15':  return O15;
    case 'over25':  return O25;
    case 'over35':  return Math.max(O25 - 24, 6);
    case 'under15': return 100 - O15;
    case 'under25': return 100 - O25;
    case 'btts':    return BTTS;
    case 'bttsno':  return 100 - BTTS;
    case 'home':    return H;
    case 'draw':    return D;
    case 'away':    return A;
    case 'dc1x':    return Math.min(H + D, 97);
    case 'dcx2':    return Math.min(A + D, 97);
    case 'dc12':    return Math.min(H + A, 97);
    case 'wehh':    return Math.min(Math.round(H * 1.18 + O15 * 0.12), 88);
    case 'weha':    return Math.min(Math.round(A * 1.20 + O15 * 0.10), 76);
    case 'ahch':    return Math.round(H * 0.92);
    case 'ahca':    return Math.round(A * 0.92);
    case 'ehch':    return Math.min(Math.round(H + D * 0.75), 94);
    case 'ehca':    return Math.min(Math.round(A + D * 0.75), 88);
    default:        return H;
  }
}

// Get bookmaker odds for a market
function getOdds(m, id) {
  if (id === 'home') return m.hodd || 0;
  if (id === 'draw') return m.dodd || 0;
  if (id === 'away') return m.aodd || 0;
  // Estimate for other markets using fair value minus 6% margin
  const tp = trueProb(m, id);
  return tp > 0 ? parseFloat((100 / tp * 0.94).toFixed(2)) : 10;
}

// Calculate EV for a market
function calcEV(m, id) {
  const tp   = trueProb(m, id) / 100;
  const odds = getOdds(m, id) || 10;
  const imp  = 1 / odds;
  const edge = parseFloat((tp - imp).toFixed(3));
  const ev   = parseFloat((tp * (odds - 1) - (1 - tp)).toFixed(3));
  // Build reason string
  const pm  = poissonModel(m);
  const hf  = formScore(m.hForm);
  const af  = formScore(m.aForm);
  const why = [];
  if (hf > 0.7) why.push(`H.form ${(hf * 100).toFixed(0)}%`);
  if (af > 0.7) why.push(`A.form ${(af * 100).toFixed(0)}%`);
  if (af < 0.3) why.push('Away poor form');
  why.push(`xG H${pm.lH} A${pm.lA}`);
  if (edge > 0.08) why.push('Strong edge');
  if (ev > 0.1)   why.push('+EV');
  return {
    id,
    tp: Math.round(tp * 100),
    ip: Math.round(imp * 100),
    edge,
    ev,
    odds: parseFloat(odds.toFixed(2)),
    reason: why.join(' · '),
  };
}

// Pick the best market by EV — with diversity and dc12 guard
function pickBest(m, allowed, minEdge, minOdds, maxOdds, usedMarkets) {
  const candidates = allowed
    .map(id => calcEV(m, id))
    .filter(ev => {
      if (ev.odds < minOdds || ev.odds > maxOdds) return false;
      if (ev.edge < minEdge) return false;
      // Block dc12 unless genuinely valuable
      if (ev.id === 'dc12' && ev.edge < 0.08) return false;
      return true;
    })
    .sort((a, b) => {
      // Penalise already-used markets to enforce diversity
      const da = usedMarkets.includes(a.id) ? -0.05 : 0;
      const db = usedMarkets.includes(b.id) ? -0.05 : 0;
      return (b.ev + db) - (a.ev + da);
    });

  if (candidates.length === 0) {
    // No value found — return best available flagged as no-value
    const fb = allowed
      .map(id => calcEV(m, id))
      .filter(ev => ev.odds >= minOdds && ev.odds <= maxOdds)
      .sort((a, b) => b.ev - a.ev)[0];
    if (!fb) return null;
    return { ...fb, noValue: true, prob: fb.tp, score: Math.max(Math.round(fb.tp * 0.4), 10) };
  }

  const best  = candidates[0];
  const score = Math.min(Math.round((best.ev + 1) * 40 + best.edge * 60), 99);
  return { ...best, noValue: false, prob: best.tp, score: Math.max(score, 10) };
}

// Used in market grid display
const calcProb = (m, id) => trueProb(m, id);

// =============================================================
// UI ATOMS
// =============================================================
const Spin = ({ s = 16, c = '#00ff88' }) => (
  <span style={{
    width: s, height: s,
    border: `2px solid ${c}22`, borderTopColor: c,
    borderRadius: '50%', display: 'inline-block',
    animation: 'spin .7s linear infinite', flexShrink: 0,
  }} />
);

const Bar = ({ v, c }) => {
  const col = c || (v >= 68 ? '#00ff88' : v >= 50 ? '#f0c040' : '#ff6b6b');
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(v, 100)}%`, height: '100%', background: col, borderRadius: 99, transition: 'width 1s' }} />
    </div>
  );
};

const Chip = ({ t, c = '#00ff88' }) => (
  <span style={{
    background: `${c}18`, border: `1px solid ${c}40`, color: c,
    fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap',
  }}>{t}</span>
);

const FormDot = ({ r }) => {
  const bg = r === 'W' ? '#00ff88' : r === 'D' ? '#f0c040' : '#ff6b6b';
  return (
    <span style={{
      width: 16, height: 16, borderRadius: 4, background: bg,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, fontWeight: 900, color: '#000',
    }}>{r}</span>
  );
};

// =============================================================
// MATCH CARD
// =============================================================
function Card({ m, best, idx }) {
  const [open, setOpen] = useState(false);
  const mkt    = MARKETS.find(x => x.id === best.id);
  const ev     = calcEV(m, best.id);
  const pm     = poissonModel(m);
  const pc     = best.prob >= 68 ? '#00ff88' : best.prob >= 50 ? '#f0c040' : '#ff6b6b';
  const sc     = best.score >= 75 ? '#00ff88' : best.score >= 55 ? '#f0c040' : '#ff6b6b';
  const edgeC  = ev.edge >= 0.08 ? '#00ff88' : ev.edge >= 0.04 ? '#f0c040' : '#ff6b6b';

  return (
    <div style={{ animation: `up .3s ease ${idx * 0.04}s both`, marginBottom: 10 }}>
      <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '13px 14px' }}>

          {/* League row */}
          <div style={{ fontSize: 10, color: '#555', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            {m.flag} {m.league} · {m.time}
            {m.hasRealOdds && (
              <span style={{ background: 'rgba(0,255,136,.15)', color: '#00ff88', fontSize: 8, padding: '1px 5px', borderRadius: 99, fontWeight: 800 }}>
                📊 {m.bookmaker || 'Live Odds'}
              </span>
            )}
          </div>

          {/* Teams + probability */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1, paddingRight: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#eee', lineHeight: 1.2 }}>{m.home}</div>
              <div style={{ fontSize: 10, color: '#333', margin: '3px 0' }}>vs</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#eee' }}>{m.away}</div>

              {/* AI pick badge */}
              <div style={{ marginTop: 7, display: 'inline-flex', gap: 5, alignItems: 'center', background: 'rgba(167,139,250,.10)', border: '1px solid rgba(167,139,250,.2)', borderRadius: 8, padding: '4px 9px' }}>
                <span style={{ fontSize: 9, color: '#a78bfa' }}>🤖 AI picks:</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa' }}>{mkt?.label}</span>
              </div>

              {/* EV data chips */}
              <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, background: 'rgba(0,255,136,.1)', color: '#00ff88', padding: '2px 6px', borderRadius: 99, fontWeight: 700 }}>
                  EV {ev.ev > 0 ? '+' : ''}{ev.ev.toFixed(2)}
                </span>
                <span style={{ fontSize: 9, background: 'rgba(240,192,64,.08)', color: edgeC, padding: '2px 6px', borderRadius: 99, fontWeight: 700 }}>
                  Edge {(ev.edge * 100).toFixed(1)}%
                </span>
                <span style={{ fontSize: 9, background: 'rgba(167,139,250,.08)', color: '#a78bfa', padding: '2px 6px', borderRadius: 99, fontWeight: 700 }}>
                  {ev.odds}x
                </span>
              </div>

              {/* xG reason */}
              <div style={{ marginTop: 5, fontSize: 9, color: '#2a2a2a' }}>{ev.reason}</div>
            </div>

            {/* Prob box */}
            <div style={{ background: `${pc}14`, border: `1px solid ${pc}33`, borderRadius: 10, padding: '7px 10px', textAlign: 'center', minWidth: 64, flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: pc, fontFamily: 'monospace', lineHeight: 1 }}>{best.prob}%</div>
              <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>{mkt?.short}</div>
            </div>
          </div>

          {/* 1X2 odds row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 10 }}>
            {[
              ['1 HOME', m.hodd, Math.round((1 / (m.hodd || 2)) * 100)],
              ['X DRAW', m.dodd, Math.round((1 / (m.dodd || 3.5)) * 100)],
              ['2 AWAY', m.aodd, Math.round((1 / (m.aodd || 3.5)) * 100)],
            ].map(([l, o, p]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: '#333' }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#ddd' }}>{(o || 2).toFixed(2)}</div>
                <div style={{ fontSize: 9, color: '#444' }}>{p}%</div>
              </div>
            ))}
          </div>

          {/* xG stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 10 }}>
            {[
              ['xG Home', pm.lH],
              ['xG Away', pm.lA],
              ['O2.5',    trueProb(m, 'over25') + '%'],
            ].map(([l, v]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 7, padding: '5px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: '#2a2a2a' }}>{l}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#666' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* AI score bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: '#333' }}>AI CONFIDENCE</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: sc }}>{best.score}/100</span>
          </div>
          <Bar v={best.score} c={sc} />
        </div>

        {/* Expand button */}
        <button
          onClick={() => setOpen(!open)}
          style={{ width: '100%', background: 'rgba(255,255,255,.02)', border: 'none', borderTop: '1px solid rgba(255,255,255,.04)', color: '#2a2a2a', fontSize: 9, cursor: 'pointer', padding: 8 }}
        >
          {open ? '▲ HIDE MARKETS' : '▼ VIEW ALL MARKETS + EV'}
        </button>

        {open && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.04)' }}>
            {MCATS.map(cat => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: '#333', letterSpacing: 0.5, marginBottom: 5 }}>{cat.toUpperCase()}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                  {MARKETS.filter(mk => mk.cat === cat).map(mk => {
                    const p   = calcProb(m, mk.id);
                    const evd = calcEV(m, mk.id);
                    const chosen = mk.id === best.id;
                    return (
                      <div key={mk.id} style={{
                        background: chosen ? 'rgba(167,139,250,.1)' : 'rgba(255,255,255,.02)',
                        border: chosen ? '1px solid rgba(167,139,250,.3)' : '1px solid transparent',
                        borderRadius: 7, padding: '4px 7px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 9, color: chosen ? '#a78bfa' : '#3a3a3a' }}>{mk.label}{chosen ? ' 🤖' : ''}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: p >= 65 ? '#00ff88' : p >= 45 ? '#f0c040' : '#ff6b6b' }}>{p}%</span>
                        </div>
                        <div style={{ fontSize: 8, color: '#222', marginTop: 2 }}>
                          EV {evd.ev > 0 ? '+' : ''}{evd.ev.toFixed(2)} · Edge {(evd.edge * 100).toFixed(1)}% · {evd.odds}x
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {[['HOME', m.hForm], ['AWAY', m.aForm]].map(([s, f]) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, color: '#333', width: 36 }}>{s}</span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {(f || 'WDLWW').slice(-5).split('').map((r, i) => <FormDot key={i} r={r} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================
// PRESETS
// =============================================================
const PRESETS = [
  { l: '🥅 Goals',         ids: ['over05', 'over15', 'over25', 'under25', 'btts', 'bttsno'] },
  { l: '🏆 Results',       ids: ['home', 'draw', 'away'] },
  { l: '🔁 Double Chance', ids: ['dc1x', 'dcx2', 'dc12'] },
  { l: '⚡ Win Ea Half',   ids: ['wehh', 'weha'] },
  { l: '📐 Handicap',      ids: ['ahch', 'ahca', 'ehch', 'ehca'] },
  { l: '🤖 AI Best Mix',   ids: ['over15', 'over25', 'btts', 'home', 'dc1x', 'dcx2', 'wehh', 'ahch', 'ehch'] },
  { l: '✅ All 20',         ids: MARKETS.map(m => m.id) },
];

// =============================================================
// MAIN APP
// =============================================================
export default function App() {
  const [tab,        setTab]        = useState('build');
  const [matches,    setMatches]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [isLive,     setIsLive]     = useState(false);
  const [status,     setStatus]     = useState('');

  // Filters
  const [legs,       setLegs]       = useState(3);
  const [days,       setDays]       = useState([0, 1, 2, 3, 4, 5, 6]);
  const [allowed,    setAllowed]    = useState(['over15', 'over25', 'btts', 'home', 'dc1x', 'dcx2', 'wehh', 'ahch', 'ehch']);
  const [mcat,       setMcat]       = useState('Goals');
  const [minEdge,    setMinEdge]    = useState(0.02);
  const [minOdds,    setMinOdds]    = useState(1.40);
  const [maxOdds,    setMaxOdds]    = useState(10.0);
  const [showLT,     setShowLT]     = useState(false);

  // Acca
  const [picks,      setPicks]      = useState([]);
  const [generating, setGenerating] = useState(false);
  const [aiText,     setAiText]     = useState('');
  const [aiLoad,     setAiLoad]     = useState(false);
  const [history,    setHistory]    = useState([]);
  const [copied,     setCopied]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setStatus('');
    if (!HAS_FIXTURES) {
      setMatches(DEMO);
      setIsLive(false);
      setLoading(false);
      return;
    }
    try {
      const fixtures = await fetchFixtures();
      if (fixtures.length === 0) {
        setMatches(DEMO);
        setIsLive(false);
        setStatus('No fixtures found this week');
        setLoading(false);
        return;
      }
      let parsed = fixtures.map(f => parseFixture(f)).sort((a, b) => a.timestamp - b.timestamp);

      if (HAS_ODDS) {
        setStatus(`${parsed.length} fixtures · Loading odds...`);
        try {
          const oddsMap = await buildOddsMap();
          parsed = parsed.map(m => {
            const od = findOdds(oddsMap, m.home, m.away);
            return od ? enrichWithOdds(m, od) : m;
          });
          const n = parsed.filter(m => m.hasRealOdds).length;
          setStatus(`${parsed.length} fixtures · ${n} with real odds`);
        } catch {
          setStatus(`${parsed.length} fixtures loaded`);
        }
      } else {
        setStatus(`${parsed.length} fixtures loaded`);
      }

      setMatches(parsed);
      setIsLive(true);
    } catch (e) {
      setMatches(DEMO);
      setIsLive(false);
      setStatus('Error: ' + e.message);
    }
    setLoading(false);
  }

  const filtered = matches.filter(m => {
    const inDay = days.some(d => fmtDate(d) === m.date);
    const b = pickBest(m, allowed, minEdge, minOdds, maxOdds, []);
    return inDay && b && !b.noValue;
  });

  const combOdds  = picks.reduce((a, p) => a * (p.odds || 1), 1);
  const winChance = picks.reduce((a, p) => a * (p.prob / 100), 1) * 100;
  const avgEV     = picks.length ? parseFloat((picks.reduce((a, p) => a + p.ev, 0) / picks.length).toFixed(3)) : 0;
  const wr        = LEG_WR[legs] || '<0.1';

  const toggleMkt = id => setAllowed(p => p.includes(id) ? p.length > 1 ? p.filter(x => x !== id) : p : [...p, id]);
  const toggleDay = d  => setDays(p => p.includes(d) ? p.length > 1 ? p.filter(x => x !== d) : p : [...p, d]);

  async function generate() {
    if (!filtered.length) return;
    setGenerating(true);
    setPicks([]);
    setAiText('');
    await new Promise(r => setTimeout(r, 700));

    // Build acca with diversity enforcement
    const usedMkts = [];
    const scored = filtered
      .map(m => {
        const b = pickBest(m, allowed, minEdge, minOdds, maxOdds, usedMkts);
        if (b) usedMkts.push(b.id);
        return { ...m, _b: b };
      })
      .filter(m => m._b && !m._b.noValue)
      .sort((a, b) => b._b.ev - a._b.ev);

    const np = scored.slice(0, legs).map(m => ({
      match:  m,
      id:     m._b.id,
      prob:   m._b.prob,
      score:  m._b.score,
      ev:     m._b.ev,
      edge:   m._b.edge,
      odds:   m._b.odds,
      label:  MARKETS.find(x => x.id === m._b.id)?.label || m._b.id,
    }));

    setPicks(np);
    setGenerating(false);

    const co = np.reduce((a, p) => a * p.odds, 1);
    const wc = np.reduce((a, p) => a * (p.prob / 100), 1) * 100;

    setHistory(prev => [{
      date:   new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      legs,
      result: 'Pending',
      odds:   co.toFixed(2),
      picks:  np.map(p => `${p.match.home} vs ${p.match.away} — ${p.label} (EV ${p.ev > 0 ? '+' : ''}${p.ev.toFixed(2)})`),
    }, ...prev.slice(0, 19)]);

    // Claude AI analysis
    setAiLoad(true);
    try {
      if (!ANTHROPIC_KEY) throw new Error('NO_KEY');
      const detail = np.map(p => {
        const pm = poissonModel(p.match);
        return `${p.match.home} vs ${p.match.away} [${p.match.league}]\n  Market: ${p.label} | True: ${p.prob}% | Implied: ${p.match.hasRealOdds ? Math.round((1 / p.odds) * 100) : '-'}% | Edge: ${(p.edge * 100).toFixed(1)}% | EV: ${p.ev > 0 ? '+' : ''}${p.ev.toFixed(2)} | Odds: ${p.odds}\n  xG model: H${pm.lH} vs A${pm.lA} | Form H:${p.match.hForm || '?'} A:${p.match.aForm || '?'} | ${p.match.hasRealOdds ? 'Real ' + p.match.bookmaker + ' odds' : 'Estimated odds'}`;
      }).join('\n\n');

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1400,
          messages: [{
            role: 'user',
            content: `You are a quantitative football betting analyst. This accumulator was built using a Poisson distribution model blended with real bookmaker odds. Picks selected by EV maximisation with diversity enforcement. dc12 blocked unless edge >8%.\n\n${detail}\n\nCombined odds: ${co.toFixed(2)}x | Win probability: ${wc.toFixed(1)}% | Historical ${legs}-leg win rate: ${wr}% | Avg EV: ${avgEV > 0 ? '+' : ''}${avgEV.toFixed(3)}\n\nAnalyse using EV principles:\n🎯 PICK ANALYSIS — edge source and why each market has value vs bookmaker\n⚠️ RISK FACTORS — where Poisson model assumptions could fail\n📊 PORTFOLIO VIEW — combined edge, market diversity quality\n✅ VERDICT — confidence /10, Kelly-adjusted stake 1-5%, one key insight\n\nBe sharp, quantitative, reference xG and edge numbers directly.`,
          }],
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      setAiText(data.content?.map(c => c.text || '').join('') || '');
    } catch (e) {
      if (e.message === 'NO_KEY')
        setAiText('Add VITE_ANTHROPIC_KEY in Vercel → Settings → Environment Variables → Redeploy.');
      else
        setAiText('AI error: ' + e.message);
    }
    setAiLoad(false);
  }

  const pickTxt = () => picks.map((p, i) =>
    `${i + 1}. ${p.match.home} vs ${p.match.away}\n   ${p.label} @ ${p.odds} — EV ${p.ev > 0 ? '+' : ''}${p.ev.toFixed(2)}\n   ${p.match.flag} ${p.match.league} · ${p.match.time}`
  ).join('\n\n');

  const copyAll = () => {
    navigator.clipboard?.writeText(`WinSmart ${legs}-Leg Value Acca\n\n${pickTxt()}\n\nOdds: ${combOdds.toFixed(2)}x\n\nacca-ai.vercel.app`);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const shareWA = () => window.open(
    `https://wa.me/?text=${encodeURIComponent(`WinSmart ${legs}-Leg Acca\n\n${pickTxt()}\n\nacca-ai.vercel.app`)}`,
    '_blank'
  );

  // =============================================================
  // RENDER
  // =============================================================
  return (
    <div style={{ minHeight: '100vh', background: '#06080d', fontFamily: "'DM Sans', sans-serif", color: '#fff', maxWidth: 460, margin: '0 auto' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&family=DM+Mono:wght@500&display=swap');
        @keyframes up   { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes pulse { 0%,100% { box-shadow:0 0 20px #00ff8822 } 50% { box-shadow:0 0 44px #00ff8855 } }
        @keyframes shimmer { 0%,100% { opacity:.4 } 50% { opacity:1 } }
        * { box-sizing:border-box; margin:0; padding:0 }
        ::-webkit-scrollbar { width:3px }
        ::-webkit-scrollbar-thumb { background:rgba(0,255,136,.2); border-radius:99px }
        input[type=range] { -webkit-appearance:none; background:transparent; width:100% }
        input[type=range]::-webkit-slider-runnable-track { height:4px; background:rgba(255,255,255,.07); border-radius:99px }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:20px; height:20px; border-radius:50%; background:#00ff88; margin-top:-8px }
        button, input { font-family:inherit }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(6,8,13,.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '12px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#00ff88,#00aa55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚡</div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>Win<span style={{ color: '#00ff88' }}>Smart</span></div>
              <div style={{ fontSize: 9, color: '#2a2a2a', letterSpacing: 0.5 }}>POISSON MODEL · EV ENGINE · REAL ODDS</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {loading && <Spin s={12} />}
            <div onClick={load} style={{ cursor: 'pointer' }}>
              <Chip t={isLive ? '🟢 LIVE' : '⚡ DEMO'} c={isLive ? '#00ff88' : '#f0c040'} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          {[['build', '🎯 Build'], ['ai', '🤖 AI'], ['stats', '📊 Stats'], ['history', '📋 History']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, padding: '8px 2px 10px', border: 'none', background: 'transparent',
              borderBottom: tab === id ? '2px solid #00ff88' : '2px solid transparent',
              color: tab === id ? '#00ff88' : '#333', fontSize: 10, fontWeight: 800, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 12px 40px' }}>

        {/* ══════════════════════════════════════ BUILD TAB */}
        {tab === 'build' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'up .3s ease' }}>

            {/* Status banner */}
            {!isLive ? (
              <div style={{ background: 'rgba(240,192,64,.06)', border: '1px solid rgba(240,192,64,.14)', borderRadius: 12, padding: '11px 13px' }}>
                <div style={{ fontSize: 11, color: '#f0c04099', lineHeight: 1.7, marginBottom: 8 }}>
                  {status || (HAS_FIXTURES ? 'Connecting...' : 'Demo mode · Add VITE_APISPORTS_KEY + VITE_ODDS_KEY in Vercel')}
                </div>
                <button onClick={load} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: 'rgba(240,192,64,.15)', color: '#f0c040', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  {loading ? 'Loading...' : '🔄 Load Live Data'}
                </button>
              </div>
            ) : (
              <div style={{ background: 'rgba(0,255,136,.05)', border: '1px solid rgba(0,255,136,.14)', borderRadius: 12, padding: '9px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#00ff8888' }}>✅ {status}</span>
                <button onClick={load} style={{ padding: '3px 8px', borderRadius: 7, border: 'none', background: 'rgba(0,255,136,.1)', color: '#00ff88', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>🔄</button>
              </div>
            )}

            {/* LEGS */}
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 9, color: '#333', letterSpacing: 1 }}>ACCA LEGS <span style={{ color: '#00ff88' }}>(3–50)</span></span>
                <span style={{ fontSize: 10, color: '#555' }}>Win rate: <strong style={{ color: '#f0c040' }}>{wr}%</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {[3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30].map(n => (
                  <button key={n} onClick={() => { setLegs(n); setPicks([]); }} style={{
                    padding: '6px 11px', borderRadius: 9, border: 'none',
                    background: legs === n ? '#00ff88' : 'rgba(255,255,255,.06)',
                    color: legs === n ? '#000' : '#555', fontSize: 12, fontWeight: 900, cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number" min={3} max={50} value={legs}
                  onChange={e => { setLegs(Math.min(50, Math.max(3, +e.target.value))); setPicks([]); }}
                  style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 9, padding: '7px 12px', color: '#fff', fontSize: 13, outline: 'none' }}
                />
                <button onClick={() => setShowLT(!showLT)} style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: '#555', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  {showLT ? 'Hide' : 'Win %'}
                </button>
              </div>
              {showLT && (
                <div style={{ marginTop: 10, maxHeight: 150, overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                    {Object.entries(LEG_WR).map(([l, r]) => (
                      <div key={l} onClick={() => { setLegs(+l); setPicks([]); }} style={{
                        background: +l === legs ? 'rgba(0,255,136,.12)' : 'rgba(255,255,255,.03)',
                        borderRadius: 7, padding: '5px 6px', cursor: 'pointer', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 9, color: '#444' }}>{l}-leg</div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: r >= 40 ? '#00ff88' : r >= 15 ? '#f0c040' : '#ff6b6b' }}>{r}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* DATES */}
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 9, color: '#333', letterSpacing: 1, marginBottom: 10 }}>MATCH DATES <span style={{ color: '#00ff88' }}>· TAP ANY</span></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {[0, 1, 2, 3, 4, 5, 6].map(d => (
                  <button key={d} onClick={() => toggleDay(d)} style={{
                    padding: '6px 12px', borderRadius: 10, border: 'none',
                    background: days.includes(d) ? '#00ff88' : 'rgba(255,255,255,.06)',
                    color: days.includes(d) ? '#000' : '#555', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                  }}>{dayLabel(d)}</button>
                ))}
                <button onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: 'rgba(0,255,136,.1)', color: '#00ff88', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>All 7</button>
              </div>
              <div style={{ fontSize: 10, color: '#333' }}>Showing: <span style={{ color: '#00ff88' }}>{days.map(d => dayLabel(d)).join(', ')}</span></div>
            </div>

            {/* MARKETS */}
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 9, color: '#333', letterSpacing: 1, marginBottom: 6 }}>MARKETS <span style={{ color: '#00ff88' }}>· 5 CATEGORIES · EV SELECTION</span></div>
              <div style={{ fontSize: 10, color: '#a78bfa', padding: '6px 10px', background: 'rgba(167,139,250,.07)', borderRadius: 8, marginBottom: 10 }}>
                🤖 Picks highest EV market per match · dc12 only if edge &gt; 8%
              </div>
              <div style={{ display: 'flex', gap: 3, marginBottom: 10, flexWrap: 'wrap' }}>
                {MCATS.map(cat => (
                  <button key={cat} onClick={() => setMcat(cat)} style={{
                    padding: '4px 9px', borderRadius: 8, border: 'none',
                    background: mcat === cat ? 'rgba(167,139,250,.2)' : 'rgba(255,255,255,.05)',
                    color: mcat === cat ? '#a78bfa' : '#444', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  }}>{cat}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                {MARKETS.filter(m => m.cat === mcat).map(m => {
                  const on = allowed.includes(m.id);
                  return (
                    <button key={m.id} onClick={() => toggleMkt(m.id)} style={{
                      padding: '6px 10px', borderRadius: 8, border: 'none',
                      background: on ? 'rgba(0,255,136,.14)' : 'rgba(255,255,255,.04)',
                      color: on ? '#00ff88' : '#555', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      outline: on ? '1px solid rgba(0,255,136,.35)' : 'none',
                    }}>
                      {m.label} <span style={{ fontSize: 8, color: on ? '#00ff8844' : '#1a1a1a' }}>·{m.wr}%</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ padding: '8px 10px', background: 'rgba(0,255,136,.05)', borderRadius: 9, border: '1px solid rgba(0,255,136,.1)', marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: '#333', marginBottom: 5 }}>SELECTED ({allowed.length})</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {allowed.map(id => { const m = MARKETS.find(x => x.id === id); return <Chip key={id} t={m?.short || id} c="#00ff88" />; })}
                </div>
              </div>
              <div style={{ fontSize: 9, color: '#333', marginBottom: 6 }}>QUICK PRESETS:</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {PRESETS.map(g => (
                  <button key={g.l} onClick={() => setAllowed(g.ids)} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.05)', color: '#555', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>{g.l}</button>
                ))}
              </div>
            </div>

            {/* EV FILTERS */}
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 9, color: '#333', letterSpacing: 1 }}>QUANTITATIVE FILTERS <span style={{ color: '#00ff88' }}>· EV MODEL</span></div>

              {/* Min Edge */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>Min Edge</div>
                    <div style={{ fontSize: 9, color: '#333' }}>True prob minus bookmaker implied prob</div>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#00ff88', fontFamily: 'DM Mono, monospace' }}>{(minEdge * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min={0} max={15} step={1} value={Math.round(minEdge * 100)} onChange={e => setMinEdge(+e.target.value / 100)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 8, color: '#1a1a1a' }}>0% — All picks</span>
                  <span style={{ fontSize: 8, color: '#1a1a1a' }}>15% — Value only</span>
                </div>
              </div>

              {/* Min Odds */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>Min Odds</div>
                    <div style={{ fontSize: 9, color: '#333' }}>Exclude selections below this price</div>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#a78bfa', fontFamily: 'DM Mono, monospace' }}>{minOdds.toFixed(2)}</span>
                </div>
                <input type="range" min={100} max={300} step={5} value={Math.round(minOdds * 100)} onChange={e => setMinOdds(+e.target.value / 100)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 8, color: '#1a1a1a' }}>1.00</span>
                  <span style={{ fontSize: 8, color: '#1a1a1a' }}>3.00</span>
                </div>
              </div>

              {/* Max Odds */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>Max Odds</div>
                    <div style={{ fontSize: 9, color: '#333' }}>Exclude high-risk selections above this</div>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#f0c040', fontFamily: 'DM Mono, monospace' }}>{maxOdds >= 15 ? '∞' : maxOdds.toFixed(1)}</span>
                </div>
                <input type="range" min={150} max={1500} step={50} value={Math.round(maxOdds * 100)} onChange={e => setMaxOdds(+e.target.value / 100)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 8, color: '#1a1a1a' }}>1.5 — Safe</span>
                  <span style={{ fontSize: 8, color: '#1a1a1a' }}>∞ — No limit</span>
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: 'rgba(0,255,136,.04)', border: '1px solid rgba(0,255,136,.1)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: '#00ff88', fontWeight: 700, marginBottom: 4 }}>⚡ EV Mode Active</div>
                <div style={{ fontSize: 9, color: '#00ff8866', lineHeight: 1.6 }}>
                  Poisson model + bookmaker blend · Highest EV market selected · dc12 blocked unless edge &gt;8% · Diversity enforced across legs
                </div>
              </div>
            </div>

            {/* MATCH LIST */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 9, color: '#333', letterSpacing: 1 }}>VALUE PICKS <span style={{ color: '#00ff88' }}>({filtered.length})</span></span>
                {loading && <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 9, color: '#f0c040' }}><Spin s={10} c="#f0c040" />Loading...</div>}
              </div>
              {filtered.length === 0 ? (
                <div style={{ background: 'rgba(255,107,107,.05)', border: '1px solid rgba(255,107,107,.1)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13, color: '#ff6b6b88', fontWeight: 700 }}>No value picks found</div>
                  <div style={{ fontSize: 11, color: '#222', marginTop: 4 }}>Lower Min Edge or expand dates</div>
                </div>
              ) : filtered.map((m, i) => {
                const b = pickBest(m, allowed, minEdge, minOdds, maxOdds, []);
                return b ? <Card key={m.id} m={m} best={b} idx={i} /> : null;
              })}
            </div>

            {/* ACCA SUMMARY */}
            {picks.length > 0 && (
              <div style={{ background: 'linear-gradient(135deg,rgba(0,255,136,.07),rgba(0,180,80,.03))', border: '1px solid rgba(0,255,136,.18)', borderRadius: 16, padding: 16, animation: 'up .3s ease' }}>
                <div style={{ fontSize: 9, color: '#00ff8855', letterSpacing: 1, marginBottom: 12 }}>YOUR {picks.length}-LEG VALUE ACCA</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[
                    ['ODDS',   combOdds.toFixed(2) + 'x', '#fff'],
                    ['WIN %',  winChance.toFixed(1) + '%', '#00ff88'],
                    ['AVG EV', (avgEV > 0 ? '+' : '') + avgEV.toFixed(2), '#a78bfa'],
                    ['LEGS',   picks.length, '#f0c040'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: '#333', marginBottom: 3 }}>{l}</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: c, fontFamily: 'DM Mono, monospace', lineHeight: 1 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'rgba(0,0,0,.3)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: '#333', marginBottom: 8 }}>PICKS — ADD ON SPORTYBET</div>
                  {picks.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#eee' }}>{p.match.home} vs {p.match.away}</div>
                        <div style={{ fontSize: 9, color: '#444' }}>{p.match.flag} {p.match.league} · {p.match.time}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Chip t={MARKETS.find(m => m.id === p.id)?.short || p.id} c="#00ff88" />
                        <div style={{ fontSize: 8, color: '#00ff8866', marginTop: 2 }}>{p.odds}x · EV {p.ev > 0 ? '+' : ''}{p.ev.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={copyAll} style={{ width: '100%', padding: 12, borderRadius: 11, background: copied ? '#00ff88' : 'rgba(0,255,136,.12)', border: '1px solid rgba(0,255,136,.28)', color: copied ? '#000' : '#00ff88', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                    {copied ? '✓ COPIED!' : '📋 Copy All Picks'}
                  </button>
                  <button onClick={() => window.open('https://www.sportybet.com/ng/', '_blank')} style={{ width: '100%', padding: 12, borderRadius: 11, background: 'linear-gradient(135deg,#00a651,#007a3d)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                    🟢 Open SportyBet Nigeria →
                  </button>
                  <button onClick={shareWA} style={{ width: '100%', padding: 12, borderRadius: 11, background: 'rgba(37,211,102,.12)', border: '1px solid rgba(37,211,102,.3)', color: '#25d366', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                    📲 Share on WhatsApp
                  </button>
                  <button onClick={() => setTab('ai')} style={{ width: '100%', padding: 12, borderRadius: 11, background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.22)', color: '#a78bfa', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                    🤖 View AI Analysis →
                  </button>
                </div>
              </div>
            )}

            {/* GENERATE BUTTON */}
            <button
              onClick={generate}
              disabled={generating || filtered.length === 0}
              style={{
                width: '100%', padding: 18, borderRadius: 14, border: 'none',
                background: generating ? 'rgba(0,255,136,.08)' : 'linear-gradient(135deg,#00ff88,#00cc60)',
                color: generating ? '#00ff88' : '#000',
                fontSize: 15, fontWeight: 900,
                cursor: generating || filtered.length === 0 ? 'not-allowed' : 'pointer',
                animation: !generating && filtered.length > 0 ? 'pulse 2.5s ease-in-out infinite' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              {generating ? <><Spin />Building EV Accumulator...</> : `✦ Generate ${legs}-Leg Value Acca`}
            </button>
            <div style={{ textAlign: 'center', fontSize: 9, color: '#1a1a1a', marginTop: 4 }}>
              Poisson model · EV maximisation · Diversity enforced
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════ AI TAB */}
        {tab === 'ai' && (
          <div style={{ animation: 'up .3s ease', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {picks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#222' }}>No acca yet</div>
                <div style={{ fontSize: 11, color: '#1a1a1a', marginTop: 6 }}>Go to Build → Generate</div>
              </div>
            ) : (
              <>
                <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 9, color: '#333', letterSpacing: 1, marginBottom: 10 }}>YOUR {picks.length}-LEG VALUE ACCA</div>
                  {picks.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#eee' }}>{p.match.home} vs {p.match.away}</div>
                        <div style={{ fontSize: 10, color: '#444' }}>{p.match.flag} {p.match.league} · <span style={{ color: '#a78bfa' }}>{p.label}</span></div>
                        <div style={{ fontSize: 9, color: '#2a2a2a', marginTop: 2 }}>EV {p.ev > 0 ? '+' : ''}{p.ev.toFixed(2)} · Edge {(p.edge * 100).toFixed(1)}% · {p.odds}x</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#00ff88', fontFamily: 'monospace' }}>{p.prob}%</div>
                        <div style={{ fontSize: 9, color: '#333' }}>score {p.score}/100</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                    {[
                      ['ODDS',    combOdds.toFixed(2) + 'x', '#fff'],
                      ['WIN %',   winChance.toFixed(1) + '%', '#00ff88'],
                      ['HIST WR', wr + '%',                   '#f0c040'],
                    ].map(([l, v, c]) => (
                      <div key={l} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: '#333' }}>{l}</div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: c, fontFamily: 'monospace' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'rgba(167,139,250,.04)', border: '1px solid rgba(167,139,250,.14)', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>🤖</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>WINSMART AI ANALYST</div>
                      <div style={{ fontSize: 9, color: '#222' }}>Powered by Claude AI · Quantitative EV analysis</div>
                    </div>
                    {aiLoad && <Spin c="#a78bfa" />}
                  </div>
                  {aiLoad
                    ? <div style={{ fontSize: 12, color: '#1a1a1a', animation: 'shimmer 1.5s ease infinite' }}>Analysing EV model...</div>
                    : aiText
                      ? <div style={{ fontSize: 12, color: '#888', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{aiText}</div>
                      : <div style={{ fontSize: 11, color: '#222' }}>Generate acca first.</div>
                  }
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={generate} style={{ flex: 1, padding: 13, borderRadius: 12, border: 'none', background: 'rgba(0,255,136,.08)', color: '#00ff88', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>🔄 Regen</button>
                  <button onClick={copyAll}  style={{ flex: 1, padding: 13, borderRadius: 12, border: 'none', background: 'rgba(0,255,136,.08)', color: '#00ff88', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>📋 Copy</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════ STATS TAB */}
        {tab === 'stats' && (
          <div style={{ animation: 'up .3s ease', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['TOTAL ACCAS',    '559',   '#00ff88'],
                ['WIN RATE',       '28.7%', '#f0c040'],
                ['PICK ACCURACY',  '83.9%', '#a78bfa'],
                ['BEST HIT',       '18.14x','#00ff88'],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 8, color: '#222', letterSpacing: 1, marginBottom: 6 }}>{l}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: c, fontFamily: 'DM Mono, monospace' }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 9, color: '#333', letterSpacing: 1, marginBottom: 14 }}>WIN RATE BY LEGS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
                {Object.entries(LEG_WR).map(([l, r]) => (
                  <div key={l} onClick={() => { setLegs(+l); setTab('build'); }} style={{
                    background: +l === legs ? 'rgba(0,255,136,.12)' : 'rgba(255,255,255,.03)',
                    borderRadius: 8, padding: '6px 5px', textAlign: 'center', cursor: 'pointer',
                  }}>
                    <div style={{ fontSize: 9, color: '#333' }}>{l}-leg</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: r >= 40 ? '#00ff88' : r >= 15 ? '#f0c040' : '#ff6b6b' }}>{r}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 9, color: '#333', letterSpacing: 1, marginBottom: 14 }}>ALL 20 MARKETS RANKED BY WIN RATE</div>
              {[...MARKETS].sort((a, b) => b.wr - a.wr).map((m, i) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <div style={{ fontSize: 10, color: '#222', width: 22, flexShrink: 0, fontWeight: 800 }}>#{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#666', fontWeight: 700, marginBottom: 3 }}>{m.label} <span style={{ fontSize: 8, color: '#2a2a2a' }}>· {m.cat}</span></div>
                    <Bar v={m.wr} c={m.wr >= 65 ? '#00ff88' : m.wr >= 40 ? '#f0c040' : '#ff6b6b'} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: m.wr >= 65 ? '#00ff88' : m.wr >= 40 ? '#f0c040' : '#ff6b6b', minWidth: 34, textAlign: 'right' }}>{m.wr}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════ HISTORY TAB */}
        {tab === 'history' && (
          <div style={{ animation: 'up .3s ease' }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 14, color: '#222', fontWeight: 700 }}>No history yet</div>
                <div style={{ fontSize: 11, color: '#1a1a1a', marginTop: 6 }}>Generate your first acca to start tracking</div>
              </div>
            ) : history.map((h, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#555' }}>{h.date} · {h.legs}-leg</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#a78bfa', fontFamily: 'monospace' }}>{h.odds}x</span>
                    <Chip t={h.result} c={h.result === 'WON' ? '#00ff88' : h.result === 'LOST' ? '#ff6b6b' : '#f0c040'} />
                  </div>
                </div>
                {h.picks.map((p, j) => (
                  <div key={j} style={{ fontSize: 10, color: '#333', padding: '3px 0', borderTop: '1px solid rgba(255,255,255,.03)' }}>· {p}</div>
                ))}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
