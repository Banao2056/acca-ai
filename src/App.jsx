import { useState, useEffect } from 'react';

// ─── KEYS — must match Vercel Environment Variables exactly ───
const FOOTBALL_KEY  = import.meta.env.VITE_APIFOOTBALL_KEY || '';
const ODDS_KEY      = import.meta.env.VITE_ODDS_KEY        || '';
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY   || '';
const HAS_FIXTURES  = FOOTBALL_KEY.length > 5;
const HAS_ODDS      = ODDS_KEY.length > 5;

// ─── DATE HELPERS ─────────────────────────────────────────────
const fmtDate = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + (offset || 0));
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

// ─── LEAGUES ──────────────────────────────────────────────────
const LEAGUES = [
  { id: 39,  name: 'Premier League',   flag: 'gb-eng', tier: 1 },
  { id: 140, name: 'La Liga',          flag: 'es',     tier: 1 },
  { id: 78,  name: 'Bundesliga',       flag: 'de',     tier: 1 },
  { id: 135, name: 'Serie A',          flag: 'it',     tier: 1 },
  { id: 61,  name: 'Ligue 1',          flag: 'fr',     tier: 1 },
  { id: 2,   name: 'Champions League', flag: 'eu',     tier: 1 },
  { id: 3,   name: 'Europa League',    flag: 'eu',     tier: 1 },
  { id: 40,  name: 'Championship',     flag: 'gb-eng', tier: 2 },
  { id: 88,  name: 'Eredivisie',       flag: 'nl',     tier: 2 },
  { id: 94,  name: 'Primeira Liga',    flag: 'pt',     tier: 2 },
  { id: 307, name: 'NPFL',             flag: 'ng',     tier: 2 },
  { id: 71,  name: 'Brasileirao',      flag: 'br',     tier: 1 },
  { id: 262, name: 'Liga MX',          flag: 'mx',     tier: 1 },
];

const flagEmoji = (code) => {
  const map = {
    'gb-eng': '\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F',
    es: '\uD83C\uDDEA\uD83C\uDDF8', de: '\uD83C\uDDE9\uD83C\uDDEA',
    it: '\uD83C\uDDEE\uD83C\uDDF9', fr: '\uD83C\uDDEB\uD83C\uDDF7',
    eu: '\uD83C\uDFC6', nl: '\uD83C\uDDF3\uD83C\uDDF1',
    pt: '\uD83C\uDDF5\uD83C\uDDF9', ng: '\uD83C\uDDF3\uD83C\uDDEC',
    br: '\uD83C\uDDE7\uD83C\uDDF7', mx: '\uD83C\uDDF2\uD83C\uDDFD',
  };
  return map[code] || '\u26BD';
};

// ─── FETCH FIXTURES ───────────────────────────────────────────
async function fetchFixtures() {
  const url = 'https://v3.football.api-sports.io/fixtures'
    + '?from=' + fmtDate(0)
    + '&to='   + fmtDate(7)
    + '&status=NS';
  const res = await fetch(url, { headers: { 'x-apisports-key': FOOTBALL_KEY } });
  if (!res.ok) throw new Error('API error ' + res.status);
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0)
    throw new Error(String(Object.values(data.errors)[0]));
  return data.response || [];
}

function parseFixture(f) {
  const lg = LEAGUES.find(function(l) { return l.id === f.league.id; }) || {
    name: f.league.name || 'Football', flag: 'eu', tier: 2,
  };
  const dt  = new Date(f.fixture.date);
  const o25 = lg.tier === 1 ? 52 : 42;
  return {
    id:          f.fixture.id,
    home:        f.teams.home.name,
    away:        f.teams.away.name,
    league:      lg.name,
    flag:        flagEmoji(lg.flag),
    tier:        lg.tier,
    time:        toTime(f.fixture.timestamp),
    date:        dt.toISOString().split('T')[0],
    timestamp:   dt.getTime(),
    o25:         o25,
    o15:         Math.min(o25 + 22, 92),
    btts:        55,
    hodd:        2.10,
    dodd:        3.40,
    aodd:        3.50,
    hForm:       'WDWLW',
    aForm:       'LWWDL',
    hasRealOdds: false,
    bookmaker:   '',
  };
}

// ─── ODDS API ─────────────────────────────────────────────────
const ODDS_SPORTS = [
  'soccer_epl', 'soccer_spain_la_liga', 'soccer_germany_bundesliga',
  'soccer_italy_serie_a', 'soccer_france_ligue_one',
  'soccer_uefa_champs_league', 'soccer_england_championship',
];
const BM_ORDER = ['bet365', 'betway', 'onexbet', 'pinnacle', 'unibet'];

async function buildOddsMap() {
  const map = {};
  for (let si = 0; si < ODDS_SPORTS.length; si++) {
    const sport = ODDS_SPORTS[si];
    try {
      const params = 'apiKey=' + ODDS_KEY
        + '&regions=eu,uk&markets=h2h,totals'
        + '&bookmakers=' + BM_ORDER.join(',')
        + '&oddsFormat=decimal';
      const res = await fetch('https://api.the-odds-api.com/v4/sports/' + sport + '/odds?' + params);
      if (!res.ok) continue;
      const events = await res.json();
      if (!Array.isArray(events)) continue;
      for (let ei = 0; ei < events.length; ei++) {
        const ev = events[ei];
        let bm = null;
        for (let bi = 0; bi < BM_ORDER.length; bi++) {
          bm = (ev.bookmakers || []).find(function(b) { return b.key === BM_ORDER[bi]; });
          if (bm) break;
        }
        if (!bm) bm = (ev.bookmakers || [])[0];
        if (!bm) continue;
        const h2h = (bm.markets || []).find(function(m) { return m.key === 'h2h'; });
        const tot = (bm.markets || []).find(function(m) { return m.key === 'totals'; });
        if (!h2h) continue;
        const ho  = parseFloat(((h2h.outcomes || []).find(function(o) { return o.name === ev.home_team; }) || {}).price || 0);
        const ao  = parseFloat(((h2h.outcomes || []).find(function(o) { return o.name === ev.away_team; }) || {}).price || 0);
        const dro = parseFloat(((h2h.outcomes || []).find(function(o) { return o.name === 'Draw'; }) || {}).price || 0);
        const o25o = parseFloat(((tot ? tot.outcomes || [] : []).find(function(o) { return o.name === 'Over' && o.point === 2.5; }) || {}).price || 0);
        const o15o = parseFloat(((tot ? tot.outcomes || [] : []).find(function(o) { return o.name === 'Over' && o.point === 1.5; }) || {}).price || 0);
        const entry = { ho: ho, ao: ao, dro: dro, o25o: o25o, o15o: o15o, bmName: bm.title };
        const key = (ev.home_team + '|' + ev.away_team).toLowerCase();
        map[key] = entry;
      }
      await new Promise(function(r) { setTimeout(r, 150); });
    } catch (e) { continue; }
  }
  return map;
}

function findOdds(map, home, away) {
  const key = (home + '|' + away).toLowerCase();
  if (map[key]) return map[key];
  const clean = function(s) {
    return s.toLowerCase()
      .replace(/\s+(fc|cf|sc|ac|as|utd|united|city|town|rovers|athletic|albion|county)$/, '')
      .trim();
  };
  const ch = clean(home), ca = clean(away);
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i++) {
    const parts = keys[i].split('|');
    const kh = parts[0] || '', ka = parts[1] || '';
    if (kh.includes(ch) && ka.includes(ca)) return map[keys[i]];
    if (ch.includes(kh) && ca.includes(ka)) return map[keys[i]];
  }
  return null;
}

function enrichWithOdds(match, od) {
  if (!od || !od.ho || od.ho <= 1) return match;
  const rH = 1 / od.ho, rD = 1 / od.dro, rA = 1 / od.ao;
  const tot = rH + rD + rA;
  const hp  = Math.round((rH / tot) * 100);
  const ap  = Math.round((rA / tot) * 100);
  const o25 = od.o25o > 1 ? Math.min(Math.max(Math.round((1 / od.o25o) * 100 * 1.05), 20), 85) : match.o25;
  const o15 = od.o15o > 1 ? Math.min(Math.max(Math.round((1 / od.o15o) * 100 * 1.05), 45), 95) : match.o15;
  return Object.assign({}, match, {
    hodd: od.ho, dodd: od.dro, aodd: od.ao,
    o25: o25, o15: o15,
    btts: Math.round(hp * 0.55 + ap * 0.65),
    bookmaker: od.bmName || 'Live',
    hasRealOdds: true,
  });
}

// ─── DEMO DATA ────────────────────────────────────────────────
const DEMO = [
  { id:1,  home:'Arsenal',       away:'Chelsea',     league:'Premier League', flag:'\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F', tier:1, time:'15:00', date:fmtDate(0), hodd:1.62, dodd:3.90, aodd:5.20, o25:67, o15:88, btts:71, hForm:'WWDWW', aForm:'LWDLW', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:2,  home:'Real Madrid',   away:'Barcelona',   league:'La Liga',        flag:'\uD83C\uDDEA\uD83C\uDDF8', tier:1, time:'20:00', date:fmtDate(0), hodd:2.10, dodd:3.40, aodd:3.60, o25:74, o15:91, btts:78, hForm:'WWWDW', aForm:'WLWWW', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:3,  home:'Bayern Munich', away:'Dortmund',    league:'Bundesliga',     flag:'\uD83C\uDDE9\uD83C\uDDEA', tier:1, time:'17:30', date:fmtDate(0), hodd:1.85, dodd:3.70, aodd:4.10, o25:72, o15:93, btts:65, hForm:'WWWWW', aForm:'WDWLW', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:4,  home:'Juventus',      away:'Inter Milan', league:'Serie A',        flag:'\uD83C\uDDEE\uD83C\uDDF9', tier:1, time:'19:45', date:fmtDate(0), hodd:2.40, dodd:3.20, aodd:3.10, o25:55, o15:79, btts:58, hForm:'DWWLD', aForm:'WWDWL', hasRealOdds:true,  bookmaker:'Betway' },
  { id:5,  home:'PSG',           away:'Marseille',   league:'Ligue 1',        flag:'\uD83C\uDDEB\uD83C\uDDF7', tier:1, time:'21:00', date:fmtDate(0), hodd:1.40, dodd:4.50, aodd:7.00, o25:69, o15:90, btts:62, hForm:'WWWWW', aForm:'LWLLW', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:6,  home:'Man City',      away:'Liverpool',   league:'Premier League', flag:'\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F', tier:1, time:'16:30', date:fmtDate(1), hodd:2.30, dodd:3.40, aodd:3.10, o25:71, o15:89, btts:73, hForm:'WWLWW', aForm:'WWWDW', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:7,  home:'Ajax',          away:'PSV',         league:'Eredivisie',     flag:'\uD83C\uDDF3\uD83C\uDDF1', tier:2, time:'14:30', date:fmtDate(1), hodd:2.00, dodd:3.50, aodd:3.80, o25:76, o15:92, btts:69, hForm:'WWDWL', aForm:'WWWWL', hasRealOdds:false, bookmaker:'' },
  { id:8,  home:'Enugu Rangers', away:'Enyimba',     league:'NPFL',           flag:'\uD83C\uDDF3\uD83C\uDDEC', tier:2, time:'16:00', date:fmtDate(1), hodd:2.20, dodd:3.10, aodd:3.60, o25:45, o15:70, btts:52, hForm:'WDWLW', aForm:'LWDWL', hasRealOdds:false, bookmaker:'' },
  { id:9,  home:'Atletico',      away:'Sevilla',     league:'La Liga',        flag:'\uD83C\uDDEA\uD83C\uDDF8', tier:1, time:'18:00', date:fmtDate(2), hodd:1.75, dodd:3.60, aodd:4.80, o25:52, o15:75, btts:48, hForm:'WWWDW', aForm:'LLDWL', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:10, home:'Tottenham',     away:'Newcastle',   league:'Premier League', flag:'\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F', tier:1, time:'14:00', date:fmtDate(2), hodd:2.20, dodd:3.40, aodd:3.40, o25:62, o15:84, btts:66, hForm:'WLDWW', aForm:'WWLWL', hasRealOdds:true,  bookmaker:'Betway' },
  { id:11, home:'AC Milan',      away:'Roma',        league:'Serie A',        flag:'\uD83C\uDDEE\uD83C\uDDF9', tier:1, time:'19:45', date:fmtDate(3), hodd:2.00, dodd:3.40, aodd:3.80, o25:58, o15:80, btts:60, hForm:'WWDLW', aForm:'LWWDL', hasRealOdds:true,  bookmaker:'Bet365' },
  { id:12, home:'Dortmund',      away:'Leipzig',     league:'Bundesliga',     flag:'\uD83C\uDDE9\uD83C\uDDEA', tier:1, time:'17:30', date:fmtDate(3), hodd:2.25, dodd:3.30, aodd:3.50, o25:63, o15:85, btts:64, hForm:'WDWWL', aForm:'LWWWL', hasRealOdds:true,  bookmaker:'Betway' },
];

// ─── MARKETS ──────────────────────────────────────────────────
const MARKETS = [
  { id:'over05',  label:'Over 0.5 Goals',      short:'O0.5',  cat:'Goals',           wr:91 },
  { id:'over15',  label:'Over 1.5 Goals',       short:'O1.5',  cat:'Goals',           wr:74 },
  { id:'over25',  label:'Over 2.5 Goals',       short:'O2.5',  cat:'Goals',           wr:51 },
  { id:'over35',  label:'Over 3.5 Goals',       short:'O3.5',  cat:'Goals',           wr:29 },
  { id:'under15', label:'Under 1.5 Goals',      short:'U1.5',  cat:'Goals',           wr:21 },
  { id:'under25', label:'Under 2.5 Goals',      short:'U2.5',  cat:'Goals',           wr:36 },
  { id:'btts',    label:'BTTS Yes',             short:'GG',    cat:'Goals',           wr:58 },
  { id:'bttsno',  label:'BTTS No',              short:'NG',    cat:'Goals',           wr:32 },
  { id:'home',    label:'Home Win',             short:'1',     cat:'Result',          wr:54 },
  { id:'draw',    label:'Draw',                 short:'X',     cat:'Result',          wr:26 },
  { id:'away',    label:'Away Win',             short:'2',     cat:'Result',          wr:38 },
  { id:'dc1x',    label:'Double Chance 1X',     short:'1X',    cat:'Double Chance',   wr:68 },
  { id:'dcx2',    label:'Double Chance X2',     short:'X2',    cat:'Double Chance',   wr:65 },
  { id:'dc12',    label:'Double Chance 12',     short:'12',    cat:'Double Chance',   wr:63 },
  { id:'wehh',    label:'Home Win Either Half', short:'WEH-H', cat:'Win Either Half', wr:62 },
  { id:'weha',    label:'Away Win Either Half', short:'WEH-A', cat:'Win Either Half', wr:48 },
  { id:'ahch',    label:'Asian HDP Home -0.5',  short:'AH-H',  cat:'Handicap',        wr:51 },
  { id:'ahca',    label:'Asian HDP Away -0.5',  short:'AH-A',  cat:'Handicap',        wr:44 },
  { id:'ehch',    label:'Euro HDP Home +1',     short:'EH+H',  cat:'Handicap',        wr:71 },
  { id:'ehca',    label:'Euro HDP Away +1',     short:'EH+A',  cat:'Handicap',        wr:58 },
];
const MCATS = ['Goals', 'Result', 'Double Chance', 'Win Either Half', 'Handicap'];
const LEG_WR = { 3:62, 4:54, 5:45, 6:38, 7:31, 8:25, 9:20, 10:17, 11:14, 12:11, 15:6, 20:3, 25:1, 30:1 };

// ─── POISSON EV ENGINE ────────────────────────────────────────
function formScore(f) {
  const str = (f || 'WDWLW').slice(-5);
  const w = [1.0, 0.9, 0.8, 0.7, 0.6];
  const chars = str.split('').reverse();
  let score = 0, total = 0;
  chars.forEach(function(c, i) {
    const wt = w[i] || 0.5;
    score += wt * (c === 'W' ? 1 : c === 'D' ? 0.4 : 0);
    total += wt;
  });
  return total > 0 ? score / total : 0.5;
}

function poisson(lam, k) {
  let p = Math.exp(-lam);
  for (let i = 0; i < k; i++) p = p * lam / (i + 1);
  return p;
}

function poissonModel(m) {
  const hf = formScore(m.hForm);
  const af = formScore(m.aForm);
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
    pH: Math.round(pH * 100), pD: Math.round(pD * 100), pA: Math.round(pA * 100),
    pO25: Math.round(pO25 * 100), pBTTS: Math.round(pBTTS * 100),
    lH: parseFloat(lH.toFixed(2)), lA: parseFloat(lA.toFixed(2)),
  };
}

function trueProb(m, id) {
  const pm  = poissonModel(m);
  const has = m.hasRealOdds && m.hodd > 1;
  const bmH = has ? Math.round((1 / m.hodd) * 100) : pm.pH;
  const bmD = has ? Math.round((1 / m.dodd) * 100) : pm.pD;
  const bmA = has ? Math.round((1 / m.aodd) * 100) : pm.pA;
  const w   = has ? 0.6 : 1.0;
  const bw  = 1 - w;
  const H    = Math.round(pm.pH    * w + bmH * bw);
  const D    = Math.round(pm.pD    * w + bmD * bw);
  const A    = Math.round(pm.pA    * w + bmA * bw);
  const O25  = Math.round(pm.pO25  * w + (m.o25  || 50) * bw);
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

function getOdds(m, id) {
  if (id === 'home') return m.hodd || 2.10;
  if (id === 'draw') return m.dodd || 3.40;
  if (id === 'away') return m.aodd || 3.50;
  const tp = trueProb(m, id);
  return tp > 0 ? parseFloat((100 / tp * 0.94).toFixed(2)) : 10;
}

function calcEV(m, id) {
  const tp   = trueProb(m, id) / 100;
  const odds = getOdds(m, id);
  const imp  = 1 / odds;
  const edge = parseFloat((tp - imp).toFixed(3));
  const ev   = parseFloat((tp * (odds - 1) - (1 - tp)).toFixed(3));
  const pm   = poissonModel(m);
  const hf   = formScore(m.hForm);
  const af   = formScore(m.aForm);
  const why  = [];
  if (hf > 0.7) why.push('H.form ' + (hf * 100).toFixed(0) + '%');
  if (af > 0.7) why.push('A.form ' + (af * 100).toFixed(0) + '%');
  if (af < 0.3) why.push('Away poor form');
  why.push('xG H' + pm.lH + ' A' + pm.lA);
  if (edge > 0.08) why.push('Strong edge');
  if (ev > 0.1)   why.push('+EV');
  return { id:id, tp:Math.round(tp*100), ip:Math.round(imp*100), edge:edge, ev:ev, odds:parseFloat(odds.toFixed(2)), reason:why.join(' · ') };
}

function pickBest(m, allowed, minEdge, minOdds, maxOdds, usedMarkets) {
  const candidates = allowed
    .map(function(id) { return calcEV(m, id); })
    .filter(function(ev) {
      if (ev.odds < minOdds || ev.odds > maxOdds) return false;
      if (ev.edge < minEdge) return false;
      if (ev.id === 'dc12' && ev.edge < 0.08) return false;
      return true;
    })
    .sort(function(a, b) {
      const da = usedMarkets.indexOf(a.id) >= 0 ? -0.05 : 0;
      const db = usedMarkets.indexOf(b.id) >= 0 ? -0.05 : 0;
      return (b.ev + db) - (a.ev + da);
    });

  if (candidates.length === 0) {
    const fb = allowed
      .map(function(id) { return calcEV(m, id); })
      .filter(function(ev) { return ev.odds >= minOdds && ev.odds <= maxOdds; })
      .sort(function(a, b) { return b.ev - a.ev; })[0];
    if (!fb) return null;
    return Object.assign({}, fb, { noValue:true, prob:fb.tp, score:Math.max(Math.round(fb.tp*0.4),10) });
  }
  const best  = candidates[0];
  const score = Math.min(Math.round((best.ev + 1) * 40 + best.edge * 60), 99);
  return Object.assign({}, best, { noValue:false, prob:best.tp, score:Math.max(score,10) });
}

const calcProb = function(m, id) { return trueProb(m, id); };

// ─── UI ATOMS ─────────────────────────────────────────────────
function Spin(props) {
  const s = props.s || 16;
  const c = props.c || '#00ff88';
  return React.createElement('span', {
    style: { width:s, height:s, border:'2px solid '+c+'22', borderTopColor:c, borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite', flexShrink:0 }
  });
}

function Bar(props) {
  const v   = props.v;
  const col = props.c || (v >= 68 ? '#00ff88' : v >= 50 ? '#f0c040' : '#ff6b6b');
  return (
    <div style={{ height:4, background:'rgba(255,255,255,.06)', borderRadius:99, overflow:'hidden' }}>
      <div style={{ width:Math.min(v,100)+'%', height:'100%', background:col, borderRadius:99, transition:'width 1s' }} />
    </div>
  );
}

function Chip(props) {
  const c = props.c || '#00ff88';
  return (
    <span style={{ background:c+'18', border:'1px solid '+c+'40', color:c, fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:99, whiteSpace:'nowrap' }}>
      {props.t}
    </span>
  );
}

function FormDot(props) {
  const bg = props.r === 'W' ? '#00ff88' : props.r === 'D' ? '#f0c040' : '#ff6b6b';
  return (
    <span style={{ width:16, height:16, borderRadius:4, background:bg, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:900, color:'#000' }}>
      {props.r}
    </span>
  );
}

// ─── MATCH CARD ───────────────────────────────────────────────
function Card(props) {
  const m    = props.m;
  const best = props.best;
  const idx  = props.idx;
  const [open, setOpen] = useState(false);
  const mkt   = MARKETS.find(function(x) { return x.id === best.id; });
  const ev    = calcEV(m, best.id);
  const pm    = poissonModel(m);
  const pc    = best.prob >= 68 ? '#00ff88' : best.prob >= 50 ? '#f0c040' : '#ff6b6b';
  const sc    = best.score >= 75 ? '#00ff88' : best.score >= 55 ? '#f0c040' : '#ff6b6b';
  const edgeC = ev.edge >= 0.08 ? '#00ff88' : ev.edge >= 0.04 ? '#f0c040' : '#ff6b6b';

  return (
    <div style={{ animation:'up .3s ease '+(idx*0.04)+'s both', marginBottom:10 }}>
      <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.06)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ padding:'13px 14px' }}>

          <div style={{ fontSize:10, color:'#555', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
            {m.flag} {m.league} · {m.time}
            {m.hasRealOdds && (
              <span style={{ background:'rgba(0,255,136,.15)', color:'#00ff88', fontSize:8, padding:'1px 5px', borderRadius:99, fontWeight:800 }}>
                {m.bookmaker || 'Live Odds'}
              </span>
            )}
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
            <div style={{ flex:1, paddingRight:8 }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#eee', lineHeight:1.2 }}>{m.home}</div>
              <div style={{ fontSize:10, color:'#333', margin:'3px 0' }}>vs</div>
              <div style={{ fontSize:15, fontWeight:800, color:'#eee' }}>{m.away}</div>

              <div style={{ marginTop:7, display:'inline-flex', gap:5, alignItems:'center', background:'rgba(167,139,250,.10)', border:'1px solid rgba(167,139,250,.2)', borderRadius:8, padding:'4px 9px' }}>
                <span style={{ fontSize:9, color:'#a78bfa' }}>AI picks:</span>
                <span style={{ fontSize:10, fontWeight:800, color:'#a78bfa' }}>{mkt ? mkt.label : best.id}</span>
              </div>

              <div style={{ marginTop:6, display:'flex', gap:5, flexWrap:'wrap' }}>
                <span style={{ fontSize:9, background:'rgba(0,255,136,.1)', color:'#00ff88', padding:'2px 6px', borderRadius:99, fontWeight:700 }}>
                  EV {ev.ev > 0 ? '+' : ''}{ev.ev.toFixed(2)}
                </span>
                <span style={{ fontSize:9, background:'rgba(240,192,64,.08)', color:edgeC, padding:'2px 6px', borderRadius:99, fontWeight:700 }}>
                  Edge {(ev.edge * 100).toFixed(1)}%
                </span>
                <span style={{ fontSize:9, background:'rgba(167,139,250,.08)', color:'#a78bfa', padding:'2px 6px', borderRadius:99, fontWeight:700 }}>
                  {ev.odds}x
                </span>
              </div>
              <div style={{ marginTop:5, fontSize:9, color:'#2a2a2a' }}>{ev.reason}</div>
            </div>

            <div style={{ background:pc+'14', border:'1px solid '+pc+'33', borderRadius:10, padding:'7px 10px', textAlign:'center', minWidth:64, flexShrink:0 }}>
              <div style={{ fontSize:22, fontWeight:900, color:pc, fontFamily:'monospace', lineHeight:1 }}>{best.prob}%</div>
              <div style={{ fontSize:8, color:'#555', marginTop:2 }}>{mkt ? mkt.short : ''}</div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginBottom:10 }}>
            {[['1 HOME',m.hodd,Math.round((1/(m.hodd||2))*100)],['X DRAW',m.dodd,Math.round((1/(m.dodd||3.5))*100)],['2 AWAY',m.aodd,Math.round((1/(m.aodd||3.5))*100)]].map(function(item) {
              return (
                <div key={item[0]} style={{ background:'rgba(255,255,255,.04)', borderRadius:8, padding:'6px 4px', textAlign:'center' }}>
                  <div style={{ fontSize:8, color:'#333' }}>{item[0]}</div>
                  <div style={{ fontSize:13, fontWeight:900, color:'#ddd' }}>{(item[1]||2).toFixed(2)}</div>
                  <div style={{ fontSize:9, color:'#444' }}>{item[2]}%</div>
                </div>
              );
            })}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginBottom:10 }}>
            {[['xG Home',pm.lH],['xG Away',pm.lA],['O2.5',trueProb(m,'over25')+'%']].map(function(item) {
              return (
                <div key={item[0]} style={{ background:'rgba(255,255,255,.03)', borderRadius:7, padding:'5px 4px', textAlign:'center' }}>
                  <div style={{ fontSize:8, color:'#2a2a2a' }}>{item[0]}</div>
                  <div style={{ fontSize:11, fontWeight:800, color:'#666' }}>{item[1]}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:9, color:'#333' }}>AI CONFIDENCE</span>
            <span style={{ fontSize:9, fontWeight:800, color:sc }}>{best.score}/100</span>
          </div>
          <Bar v={best.score} c={sc} />
        </div>

        <button onClick={function() { setOpen(!open); }} style={{ width:'100%', background:'rgba(255,255,255,.02)', border:'none', borderTop:'1px solid rgba(255,255,255,.04)', color:'#2a2a2a', fontSize:9, cursor:'pointer', padding:8 }}>
          {open ? 'HIDE MARKETS' : 'VIEW ALL MARKETS + EV'}
        </button>

        {open && (
          <div style={{ padding:'12px 14px', borderTop:'1px solid rgba(255,255,255,.04)' }}>
            {MCATS.map(function(cat) {
              return (
                <div key={cat} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:9, color:'#333', letterSpacing:0.5, marginBottom:5 }}>{cat.toUpperCase()}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
                    {MARKETS.filter(function(mk) { return mk.cat === cat; }).map(function(mk) {
                      const p      = calcProb(m, mk.id);
                      const evd    = calcEV(m, mk.id);
                      const chosen = mk.id === best.id;
                      return (
                        <div key={mk.id} style={{ background:chosen?'rgba(167,139,250,.1)':'rgba(255,255,255,.02)', border:chosen?'1px solid rgba(167,139,250,.3)':'1px solid transparent', borderRadius:7, padding:'4px 7px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between' }}>
                            <span style={{ fontSize:9, color:chosen?'#a78bfa':'#3a3a3a' }}>{mk.label}{chosen?' AI':''}</span>
                            <span style={{ fontSize:10, fontWeight:800, color:p>=65?'#00ff88':p>=45?'#f0c040':'#ff6b6b' }}>{p}%</span>
                          </div>
                          <div style={{ fontSize:8, color:'#222', marginTop:2 }}>
                            EV {evd.ev>0?'+':''}{evd.ev.toFixed(2)} · Edge {(evd.edge*100).toFixed(1)}% · {evd.odds}x
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
              {[['HOME',m.hForm],['AWAY',m.aForm]].map(function(item) {
                return (
                  <div key={item[0]} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:9, color:'#333', width:36 }}>{item[0]}</span>
                    <div style={{ display:'flex', gap:3 }}>
                      {(item[1]||'WDLWW').slice(-5).split('').map(function(r, i) { return <FormDot key={i} r={r} />; })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PRESETS ──────────────────────────────────────────────────
const PRESETS = [
  { l:'Goals',        ids:['over05','over15','over25','under25','btts','bttsno'] },
  { l:'Results',      ids:['home','draw','away'] },
  { l:'Dbl Chance',   ids:['dc1x','dcx2','dc12'] },
  { l:'Win Ea Half',  ids:['wehh','weha'] },
  { l:'Handicap',     ids:['ahch','ahca','ehch','ehca'] },
  { l:'AI Best Mix',  ids:['over15','over25','btts','home','dc1x','dcx2','wehh','ahch','ehch'] },
  { l:'All 20',       ids:MARKETS.map(function(m) { return m.id; }) },
];

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [tab,        setTab]        = useState('build');
  const [matches,    setMatches]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [isLive,     setIsLive]     = useState(false);
  const [status,     setStatus]     = useState('');
  const [legs,       setLegs]       = useState(3);
  const [days,       setDays]       = useState([0,1,2,3,4,5,6]);
  const [allowed,    setAllowed]    = useState(['over15','over25','btts','home','dc1x','dcx2','wehh','ahch','ehch']);
  const [mcat,       setMcat]       = useState('Goals');
  const [minEdge,    setMinEdge]    = useState(0.02);
  const [minOdds,    setMinOdds]    = useState(1.40);
  const [maxOdds,    setMaxOdds]    = useState(10.0);
  const [showLT,     setShowLT]     = useState(false);
  const [picks,      setPicks]      = useState([]);
  const [generating, setGenerating] = useState(false);
  const [aiText,     setAiText]     = useState('');
  const [aiLoad,     setAiLoad]     = useState(false);
  const [history,    setHistory]    = useState([]);
  const [copied,     setCopied]     = useState(false);

  useEffect(function() { load(); }, []);

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
      let parsed = fixtures.map(function(f) { return parseFixture(f); });
      parsed.sort(function(a,b) { return a.timestamp - b.timestamp; });
      if (HAS_ODDS) {
        setStatus(parsed.length + ' fixtures · Loading odds...');
        try {
          const oddsMap = await buildOddsMap();
          parsed = parsed.map(function(m) {
            const od = findOdds(oddsMap, m.home, m.away);
            return od ? enrichWithOdds(m, od) : m;
          });
          const n = parsed.filter(function(m) { return m.hasRealOdds; }).length;
          setStatus(parsed.length + ' fixtures · ' + n + ' with real odds');
        } catch (e) {
          setStatus(parsed.length + ' fixtures loaded');
        }
      } else {
        setStatus(parsed.length + ' fixtures loaded');
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

  const filtered = matches.filter(function(m) {
    const inDay = days.some(function(d) { return fmtDate(d) === m.date; });
    const b = pickBest(m, allowed, minEdge, minOdds, maxOdds, []);
    return inDay && b && !b.noValue;
  });

  const combOdds  = picks.reduce(function(a,p) { return a * (p.odds||1); }, 1);
  const winChance = picks.reduce(function(a,p) { return a * (p.prob/100); }, 1) * 100;
  const avgEV     = picks.length ? parseFloat((picks.reduce(function(a,p) { return a+p.ev; },0)/picks.length).toFixed(3)) : 0;
  const wr        = LEG_WR[legs] || '<1';

  function toggleMkt(id) {
    setAllowed(function(p) { return p.includes(id) ? (p.length>1 ? p.filter(function(x){return x!==id;}) : p) : p.concat([id]); });
  }
  function toggleDay(d) {
    setDays(function(p) { return p.includes(d) ? (p.length>1 ? p.filter(function(x){return x!==d;}) : p) : p.concat([d]); });
  }

  async function generate() {
    if (!filtered.length) return;
    setGenerating(true);
    setPicks([]);
    setAiText('');
    await new Promise(function(r) { setTimeout(r, 700); });
    const usedMkts = [];
    const scored = filtered
      .map(function(m) {
        const b = pickBest(m, allowed, minEdge, minOdds, maxOdds, usedMkts);
        if (b) usedMkts.push(b.id);
        return Object.assign({}, m, { _b:b });
      })
      .filter(function(m) { return m._b && !m._b.noValue; })
      .sort(function(a,b) { return b._b.ev - a._b.ev; });

    const np = scored.slice(0, legs).map(function(m) {
      const mkt = MARKETS.find(function(x) { return x.id === m._b.id; });
      return { match:m, id:m._b.id, prob:m._b.prob, score:m._b.score, ev:m._b.ev, edge:m._b.edge, odds:m._b.odds, label:mkt?mkt.label:m._b.id };
    });

    setPicks(np);
    setGenerating(false);

    const co = np.reduce(function(a,p) { return a*p.odds; }, 1);
    const wc = np.reduce(function(a,p) { return a*(p.prob/100); }, 1) * 100;

    setHistory(function(prev) {
      return [{
        date:   new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short' }),
        legs:   legs,
        result: 'Pending',
        odds:   co.toFixed(2),
        picks:  np.map(function(p) { return p.match.home+' vs '+p.match.away+' — '+p.label+' (EV '+(p.ev>0?'+':'')+p.ev.toFixed(2)+')'; }),
      }].concat(prev.slice(0,19));
    });

    setAiLoad(true);
    try {
      if (!ANTHROPIC_KEY) throw new Error('NO_KEY');
      const detail = np.map(function(p) {
        const pm = poissonModel(p.match);
        return p.match.home+' vs '+p.match.away+' ['+p.match.league+']\n'
          +'  Market: '+p.label+' | True: '+p.prob+'% | Edge: '+(p.edge*100).toFixed(1)+'% | EV: '+(p.ev>0?'+':'')+p.ev.toFixed(2)+' | Odds: '+p.odds+'\n'
          +'  xG: H'+pm.lH+' A'+pm.lA+' | Form H:'+p.match.hForm+' A:'+p.match.aForm+' | '+(p.match.hasRealOdds?'Real '+p.match.bookmaker:'Estimated');
      }).join('\n\n');

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':ANTHROPIC_KEY, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1400,
          messages: [{
            role: 'user',
            content: 'You are a quantitative football betting analyst. This accumulator uses Poisson distribution + bookmaker blend, EV maximisation, diversity enforcement. dc12 blocked unless edge >8%.\n\n'
              + detail
              + '\n\nCombined odds: '+co.toFixed(2)+'x | Win prob: '+wc.toFixed(1)+'% | Historical '+legs+'-leg win rate: '+wr+'% | Avg EV: '+(avgEV>0?'+':'')+avgEV.toFixed(3)
              + '\n\nAnalyse:\n'
              + '1. PICK ANALYSIS — edge source and why each market has value\n'
              + '2. RISK FACTORS — where the Poisson model could fail\n'
              + '3. VERDICT — confidence /10, suggested stake 1-5%, one key insight\n\n'
              + 'Be sharp and quantitative. Reference xG and edge numbers.',
          }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      setAiText((data.content || []).map(function(c) { return c.text||''; }).join(''));
    } catch (e) {
      if (e.message === 'NO_KEY')
        setAiText('Add VITE_ANTHROPIC_KEY in Vercel Environment Variables then redeploy.');
      else
        setAiText('AI error: ' + e.message);
    }
    setAiLoad(false);
  }

  function pickTxt() {
    return picks.map(function(p, i) {
      return (i+1)+'. '+p.match.home+' vs '+p.match.away+'\n   '+p.label+' @ '+p.odds+'x — EV '+(p.ev>0?'+':'')+p.ev.toFixed(2)+'\n   '+p.match.flag+' '+p.match.league+' · '+p.match.time;
    }).join('\n\n');
  }

  function copyAll() {
    const txt = 'WinSmart '+legs+'-Leg Acca\n\n'+pickTxt()+'\n\nOdds: '+combOdds.toFixed(2)+'x\nacca-ai.vercel.app';
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(function() { setCopied(false); }, 3000);
  }

  function shareWA() {
    const txt = 'WinSmart '+legs+'-Leg Acca\n\n'+pickTxt()+'\n\nacca-ai.vercel.app';
    window.open('https://wa.me/?text='+encodeURIComponent(txt), '_blank');
  }

  // ── STYLES ────────────────────────────────────────────────
  const S = {
    card:   { background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.05)', borderRadius:14, padding:14 },
    label:  { fontSize:9, color:'#333', letterSpacing:1 },
    row:    { display:'flex', justifyContent:'space-between', alignItems:'center' },
    btn:    { border:'none', cursor:'pointer', fontFamily:'inherit' },
  };

  return (
    <div style={{ minHeight:'100vh', background:'#06080d', fontFamily:"'DM Sans',sans-serif", color:'#fff', maxWidth:460, margin:'0 auto' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&family=DM+Mono:wght@500&display=swap');
        @keyframes up { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
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

      {/* HEADER */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'rgba(6,8,13,.96)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,.05)', padding:'12px 14px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:11, background:'linear-gradient(135deg,#00ff88,#00aa55)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>⚡</div>
            <div>
              <div style={{ fontSize:19, fontWeight:900, letterSpacing:-1, lineHeight:1 }}>Win<span style={{ color:'#00ff88' }}>Smart</span></div>
              <div style={{ fontSize:9, color:'#2a2a2a' }}>POISSON · EV ENGINE · REAL ODDS</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {loading && <Spin s={12} />}
            <div onClick={load} style={{ cursor:'pointer' }}>
              <Chip t={isLive ? 'LIVE' : 'DEMO'} c={isLive ? '#00ff88' : '#f0c040'} />
            </div>
          </div>
        </div>
        <div style={{ display:'flex' }}>
          {[['build','Build'],['ai','AI'],['stats','Stats'],['history','History']].map(function(item) {
            return (
              <button key={item[0]} onClick={function(){setTab(item[0]);}} style={{ flex:1, padding:'8px 2px 10px', border:'none', background:'transparent', borderBottom:tab===item[0]?'2px solid #00ff88':'2px solid transparent', color:tab===item[0]?'#00ff88':'#333', fontSize:10, fontWeight:800, cursor:'pointer' }}>
                {item[1]}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding:'14px 12px 40px' }}>

        {/* BUILD TAB */}
        {tab === 'build' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12, animation:'up .3s ease' }}>

            {/* Status */}
            {!isLive ? (
              <div style={{ background:'rgba(240,192,64,.06)', border:'1px solid rgba(240,192,64,.14)', borderRadius:12, padding:'11px 13px' }}>
                <div style={{ fontSize:11, color:'#f0c04099', marginBottom:8, lineHeight:1.7 }}>
                  {status || (HAS_FIXTURES ? 'Connecting to API...' : 'Demo mode. Add keys in Vercel to load real data.')}
                </div>
                <button onClick={load} style={{ padding:'5px 12px', borderRadius:8, border:'none', background:'rgba(240,192,64,.15)', color:'#f0c040', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                  {loading ? 'Loading...' : 'Load Live Data'}
                </button>
              </div>
            ) : (
              <div style={{ background:'rgba(0,255,136,.05)', border:'1px solid rgba(0,255,136,.14)', borderRadius:12, padding:'9px 13px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'#00ff8888' }}>✅ {status}</span>
                <button onClick={load} style={{ padding:'3px 8px', borderRadius:7, border:'none', background:'rgba(0,255,136,.1)', color:'#00ff88', fontSize:10, fontWeight:700, cursor:'pointer' }}>Refresh</button>
              </div>
            )}

            {/* LEGS */}
            <div style={S.card}>
              <div style={{ ...S.row, marginBottom:10 }}>
                <span style={S.label}>ACCA LEGS (3-50)</span>
                <span style={{ fontSize:10, color:'#555' }}>Win rate: <strong style={{ color:'#f0c040' }}>{wr}%</strong></span>
              </div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
                {[3,4,5,6,8,10,12,15,20,25,30].map(function(n) {
                  return (
                    <button key={n} onClick={function(){setLegs(n);setPicks([]);}} style={{ padding:'6px 11px', borderRadius:9, border:'none', background:legs===n?'#00ff88':'rgba(255,255,255,.06)', color:legs===n?'#000':'#555', fontSize:12, fontWeight:900, cursor:'pointer' }}>
                      {n}
                    </button>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input type="number" min={3} max={50} value={legs} onChange={function(e){setLegs(Math.min(50,Math.max(3,+e.target.value)));setPicks([]);}} style={{ flex:1, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:9, padding:'7px 12px', color:'#fff', fontSize:13, outline:'none' }} />
                <button onClick={function(){setShowLT(!showLT);}} style={{ padding:'7px 12px', borderRadius:9, border:'1px solid rgba(255,255,255,.08)', background:'rgba(255,255,255,.04)', color:'#555', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                  {showLT ? 'Hide' : 'Win %'}
                </button>
              </div>
              {showLT && (
                <div style={{ marginTop:10, maxHeight:150, overflowY:'auto' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4 }}>
                    {Object.entries(LEG_WR).map(function(entry) {
                      const l = entry[0], r = entry[1];
                      return (
                        <div key={l} onClick={function(){setLegs(+l);setPicks([]);}} style={{ background:+l===legs?'rgba(0,255,136,.12)':'rgba(255,255,255,.03)', borderRadius:7, padding:'5px 6px', cursor:'pointer', textAlign:'center' }}>
                          <div style={{ fontSize:9, color:'#444' }}>{l}-leg</div>
                          <div style={{ fontSize:11, fontWeight:800, color:r>=40?'#00ff88':r>=15?'#f0c040':'#ff6b6b' }}>{r}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* DATES */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:10 }}>MATCH DATES</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                {[0,1,2,3,4,5,6].map(function(d) {
                  return (
                    <button key={d} onClick={function(){toggleDay(d);}} style={{ padding:'6px 12px', borderRadius:10, border:'none', background:days.includes(d)?'#00ff88':'rgba(255,255,255,.06)', color:days.includes(d)?'#000':'#555', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                      {dayLabel(d)}
                    </button>
                  );
                })}
                <button onClick={function(){setDays([0,1,2,3,4,5,6]);}} style={{ padding:'6px 12px', borderRadius:10, border:'none', background:'rgba(0,255,136,.1)', color:'#00ff88', fontSize:11, fontWeight:800, cursor:'pointer' }}>All 7</button>
              </div>
            </div>

            {/* MARKETS */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:6 }}>MARKETS · 5 CATEGORIES · EV SELECTION</div>
              <div style={{ fontSize:10, color:'#a78bfa', padding:'6px 10px', background:'rgba(167,139,250,.07)', borderRadius:8, marginBottom:10 }}>
                AI picks highest EV market per match. dc12 only if edge greater than 8%
              </div>
              <div style={{ display:'flex', gap:3, marginBottom:10, flexWrap:'wrap' }}>
                {MCATS.map(function(cat) {
                  return (
                    <button key={cat} onClick={function(){setMcat(cat);}} style={{ padding:'4px 9px', borderRadius:8, border:'none', background:mcat===cat?'rgba(167,139,250,.2)':'rgba(255,255,255,.05)', color:mcat===cat?'#a78bfa':'#444', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                      {cat}
                    </button>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12 }}>
                {MARKETS.filter(function(m) { return m.cat === mcat; }).map(function(m) {
                  const on = allowed.includes(m.id);
                  return (
                    <button key={m.id} onClick={function(){toggleMkt(m.id);}} style={{ padding:'6px 10px', borderRadius:8, border:'none', background:on?'rgba(0,255,136,.14)':'rgba(255,255,255,.04)', color:on?'#00ff88':'#555', fontSize:11, fontWeight:700, cursor:'pointer', outline:on?'1px solid rgba(0,255,136,.35)':'none' }}>
                      {m.label} <span style={{ fontSize:8, color:on?'#00ff8844':'#1a1a1a' }}>·{m.wr}%</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ padding:'8px 10px', background:'rgba(0,255,136,.05)', borderRadius:9, border:'1px solid rgba(0,255,136,.1)', marginBottom:10 }}>
                <div style={{ fontSize:9, color:'#333', marginBottom:5 }}>SELECTED ({allowed.length})</div>
                <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                  {allowed.map(function(id) {
                    const m = MARKETS.find(function(x) { return x.id === id; });
                    return <Chip key={id} t={m ? m.short : id} c="#00ff88" />;
                  })}
                </div>
              </div>
              <div style={{ fontSize:9, color:'#333', marginBottom:6 }}>PRESETS:</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {PRESETS.map(function(g) {
                  return (
                    <button key={g.l} onClick={function(){setAllowed(g.ids);}} style={{ padding:'5px 10px', borderRadius:8, border:'none', background:'rgba(255,255,255,.05)', color:'#555', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                      {g.l}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EV FILTERS */}
            <div style={{ ...S.card, display:'flex', flexDirection:'column', gap:16 }}>
              <div style={S.label}>QUANTITATIVE FILTERS · EV MODEL</div>

              <div>
                <div style={{ ...S.row, marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:11, color:'#666', fontWeight:700 }}>Min Edge</div>
                    <div style={{ fontSize:9, color:'#333' }}>True prob minus bookmaker implied</div>
                  </div>
                  <span style={{ fontSize:18, fontWeight:900, color:'#00ff88', fontFamily:'monospace' }}>{(minEdge*100).toFixed(0)}%</span>
                </div>
                <input type="range" min={0} max={15} step={1} value={Math.round(minEdge*100)} onChange={function(e){setMinEdge(+e.target.value/100);}} />
                <div style={{ ...S.row, marginTop:4 }}>
                  <span style={{ fontSize:8, color:'#1a1a1a' }}>0% All picks</span>
                  <span style={{ fontSize:8, color:'#1a1a1a' }}>15% Value only</span>
                </div>
              </div>

              <div>
                <div style={{ ...S.row, marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:11, color:'#666', fontWeight:700 }}>Min Odds</div>
                    <div style={{ fontSize:9, color:'#333' }}>Exclude below this price</div>
                  </div>
                  <span style={{ fontSize:18, fontWeight:900, color:'#a78bfa', fontFamily:'monospace' }}>{minOdds.toFixed(2)}</span>
                </div>
                <input type="range" min={100} max={300} step={5} value={Math.round(minOdds*100)} onChange={function(e){setMinOdds(+e.target.value/100);}} />
                <div style={{ ...S.row, marginTop:4 }}>
                  <span style={{ fontSize:8, color:'#1a1a1a' }}>1.00</span>
                  <span style={{ fontSize:8, color:'#1a1a1a' }}>3.00</span>
                </div>
              </div>

              <div>
                <div style={{ ...S.row, marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:11, color:'#666', fontWeight:700 }}>Max Odds</div>
                    <div style={{ fontSize:9, color:'#333' }}>Exclude high-risk outsiders</div>
                  </div>
                  <span style={{ fontSize:18, fontWeight:900, color:'#f0c040', fontFamily:'monospace' }}>{maxOdds >= 15 ? 'No limit' : maxOdds.toFixed(1)}</span>
                </div>
                <input type="range" min={150} max={1500} step={50} value={Math.round(maxOdds*100)} onChange={function(e){setMaxOdds(+e.target.value/100);}} />
                <div style={{ ...S.row, marginTop:4 }}>
                  <span style={{ fontSize:8, color:'#1a1a1a' }}>1.5 Safe</span>
                  <span style={{ fontSize:8, color:'#1a1a1a' }}>No limit</span>
                </div>
              </div>

              <div style={{ padding:'10px 12px', background:'rgba(0,255,136,.04)', border:'1px solid rgba(0,255,136,.1)', borderRadius:10 }}>
                <div style={{ fontSize:10, color:'#00ff88', fontWeight:700, marginBottom:4 }}>EV Mode Active</div>
                <div style={{ fontSize:9, color:'#00ff8866', lineHeight:1.6 }}>
                  Poisson model + bookmaker blend. Highest EV market selected. dc12 blocked unless edge above 8%. Diversity enforced across legs.
                </div>
              </div>
            </div>

            {/* MATCH LIST */}
            <div>
              <div style={{ ...S.row, marginBottom:10 }}>
                <span style={S.label}>VALUE PICKS ({filtered.length})</span>
                {loading && <span style={{ fontSize:9, color:'#f0c040' }}>Loading...</span>}
              </div>
              {filtered.length === 0 ? (
                <div style={{ background:'rgba(255,107,107,.05)', border:'1px solid rgba(255,107,107,.1)', borderRadius:14, padding:28, textAlign:'center' }}>
                  <div style={{ fontSize:30, marginBottom:8 }}>🔍</div>
                  <div style={{ fontSize:13, color:'#ff6b6b88', fontWeight:700 }}>No value picks found</div>
                  <div style={{ fontSize:11, color:'#222', marginTop:4 }}>Lower Min Edge or expand dates</div>
                </div>
              ) : filtered.map(function(m, i) {
                const b = pickBest(m, allowed, minEdge, minOdds, maxOdds, []);
                return b ? <Card key={m.id} m={m} best={b} idx={i} /> : null;
              })}
            </div>

            {/* ACCA SUMMARY */}
            {picks.length > 0 && (
              <div style={{ background:'linear-gradient(135deg,rgba(0,255,136,.07),rgba(0,180,80,.03))', border:'1px solid rgba(0,255,136,.18)', borderRadius:16, padding:16, animation:'up .3s ease' }}>
                <div style={{ fontSize:9, color:'#00ff8855', letterSpacing:1, marginBottom:12 }}>YOUR {picks.length}-LEG VALUE ACCA</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                  {[['ODDS',combOdds.toFixed(2)+'x','#fff'],['WIN %',winChance.toFixed(1)+'%','#00ff88'],['AVG EV',(avgEV>0?'+':'')+avgEV.toFixed(2),'#a78bfa'],['LEGS',picks.length,'#f0c040']].map(function(item) {
                    return (
                      <div key={item[0]} style={{ textAlign:'center' }}>
                        <div style={{ fontSize:8, color:'#333', marginBottom:3 }}>{item[0]}</div>
                        <div style={{ fontSize:14, fontWeight:900, color:item[2], fontFamily:'monospace', lineHeight:1 }}>{item[1]}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ background:'rgba(0,0,0,.3)', borderRadius:10, padding:12, marginBottom:12 }}>
                  <div style={{ fontSize:9, color:'#333', marginBottom:8 }}>PICKS — ADD ON SPORTYBET</div>
                  {picks.map(function(p, i) {
                    const mkt = MARKETS.find(function(m) { return m.id === p.id; });
                    return (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:'#eee' }}>{p.match.home} vs {p.match.away}</div>
                          <div style={{ fontSize:9, color:'#444' }}>{p.match.flag} {p.match.league} · {p.match.time}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <Chip t={mkt ? mkt.short : p.id} c="#00ff88" />
                          <div style={{ fontSize:8, color:'#00ff8866', marginTop:2 }}>{p.odds}x · EV {p.ev>0?'+':''}{p.ev.toFixed(2)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <button onClick={copyAll} style={{ width:'100%', padding:12, borderRadius:11, background:copied?'#00ff88':'rgba(0,255,136,.12)', border:'1px solid rgba(0,255,136,.28)', color:copied?'#000':'#00ff88', fontSize:12, fontWeight:800, cursor:'pointer' }}>
                    {copied ? 'COPIED!' : 'Copy All Picks'}
                  </button>
                  <button onClick={function(){window.open('https://www.sportybet.com/ng/','_blank');}} style={{ width:'100%', padding:12, borderRadius:11, background:'linear-gradient(135deg,#00a651,#007a3d)', border:'none', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer' }}>
                    Open SportyBet Nigeria
                  </button>
                  <button onClick={shareWA} style={{ width:'100%', padding:12, borderRadius:11, background:'rgba(37,211,102,.12)', border:'1px solid rgba(37,211,102,.3)', color:'#25d366', fontSize:12, fontWeight:800, cursor:'pointer' }}>
                    Share on WhatsApp
                  </button>
                  <button onClick={function(){setTab('ai');}} style={{ width:'100%', padding:12, borderRadius:11, background:'rgba(167,139,250,.1)', border:'1px solid rgba(167,139,250,.22)', color:'#a78bfa', fontSize:12, fontWeight:800, cursor:'pointer' }}>
                    View AI Analysis
                  </button>
                </div>
              </div>
            )}

            <button onClick={generate} disabled={generating || filtered.length === 0} style={{ width:'100%', padding:18, borderRadius:14, border:'none', background:generating?'rgba(0,255,136,.08)':'linear-gradient(135deg,#00ff88,#00cc60)', color:generating?'#00ff88':'#000', fontSize:15, fontWeight:900, cursor:generating||filtered.length===0?'not-allowed':'pointer', animation:!generating&&filtered.length>0?'pulse 2.5s ease-in-out infinite':'none', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
              {generating ? 'Building EV Accumulator...' : 'Generate ' + legs + '-Leg Value Acca'}
            </button>
            <div style={{ textAlign:'center', fontSize:9, color:'#1a1a1a', marginTop:4 }}>Poisson model · EV maximisation · Diversity enforced</div>
          </div>
        )}

        {/* AI TAB */}
        {tab === 'ai' && (
          <div style={{ animation:'up .3s ease', display:'flex', flexDirection:'column', gap:12 }}>
            {picks.length === 0 ? (
              <div style={{ textAlign:'center', padding:60 }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🤖</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#222' }}>No acca yet</div>
                <div style={{ fontSize:11, color:'#1a1a1a', marginTop:6 }}>Go to Build and Generate</div>
              </div>
            ) : (
              <>
                <div style={S.card}>
                  <div style={{ ...S.label, marginBottom:10 }}>YOUR {picks.length}-LEG VALUE ACCA</div>
                  {picks.map(function(p, i) {
                    return (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:'#eee' }}>{p.match.home} vs {p.match.away}</div>
                          <div style={{ fontSize:10, color:'#444' }}>{p.match.flag} {p.match.league} · <span style={{ color:'#a78bfa' }}>{p.label}</span></div>
                          <div style={{ fontSize:9, color:'#2a2a2a', marginTop:2 }}>EV {p.ev>0?'+':''}{p.ev.toFixed(2)} · Edge {(p.edge*100).toFixed(1)}% · {p.odds}x</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:15, fontWeight:900, color:'#00ff88', fontFamily:'monospace' }}>{p.prob}%</div>
                          <div style={{ fontSize:9, color:'#333' }}>score {p.score}/100</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ background:'rgba(167,139,250,.04)', border:'1px solid rgba(167,139,250,.14)', borderRadius:14, padding:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    <span style={{ fontSize:20 }}>🤖</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:800, color:'#a78bfa' }}>WINSMART AI ANALYST</div>
                      <div style={{ fontSize:9, color:'#222' }}>Powered by Claude AI</div>
                    </div>
                    {aiLoad && <Spin c="#a78bfa" />}
                  </div>
                  {aiLoad
                    ? <div style={{ fontSize:12, color:'#1a1a1a', animation:'shimmer 1.5s ease infinite' }}>Analysing picks...</div>
                    : aiText
                      ? <div style={{ fontSize:12, color:'#888', lineHeight:1.9, whiteSpace:'pre-wrap' }}>{aiText}</div>
                      : <div style={{ fontSize:11, color:'#222' }}>Generate an acca first.</div>
                  }
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={generate} style={{ flex:1, padding:13, borderRadius:12, border:'none', background:'rgba(0,255,136,.08)', color:'#00ff88', fontSize:12, fontWeight:800, cursor:'pointer' }}>Regenerate</button>
                  <button onClick={copyAll}  style={{ flex:1, padding:13, borderRadius:12, border:'none', background:'rgba(0,255,136,.08)', color:'#00ff88', fontSize:12, fontWeight:800, cursor:'pointer' }}>Copy Picks</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {tab === 'stats' && (
          <div style={{ animation:'up .3s ease', display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[['TOTAL ACCAS','559','#00ff88'],['WIN RATE','28.7%','#f0c040'],['PICK ACCURACY','83.9%','#a78bfa'],['BEST HIT','18.14x','#00ff88']].map(function(item) {
                return (
                  <div key={item[0]} style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.05)', borderRadius:14, padding:14 }}>
                    <div style={{ fontSize:8, color:'#222', letterSpacing:1, marginBottom:6 }}>{item[0]}</div>
                    <div style={{ fontSize:26, fontWeight:900, color:item[2], fontFamily:'monospace' }}>{item[1]}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.05)', borderRadius:14, padding:16 }}>
              <div style={{ ...S.label, marginBottom:14 }}>WIN RATE BY LEGS</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5 }}>
                {Object.entries(LEG_WR).map(function(entry) {
                  const l = entry[0], r = entry[1];
                  return (
                    <div key={l} onClick={function(){setLegs(+l);setTab('build');}} style={{ background:+l===legs?'rgba(0,255,136,.12)':'rgba(255,255,255,.03)', borderRadius:8, padding:'6px 5px', textAlign:'center', cursor:'pointer' }}>
                      <div style={{ fontSize:9, color:'#333' }}>{l}-leg</div>
                      <div style={{ fontSize:13, fontWeight:800, color:r>=40?'#00ff88':r>=15?'#f0c040':'#ff6b6b' }}>{r}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.05)', borderRadius:14, padding:16 }}>
              <div style={{ ...S.label, marginBottom:14 }}>ALL 20 MARKETS RANKED</div>
              {[...MARKETS].sort(function(a,b){return b.wr-a.wr;}).map(function(m, i) {
                return (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                    <div style={{ fontSize:10, color:'#222', width:22, flexShrink:0, fontWeight:800 }}>#{i+1}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:'#666', fontWeight:700, marginBottom:3 }}>{m.label} <span style={{ fontSize:8, color:'#2a2a2a' }}>· {m.cat}</span></div>
                      <Bar v={m.wr} c={m.wr>=65?'#00ff88':m.wr>=40?'#f0c040':'#ff6b6b'} />
                    </div>
                    <div style={{ fontSize:12, fontWeight:900, color:m.wr>=65?'#00ff88':m.wr>=40?'#f0c040':'#ff6b6b', minWidth:34, textAlign:'right' }}>{m.wr}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div style={{ animation:'up .3s ease' }}>
            {history.length === 0 ? (
              <div style={{ textAlign:'center', padding:60 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:14, color:'#222', fontWeight:700 }}>No history yet</div>
              </div>
            ) : history.map(function(h, i) {
              return (
                <div key={i} style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.05)', borderRadius:14, padding:14, marginBottom:10 }}>
                  <div style={{ ...S.row, marginBottom:8 }}>
                    <span style={{ fontSize:11, color:'#555' }}>{h.date} · {h.legs}-leg</span>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{ fontSize:14, fontWeight:900, color:'#a78bfa', fontFamily:'monospace' }}>{h.odds}x</span>
                      <Chip t={h.result} c={h.result==='WON'?'#00ff88':h.result==='LOST'?'#ff6b6b':'#f0c040'} />
                    </div>
                  </div>
                  {h.picks.map(function(p, j) {
                    return <div key={j} style={{ fontSize:10, color:'#333', padding:'3px 0', borderTop:'1px solid rgba(255,255,255,.03)' }}>· {p}</div>;
                  })}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
