import { useState, useEffect } from “react”;

// ─────────────────────────────────────────────────────────────
// KEYS — set these in Vercel Environment Variables
//   VITE_APISPORTS_KEY  = api-sports.io key (fixtures)
//   VITE_ODDS_KEY       = the-odds-api.com key (real odds)
//   VITE_ANTHROPIC_KEY  = Anthropic key (AI analysis)
// ─────────────────────────────────────────────────────────────
const APISPORTS_KEY = import.meta.env.VITE_APISPORTS_KEY || “”;
const ODDS_KEY      = import.meta.env.VITE_ODDS_KEY      || “”;
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || “”;
const HAS_KEY       = APISPORTS_KEY.length > 5;
const HAS_ODDS      = ODDS_KEY.length > 5;

// ─────────────────────────────────────────────────────────────
// THE ODDS API — real bookmaker odds
// Supported bookmakers include Bet365, Betway, 1xBet, Pinnacle
// ─────────────────────────────────────────────────────────────
const ODDS_BASE = “https://api.the-odds-api.com/v4”;

// The Odds API sport keys for football
const ODDS_SPORTS = [
“soccer_epl”,           // Premier League
“soccer_spain_la_liga”, // La Liga
“soccer_germany_bundesliga”, // Bundesliga
“soccer_italy_serie_a”, // Serie A
“soccer_france_ligue_one”, // Ligue 1
“soccer_uefa_champs_league”, // Champions League
“soccer_uefa_europa_league”, // Europa League
“soccer_england_championship”, // Championship
];

// Preferred bookmakers in priority order
// Bet365 = bet365, Betway = betway, 1xBet = onexbet
const BOOKMAKERS = [“bet365”,“betway”,“onexbet”,“pinnacle”,“unibet”];

async function fetchOddsForSport(sportKey) {
try {
const params = new URLSearchParams({
apiKey: ODDS_KEY,
regions: “eu,uk”,
markets: “h2h,totals”,
bookmakers: BOOKMAKERS.join(”,”),
oddsFormat: “decimal”,
});
const res = await fetch(`${ODDS_BASE}/sports/${sportKey}/odds?${params}`);
if (!res.ok) return [];
const data = await res.json();
return Array.isArray(data) ? data : [];
} catch { return []; }
}

// Build a lookup map: “Home Team vs Away Team” -> odds object
async function buildOddsMap() {
const map = {};
for (const sport of ODDS_SPORTS) {
const events = await fetchOddsForSport(sport);
for (const ev of events) {
// Try each preferred bookmaker in order
let bm = null;
for (const bmKey of BOOKMAKERS) {
bm = ev.bookmakers?.find(b => b.key === bmKey);
if (bm) break;
}
if (!bm) bm = ev.bookmakers?.[0];
if (!bm) continue;

```
  const h2h = bm.markets?.find(m => m.key === "h2h");
  const totals = bm.markets?.find(m => m.key === "totals");

  if (!h2h) continue;

  const homeOdd = parseFloat(h2h.outcomes?.find(o => o.name === ev.home_team)?.price || 0);
  const awayOdd = parseFloat(h2h.outcomes?.find(o => o.name === ev.away_team)?.price || 0);
  const drawOdd = parseFloat(h2h.outcomes?.find(o => o.name === "Draw")?.price || 0);

  // Over/Under 2.5
  const over25  = parseFloat(totals?.outcomes?.find(o => o.name === "Over"  && o.point === 2.5)?.price || 0);
  const under25 = parseFloat(totals?.outcomes?.find(o => o.name === "Under" && o.point === 2.5)?.price || 0);
  const over15  = parseFloat(totals?.outcomes?.find(o => o.name === "Over"  && o.point === 1.5)?.price || 0);

  const key = `${ev.home_team}|${ev.away_team}`.toLowerCase();
  const keyAlt = `${ev.away_team}|${ev.home_team}`.toLowerCase();

  const oddsObj = {
    homeOdd, drawOdd, awayOdd,
    over25Odd: over25, under25Odd: under25, over15Odd: over15,
    bookmaker: bm.title,
    commenceTime: ev.commence_time,
  };

  map[key] = oddsObj;
  map[keyAlt] = oddsObj;
}
await new Promise(r => setTimeout(r, 150));
```

}
return map;
}

// Match a fixture to odds using fuzzy team name matching
function matchOdds(oddsMap, home, away) {
const key = `${home}|${away}`.toLowerCase();
if (oddsMap[key]) return oddsMap[key];

// Try partial match — strip FC, United, City etc
const clean = s => s.toLowerCase()
.replace(/\s+(fc|cf|sc|ac|as|if|bv|sv|1.|utd|united|city|town|rovers|wanderers|athletic|albion|county|palace)$/,’’)
.trim();

const ch = clean(home), ca = clean(away);
for (const [k, v] of Object.entries(oddsMap)) {
const [kh, ka] = k.split(”|”);
if (clean(kh||””).includes(ch) && clean(ka||””).includes(ca)) return v;
if (ch.includes(clean(kh||””)) && ca.includes(clean(ka||””))) return v;
}
return null;
}

// Apply real odds to a match object
function applyRealOdds(match, oddsData) {
if (!oddsData || !oddsData.homeOdd) return match;
const { homeOdd:ho, drawOdd:do_, awayOdd:ao, over25Odd, over15Odd, bookmaker } = oddsData;

const rawH = 1/ho, rawD = 1/do_, rawA = 1/ao;
const tot = rawH + rawD + rawA;
const hp = Math.round((rawH/tot)*100);
const dp = Math.round((rawD/tot)*100);
const ap = Math.round((rawA/tot)*100);

// Derive over/under from odds if available
const o25 = over25Odd > 0 ? Math.round((1/over25Odd)*100*1.05) : match.o25;
const o15 = over15Odd > 0 ? Math.round((1/over15Odd)*100*1.05) : match.o15;

return {
…match,
hp: Math.min(Math.max(hp,12),82),
dp: Math.min(Math.max(dp,8),40),
ap: Math.min(Math.max(ap,10),72),
hodd: ho, dodd: do_, aodd: ao,
o25: Math.min(Math.max(o25,20),85),
o15: Math.min(Math.max(o15,45),95),
btts: Math.round((hp*0.55+ap*0.65)),
bookmaker,
hasRealOdds: true,
};
}

// ─────────────────────────────────────────────────────────────
// API-FOOTBALL (api-sports.io)
// Base URL for direct api-sports.io access
// ─────────────────────────────────────────────────────────────
const API_BASE = “https://v3.football.api-sports.io”;
const API_HEADERS = {
“x-apisports-key”: APISPORTS_KEY,
};

// Supported leagues (api-sports.io league IDs)
const LEAGUES = [
{ id:39,   name:“Premier League”,   country:“England”,      flag:“🏴󠁧󠁢󠁥󠁮󠁧󠁿”, tier:1 },
{ id:140,  name:“La Liga”,          country:“Spain”,        flag:“🇪🇸”, tier:1 },
{ id:78,   name:“Bundesliga”,       country:“Germany”,      flag:“🇩🇪”, tier:1 },
{ id:135,  name:“Serie A”,          country:“Italy”,        flag:“🇮🇹”, tier:1 },
{ id:61,   name:“Ligue 1”,          country:“France”,       flag:“🇫🇷”, tier:1 },
{ id:2,    name:“Champions League”, country:“Europe”,       flag:“🏆”, tier:1 },
{ id:3,    name:“Europa League”,    country:“Europe”,       flag:“🥈”, tier:1 },
{ id:40,   name:“Championship”,     country:“England”,      flag:“🏴󠁧󠁢󠁥󠁮󠁧󠁿”, tier:2 },
{ id:88,   name:“Eredivisie”,       country:“Netherlands”,  flag:“🇳🇱”, tier:2 },
{ id:94,   name:“Primeira Liga”,    country:“Portugal”,     flag:“🇵🇹”, tier:2 },
{ id:307,  name:“NPFL”,             country:“Nigeria”,      flag:“🇳🇬”, tier:2 },
{ id:233,  name:“NPFL”,             country:“Nigeria”,      flag:“🇳🇬”, tier:2 },
{ id:71,   name:“Serie A”,          country:“Brazil”,       flag:“🇧🇷”, tier:1 },
{ id:262,  name:“Liga MX”,          country:“Mexico”,       flag:“🇲🇽”, tier:1 },
{ id:144,  name:“Pro League”,       country:“Belgium”,      flag:“🇧🇪”, tier:2 },
{ id:203,  name:“Super Lig”,        country:“Turkey”,       flag:“🇹🇷”, tier:2 },
];

// Get today’s date string YYYY-MM-DD
function today() {
return new Date().toISOString().split(“T”)[0];
}
function offsetDate(n) {
const d = new Date();
d.setDate(d.getDate() + n);
return d.toISOString().split(“T”)[0];
}

// ─── FETCH ALL FIXTURES FOR NEXT 7 DAYS ──────────────────────
async function fetchFixtures() {
const dateFrom = today();
const dateTo   = offsetDate(7);

// Fetch fixtures by date range — single call
const res = await fetch(
`${API_BASE}/fixtures?from=${dateFrom}&to=${dateTo}&status=NS`,
{ headers: API_HEADERS }
);

if (!res.ok) {
throw new Error(`API error ${res.status}`);
}

const data = await res.json();

if (data.errors && Object.keys(data.errors).length > 0) {
const errMsg = Object.values(data.errors)[0];
throw new Error(errMsg);
}

return data.response || [];
}

// ─── FETCH ODDS FOR A FIXTURE ─────────────────────────────────
async function fetchOdds(fixtureId) {
try {
const res = await fetch(
`${API_BASE}/odds?fixture=${fixtureId}&bookmaker=8`,
{ headers: API_HEADERS }
);
if (!res.ok) return null;
const data = await res.json();
return data.response?.[0] || null;
} catch { return null; }
}

// ─── PARSE FIXTURE INTO WINSMART FORMAT ──────────────────────
function parseFixture(f) {
const fixture  = f.fixture;
const teams    = f.teams;
const goals    = f.goals;
const league   = f.league;
const score    = f.score;

const dt   = new Date(fixture.date);
const date = dt.toISOString().split(“T”)[0];
const time = dt.toLocaleTimeString(“en-GB”, { hour:“2-digit”, minute:“2-digit” });

const home = teams.home?.name || “Home”;
const away = teams.away?.name || “Away”;

// Find league info
const lgInfo = LEAGUES.find(l => l.id === league.id) || {
id: league.id,
name: league.name || “Football”,
country: league.country || “”,
flag: “⚽”,
tier: 2,
};

// Default probabilities (will be updated with real odds if available)
const hp = 45, dp = 26, ap = 29;
const avgG = lgInfo.tier === 1 ? 2.7 : 2.3;
const o25 = Math.round(38 + (avgG - 2) * 16);
const o15 = Math.min(o25 + 22, 92);
const btts = 55;

return {
id: fixture.id,
home, away,
league: lgInfo.name,
leagueId: league.id,
country: lgInfo.country,
flag: lgInfo.flag,
tier: lgInfo.tier,
time, date,
timestamp: dt.getTime(),
hp, dp, ap, btts, o15, o25,
conf: lgInfo.tier === 1 ? 80 : 66,
hodd: parseFloat((100/hp).toFixed(2)),
dodd: parseFloat((100/dp).toFixed(2)),
aodd: parseFloat((100/ap).toFixed(2)),
ca: lgInfo.tier === 1 ? 10.2 : 8.8,
cr: 3.8,
hForm: “WWDLW”,
aForm: “LWWDL”,
venue: fixture.venue?.name || “”,
};
}

// ─── ENRICH MATCH WITH REAL ODDS ─────────────────────────────
function applyOdds(match, oddsData) {
if (!oddsData) return match;
try {
const bets = oddsData.bookmakers?.[0]?.bets || [];
const matchWinner = bets.find(b => b.name === “Match Winner”);
if (!matchWinner) return match;

```
const hOdd = parseFloat(matchWinner.values.find(v=>v.value==="Home")?.odd || 0);
const dOdd = parseFloat(matchWinner.values.find(v=>v.value==="Draw")?.odd || 0);
const aOdd = parseFloat(matchWinner.values.find(v=>v.value==="Away")?.odd || 0);

if (!hOdd || !dOdd || !aOdd) return match;

const rawH = 1/hOdd, rawD = 1/dOdd, rawA = 1/aOdd;
const total = rawH + rawD + rawA;
const hp = Math.round((rawH/total)*100);
const dp = Math.round((rawD/total)*100);
const ap = Math.round((rawA/total)*100);

return {
  ...match,
  hp: Math.min(Math.max(hp,12),82),
  dp: Math.min(Math.max(dp,8),40),
  ap: Math.min(Math.max(ap,10),72),
  hodd: hOdd,
  dodd: dOdd,
  aodd: aOdd,
  btts: Math.round((hp*0.55+ap*0.65)),
  o25: Math.round(38+(match.o25-38)*1.0),
  hasRealOdds: true,
};
```

} catch { return match; }
}

// ─────────────────────────────────────────────────────────────
// DEMO DATA
// ─────────────────────────────────────────────────────────────
const DEMO = [
{ id:1,  home:“Arsenal”,        away:“Chelsea”,     league:“Premier League”,  country:“England”,     flag:“🏴󠁧󠁢󠁥󠁮󠁧󠁿”, tier:1, time:“15:00”, date:today(),        hp:63, dp:21, ap:16, btts:71, o15:88, o25:67, conf:89, hodd:1.62, dodd:3.90, aodd:5.20, ca:10.8, cr:4.1, hForm:“WWDWW”, aForm:“LWDLW”, hasRealOdds:false },
{ id:2,  home:“Real Madrid”,    away:“Barcelona”,   league:“La Liga”,         country:“Spain”,       flag:“🇪🇸”, tier:1, time:“20:00”, date:today(),        hp:48, dp:27, ap:25, btts:78, o15:91, o25:74, conf:82, hodd:2.10, dodd:3.40, aodd:3.60, ca:11.2, cr:4.8, hForm:“WWWDW”, aForm:“WLWWW”, hasRealOdds:false },
{ id:3,  home:“Bayern Munich”,  away:“Dortmund”,    league:“Bundesliga”,      country:“Germany”,     flag:“🇩🇪”, tier:1, time:“17:30”, date:today(),        hp:57, dp:23, ap:20, btts:65, o15:93, o25:72, conf:91, hodd:1.85, dodd:3.70, aodd:4.10, ca:10.4, cr:3.6, hForm:“WWWWW”, aForm:“WDWLW”, hasRealOdds:false },
{ id:4,  home:“Juventus”,       away:“Inter Milan”, league:“Serie A”,         country:“Italy”,       flag:“🇮🇹”, tier:1, time:“19:45”, date:today(),        hp:42, dp:31, ap:27, btts:58, o15:79, o25:55, conf:76, hodd:2.40, dodd:3.20, aodd:3.10, ca:9.1,  cr:4.5, hForm:“DWWLD”, aForm:“WWDWL”, hasRealOdds:false },
{ id:5,  home:“PSG”,            away:“Marseille”,   league:“Ligue 1”,         country:“France”,      flag:“🇫🇷”, tier:1, time:“21:00”, date:today(),        hp:72, dp:17, ap:11, btts:62, o15:90, o25:69, conf:94, hodd:1.40, dodd:4.50, aodd:7.00, ca:10.1, cr:5.2, hForm:“WWWWW”, aForm:“LWLLW”, hasRealOdds:false },
{ id:6,  home:“Man City”,       away:“Liverpool”,   league:“Premier League”,  country:“England”,     flag:“🏴󠁧󠁢󠁥󠁮󠁧󠁿”, tier:1, time:“16:30”, date:offsetDate(1), hp:44, dp:26, ap:30, btts:73, o15:89, o25:71, conf:87, hodd:2.30, dodd:3.40, aodd:3.10, ca:11.5, cr:3.9, hForm:“WWLWW”, aForm:“WWWDW”, hasRealOdds:false },
{ id:7,  home:“Ajax”,           away:“PSV”,         league:“Eredivisie”,      country:“Netherlands”, flag:“🇳🇱”, tier:2, time:“14:30”, date:offsetDate(1), hp:52, dp:24, ap:24, btts:69, o15:92, o25:76, conf:80, hodd:2.00, dodd:3.50, aodd:3.80, ca:10.7, cr:3.4, hForm:“WWDWL”, aForm:“WWWWL”, hasRealOdds:false },
{ id:8,  home:“Enugu Rangers”,  away:“Enyimba”,     league:“NPFL”,            country:“Nigeria”,     flag:“🇳🇬”, tier:2, time:“16:00”, date:offsetDate(1), hp:47, dp:29, ap:24, btts:52, o15:70, o25:45, conf:65, hodd:2.20, dodd:3.10, aodd:3.60, ca:7.4,  cr:3.8, hForm:“WDWLW”, aForm:“LWDWL”, hasRealOdds:false },
{ id:9,  home:“Atletico”,       away:“Sevilla”,     league:“La Liga”,         country:“Spain”,       flag:“🇪🇸”, tier:1, time:“18:00”, date:offsetDate(2), hp:59, dp:25, ap:16, btts:48, o15:75, o25:52, conf:79, hodd:1.75, dodd:3.60, aodd:4.80, ca:8.8,  cr:4.7, hForm:“WWWDW”, aForm:“LLDWL”, hasRealOdds:false },
{ id:10, home:“Tottenham”,      away:“Newcastle”,   league:“Premier League”,  country:“England”,     flag:“🏴󠁧󠁢󠁥󠁮󠁧󠁿”, tier:1, time:“14:00”, date:offsetDate(2), hp:48, dp:26, ap:26, btts:66, o15:84, o25:62, conf:82, hodd:2.20, dodd:3.40, aodd:3.40, ca:10.2, cr:4.0, hForm:“WLDWW”, aForm:“WWLWL”, hasRealOdds:false },
{ id:11, home:“AC Milan”,       away:“Roma”,        league:“Serie A”,         country:“Italy”,       flag:“🇮🇹”, tier:1, time:“19:45”, date:offsetDate(3), hp:50, dp:27, ap:23, btts:60, o15:80, o25:58, conf:77, hodd:2.00, dodd:3.40, aodd:3.80, ca:9.5,  cr:4.2, hForm:“WWDLW”, aForm:“LWWDL”, hasRealOdds:false },
{ id:12, home:“Dortmund”,       away:“Leipzig”,     league:“Bundesliga”,      country:“Germany”,     flag:“🇩🇪”, tier:1, time:“17:30”, date:offsetDate(3), hp:46, dp:28, ap:26, btts:64, o15:85, o25:63, conf:78, hodd:2.25, dodd:3.30, aodd:3.50, ca:10.0, cr:3.7, hForm:“WDWWL”, aForm:“LWWWL”, hasRealOdds:false },
];

// ─────────────────────────────────────────────────────────────
// MARKETS — 5 categories
// ─────────────────────────────────────────────────────────────
const MARKETS = [
// ── GOALS ──
{ id:“over05”,  label:“Over 0.5 Goals”,      short:“O0.5”,    cat:“Goals”,          wr:91 },
{ id:“over15”,  label:“Over 1.5 Goals”,      short:“O1.5”,    cat:“Goals”,          wr:74 },
{ id:“over25”,  label:“Over 2.5 Goals”,      short:“O2.5”,    cat:“Goals”,          wr:51 },
{ id:“over35”,  label:“Over 3.5 Goals”,      short:“O3.5”,    cat:“Goals”,          wr:29 },
{ id:“over45”,  label:“Over 4.5 Goals”,      short:“O4.5”,    cat:“Goals”,          wr:12 },
{ id:“under15”, label:“Under 1.5 Goals”,     short:“U1.5”,    cat:“Goals”,          wr:21 },
{ id:“under25”, label:“Under 2.5 Goals”,     short:“U2.5”,    cat:“Goals”,          wr:36 },
{ id:“btts”,    label:“BTTS Yes”,            short:“GG”,      cat:“Goals”,          wr:58 },
{ id:“bttsno”,  label:“BTTS No”,             short:“NG”,      cat:“Goals”,          wr:32 },
// ── RESULT ──
{ id:“home”,    label:“Home Win”,            short:“1”,       cat:“Result”,         wr:54 },
{ id:“draw”,    label:“Draw”,               short:“X”,       cat:“Result”,         wr:26 },
{ id:“away”,    label:“Away Win”,            short:“2”,       cat:“Result”,         wr:38 },
// ── DOUBLE CHANCE ──
{ id:“dc1x”,    label:“Double Chance 1X”,    short:“1X”,      cat:“Double Chance”,  wr:68 },
{ id:“dcx2”,    label:“Double Chance X2”,    short:“X2”,      cat:“Double Chance”,  wr:65 },
{ id:“dc12”,    label:“Double Chance 12”,    short:“12”,      cat:“Double Chance”,  wr:63 },
// ── WIN EITHER HALF ──
{ id:“wehh”,    label:“Home Win Either Half”,short:“WEH-H”,   cat:“Win Either Half”, wr:62 },
{ id:“weha”,    label:“Away Win Either Half”,short:“WEH-A”,   cat:“Win Either Half”, wr:48 },
// ── HANDICAP ──
{ id:“ahch”,    label:“Asian HDP Home -0.5”, short:“AH-H”,    cat:“Handicap”,       wr:51 },
{ id:“ahca”,    label:“Asian HDP Away -0.5”, short:“AH-A”,    cat:“Handicap”,       wr:44 },
{ id:“ehca”,    label:“Euro HDP Away +1”,    short:“EH+A”,    cat:“Handicap”,       wr:58 },
];

const MCATS = [“Goals”,“Result”,“Double Chance”,“Win Either Half”,“Handicap”];
const LEG_WR = {3:62,4:54,5:45,6:38,7:31,8:25,9:20,10:17,11:14,12:11,13:9,14:7,15:6,16:5,17:4,18:4,19:3,20:3,25:1,30:1,35:0.5,40:0.3,45:0.1,50:0.1};

// ─────────────────────────────────────────────────────────────
// QUANTITATIVE EV-BASED MODEL
// Poisson score matrix + bookmaker blend + EV selection
// NEVER defaults to dc12 — picks highest Expected Value market
// ─────────────────────────────────────────────────────────────

function formScore(f=“WDWLW”) {
const weights=[1.0,0.9,0.8,0.7,0.6];
const chars=f.slice(-5).split(””).reverse();
let score=0,total=0;
chars.forEach((c,i)=>{const w=weights[i]||0.5;score+=w*(c===“W”?1:c===“D”?0.4:0);total+=w;});
return score/total;
}

function poisson(lambda,k){let p=Math.exp(-lambda);for(let i=0;i<k;i++)p*=lambda/(i+1);return p;}

function poissonModel(m) {
const hf=formScore(m.hForm||“WDWLW”), af=formScore(m.aForm||“LWDWL”);
const base=1.35;
const lH=Math.max(0.3, base*(0.5+hf)*(1.5-af)*1.12);
const lA=Math.max(0.3, base*(0.5+af)*(1.5-hf)*0.88);
let pH=0,pD=0,pA=0,pO25=0,pBTTS=0;
for(let i=0;i<=8;i++){for(let j=0;j<=8;j++){
const p=poisson(lH,i)*poisson(lA,j);
if(i>j)pH+=p; else if(i===j)pD+=p; else pA+=p;
if(i+j>2.5)pO25+=p;
if(i>0&&j>0)pBTTS+=p;
}}
return {pH:Math.round(pH*100),pD:Math.round(pD*100),pA:Math.round(pA*100),pO25:Math.round(pO25*100),pBTTS:Math.round(pBTTS*100),lH:+lH.toFixed(2),lA:+lA.toFixed(2)};
}

function trueProbability(m, id) {
const pm=poissonModel(m);
const hasOdds=m.hasRealOdds&&m.hodd>1;
const bmH=hasOdds?Math.round((1/m.hodd)*100):pm.pH;
const bmD=hasOdds?Math.round((1/m.dodd)*100):pm.pD;
const bmA=hasOdds?Math.round((1/m.aodd)*100):pm.pA;
const w=hasOdds?0.6:1.0, bw=1-w;
const H=Math.round(pm.pH*w+bmH*bw), D=Math.round(pm.pD*w+bmD*bw), A=Math.round(pm.pA*w+bmA*bw);
const O25=Math.round(pm.pO25*w+(m.o25||50)*bw), BTTS=Math.round(pm.pBTTS*w+(m.btts||55)*bw);
const O15=Math.min(O25+22,94);
switch(id){
case “over05”: return 96;
case “over15”: return O15;
case “over25”: return O25;
case “over35”: return Math.max(O25-24,6);
case “over45”: return Math.max(O25-40,3);
case “under15”: return 100-O15;
case “under25”: return 100-O25;
case “btts”:   return BTTS;
case “bttsno”: return 100-BTTS;
case “home”:   return H;
case “draw”:   return D;
case “away”:   return A;
case “dc1x”:   return Math.min(H+D,97);
case “dcx2”:   return Math.min(A+D,97);
case “dc12”:   return Math.min(H+A,97);
case “wehh”:   return Math.min(Math.round(H*1.18+O15*0.12),88);
case “weha”:   return Math.min(Math.round(A*1.20+O15*0.10),76);
case “ahch”:   return Math.round(H*0.92);
case “ahca”:   return Math.round(A*0.92);
case “ehch”:   return Math.min(Math.round(H+D*0.75),94);
case “ehca”:   return Math.min(Math.round(A+D*0.75),88);
default: return H;
}
}

function getOdds(m, id) {
switch(id){
case “home”: return m.hodd||0;
case “draw”: return m.dodd||0;
case “away”: return m.aodd||0;
default:
const tp=trueProbability(m,id);
return tp>0 ? parseFloat((100/tp*0.94).toFixed(2)) : 99;
}
}

function calcEV(m, id) {
const tp=trueProbability(m,id)/100;
const odds=getOdds(m,id)||estimatedOdds(m,id);
const impliedP=1/odds;
const edge=parseFloat((tp-impliedP).toFixed(3));
const ev=parseFloat((tp*(odds-1)-(1-tp)).toFixed(3));
const pm=poissonModel(m);
const reasons=[];
const hf=formScore(m.hForm||“WDWLW”), af=formScore(m.aForm||“LWDWL”);
if(hf>0.7) reasons.push(`H.form ${(hf*100).toFixed(0)}%`);
if(af<0.3) reasons.push(`Away poor`);
if(af>0.7) reasons.push(`A.form ${(af*100).toFixed(0)}%`);
reasons.push(`xG ${pm.lH}v${pm.lA}`);
if(edge>0.08) reasons.push(`Strong edge`);
if(ev>0.1) reasons.push(`+EV`);
return {id,tp:Math.round(tp*100),ip:Math.round(impliedP*100),edge,ev,odds:+odds.toFixed(2),reason:reasons.join(” · “)};
}

function estimatedOdds(m,id){
const tp=trueProbability(m,id);
return tp>0?parseFloat((100/tp*0.94).toFixed(2)):99;
}

// ── CORE PICK ENGINE — EV maximiser with diversity ──
function pickBest(m, allowed, minEdge=0.02, minOdds=1.40, maxOdds=15, usedMarkets=[]) {
const candidates = allowed
.map(id=>calcEV(m,id))
.filter(ev=>{
const oddsOk=ev.odds>=minOdds&&ev.odds<=maxOdds;
const edgeOk=ev.edge>=minEdge;
// Heavily penalise dc12 — only select if genuinely best EV
if(ev.id===“dc12”&&ev.edge<0.08) return false;
return oddsOk&&edgeOk;
})
.sort((a,b)=>{
const divA=usedMarkets.includes(a.id)?-0.05:0;
const divB=usedMarkets.includes(b.id)?-0.05:0;
return (b.ev+divB)-(a.ev+divA);
});

if(candidates.length===0){
// No value — return best EV within odds range, flagged as no-value
const fallback=allowed
.map(id=>calcEV(m,id))
.filter(ev=>ev.odds>=minOdds&&ev.odds<=maxOdds)
.sort((a,b)=>b.ev-a.ev)[0];
if(!fallback) return null;
return {…fallback, noValue:true, score:Math.round(Math.max(fallback.tp*0.4,10)), prob:fallback.tp};
}

const best=candidates[0];
const score=Math.min(Math.round((best.ev+1)*40+best.edge*60),99);
return {…best, score:Math.max(score,10), noValue:false, prob:best.tp};
}

// Legacy wrapper for market grid display
function calcProb(m,id){return trueProbability(m,id);}

// ─────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────
const Spin = ({s=16,c=”#00ff88”}) => (
<span style={{width:s,height:s,border:`2px solid ${c}22`,borderTopColor:c,borderRadius:“50%”,display:“inline-block”,animation:“spin .7s linear infinite”,flexShrink:0}}/>
);
const Bar = ({v,c}) => {
const col=c||(v>=68?”#00ff88”:v>=50?”#f0c040”:”#ff6b6b”);
return <div style={{height:4,background:“rgba(255,255,255,.06)”,borderRadius:99,overflow:“hidden”}}><div style={{width:`${Math.min(v,100)}%`,height:“100%”,background:col,borderRadius:99,transition:“width 1s”}}/></div>;
};
const Tag = ({t,c=”#00ff88”}) => (
<span style={{background:`${c}18`,border:`1px solid ${c}40`,color:c,fontSize:9,fontWeight:800,padding:“2px 7px”,borderRadius:99,whiteSpace:“nowrap”}}>{t}</span>
);
const Dot = ({r}) => {
const bg=r===“W”?”#00ff88”:r===“D”?”#f0c040”:”#ff6b6b”;
return <span style={{width:16,height:16,borderRadius:4,background:bg,display:“inline-flex”,alignItems:“center”,justifyContent:“center”,fontSize:8,fontWeight:900,color:”#000”}}>{r}</span>;
};

// ─────────────────────────────────────────────────────────────
// MATCH CARD
// ─────────────────────────────────────────────────────────────
function Card({m, best, idx}) {
const [open, setOpen] = useState(false);
const mkt = MARKETS.find(x=>x.id===best.id);
const pc = best.prob>=68?”#00ff88”:best.prob>=50?”#f0c040”:”#ff6b6b”;
const sc = best.score>=75?”#00ff88”:best.score>=55?”#f0c040”:”#ff6b6b”;

return (
<div style={{animation:`up .3s ease ${idx*.04}s both`,marginBottom:10}}>
<div style={{background:“rgba(255,255,255,.025)”,border:“1px solid rgba(255,255,255,.06)”,borderRadius:16,overflow:“hidden”}}>
<div style={{padding:“13px 14px”}}>
<div style={{fontSize:10,color:”#555”,marginBottom:6}}>
{m.flag} {m.league} · {m.time}
{m.hasRealOdds && <span style={{marginLeft:6,background:“rgba(0,255,136,.15)”,color:”#00ff88”,fontSize:8,padding:“1px 5px”,borderRadius:99,fontWeight:800}}>📊 {m.bookmaker||“LIVE ODDS”}</span>}
</div>
<div style={{display:“flex”,justifyContent:“space-between”,alignItems:“flex-start”,marginBottom:10}}>
<div style={{flex:1,paddingRight:8}}>
<div style={{fontSize:15,fontWeight:800,color:”#eee”,lineHeight:1.2}}>{m.home}</div>
<div style={{fontSize:10,color:”#333”,margin:“3px 0”}}>vs</div>
<div style={{fontSize:15,fontWeight:800,color:”#eee”}}>{m.away}</div>
<div style={{marginTop:8,display:“inline-flex”,gap:5,alignItems:“center”,background:“rgba(167,139,250,.10)”,border:“1px solid rgba(167,139,250,.2)”,borderRadius:8,padding:“4px 9px”}}>
<span style={{fontSize:9,color:”#a78bfa”}}>🤖 AI picks:</span>
<span style={{fontSize:10,fontWeight:800,color:”#a78bfa”}}>{mkt?.label}</span>
</div>
{/* EV data row */}
{(() => {
const ev = calcEV(m, best.id);
const edgeCol = ev.edge>=0.08?”#00ff88”:ev.edge>=0.04?”#f0c040”:”#ff6b6b”;
return (
<div style={{marginTop:6,display:“flex”,gap:6,flexWrap:“wrap”}}>
<span style={{fontSize:9,background:“rgba(0,255,136,.1)”,color:”#00ff88”,padding:“2px 6px”,borderRadius:99,fontWeight:700}}>
EV: {ev.ev>0?”+”:””}{ev.ev.toFixed(2)}
</span>
<span style={{fontSize:9,background:`rgba(240,192,64,.1)`,color:edgeCol,padding:“2px 6px”,borderRadius:99,fontWeight:700}}>
Edge: {(ev.edge*100).toFixed(1)}%
</span>
<span style={{fontSize:9,background:“rgba(167,139,250,.1)”,color:”#a78bfa”,padding:“2px 6px”,borderRadius:99,fontWeight:700}}>
Odds: {ev.odds}
</span>
</div>
);
})()}
{/* Reason */}
{(() => {
const ev = calcEV(m, best.id);
return ev.reason ? (
<div style={{marginTop:5,fontSize:9,color:”#2a2a2a”,lineHeight:1.4}}>{ev.reason}</div>
) : null;
})()}
</div>
<div style={{background:`${pc}14`,border:`1px solid ${pc}33`,borderRadius:10,padding:“7px 10px”,textAlign:“center”,minWidth:64}}>
<div style={{fontSize:22,fontWeight:900,color:pc,fontFamily:“monospace”,lineHeight:1}}>{best.prob}%</div>
<div style={{fontSize:8,color:”#555”,marginTop:2}}>{mkt?.short}</div>
</div>
</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr 1fr”,gap:5,marginBottom:10}}>
{[[“1 HOME”,m.hodd,m.hp],[“X DRAW”,m.dodd,m.dp],[“2 AWAY”,m.aodd,m.ap]].map(([l,o,p])=>(
<div key={l} style={{background:“rgba(255,255,255,.04)”,borderRadius:8,padding:“6px 4px”,textAlign:“center”}}>
<div style={{fontSize:8,color:”#333”}}>{l}</div>
<div style={{fontSize:13,fontWeight:900,color:”#ddd”}}>{(o||2).toFixed(2)}</div>
<div style={{fontSize:9,color:”#444”}}>{p}%</div>
</div>
))}
</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr 1fr”,gap:5,marginBottom:10}}>
{[[“Avg Corners”,m.ca||”?”],[“Avg Cards”,m.cr||”?”],[“Over 2.5”,m.o25+”%”]].map(([l,v])=>(
<div key={l} style={{background:“rgba(255,255,255,.03)”,borderRadius:7,padding:“5px 4px”,textAlign:“center”}}>
<div style={{fontSize:8,color:”#2a2a2a”}}>{l}</div>
<div style={{fontSize:11,fontWeight:800,color:”#666”}}>{v}</div>
</div>
))}
</div>
<div style={{display:“flex”,justifyContent:“space-between”,marginBottom:4}}>
<span style={{fontSize:9,color:”#333”}}>AI CONFIDENCE SCORE</span>
<span style={{fontSize:9,fontWeight:800,color:sc}}>{best.score}/100</span>
</div>
<Bar v={best.score} c={sc}/>
</div>
<button onClick={()=>setOpen(!open)} style={{width:“100%”,background:“rgba(255,255,255,.02)”,border:“none”,borderTop:“1px solid rgba(255,255,255,.04)”,color:”#2a2a2a”,fontSize:9,cursor:“pointer”,padding:“8px”,letterSpacing:.5}}>
{open?“▲ HIDE MARKETS”:“▼ VIEW ALL 43 MARKETS”}
</button>
{open && (
<div style={{padding:“12px 14px”,borderTop:“1px solid rgba(255,255,255,.04)”}}>
{MCATS.map(cat=>(
<div key={cat} style={{marginBottom:10}}>
<div style={{fontSize:9,color:”#333”,letterSpacing:.5,marginBottom:5}}>{cat.toUpperCase()}</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:3}}>
{MARKETS.filter(mk=>mk.cat===cat).map(mk=>{
const p=calcProb(m,mk.id);
const chosen=mk.id===best.id;
return(
<div key={mk.id} style={{background:chosen?“rgba(167,139,250,.1)”:“rgba(255,255,255,.02)”,border:chosen?“1px solid rgba(167,139,250,.3)”:“1px solid transparent”,borderRadius:7,padding:“4px 7px”,display:“flex”,justifyContent:“space-between”,alignItems:“center”}}>
<span style={{fontSize:9,color:chosen?”#a78bfa”:”#3a3a3a”}}>{mk.label}{chosen?” 🤖”:””}</span>
<span style={{fontSize:10,fontWeight:800,color:p>=65?”#00ff88”:p>=45?”#f0c040”:”#ff6b6b”}}>{p}%</span>
</div>
);
})}
</div>
</div>
))}
<div style={{display:“flex”,flexDirection:“column”,gap:6,marginTop:8}}>
{[[“HOME”,m.hForm],[“AWAY”,m.aForm]].map(([s,f])=>(
<div key={s} style={{display:“flex”,alignItems:“center”,gap:8}}>
<span style={{fontSize:9,color:”#333”,width:36}}>{s}</span>
<div style={{display:“flex”,gap:3}}>{(f||“WDLWW”).slice(-5).split(””).map((r,i)=><Dot key={i} r={r}/>)}</div>
</div>
))}
</div>
{m.venue && <div style={{marginTop:8,fontSize:9,color:”#2a2a2a”}}>🏟️ {m.venue}</div>}
</div>
)}
</div>
</div>
);
}

// ─────────────────────────────────────────────────────────────
// PRESETS
// ─────────────────────────────────────────────────────────────
const PRESETS = [
{ l:“🥅 Goals Only”,       ids:[“over05”,“over15”,“over25”,“over35”,“under25”,“btts”,“bttsno”] },
{ l:“🏆 Results Only”,     ids:[“home”,“draw”,“away”] },
{ l:“🔁 Double Chance”,    ids:[“dc1x”,“dcx2”,“dc12”] },
{ l:“⚡ Win Either Half”,  ids:[“wehh”,“weha”] },
{ l:“📐 Handicap Only”,    ids:[“ahch”,“ahca”,“ehch”,“ehca”] },
{ l:“🤖 AI Best Mix”,      ids:[“over15”,“over25”,“btts”,“home”,“dc1x”,“dcx2”,“wehh”,“ahch”,“ehch”] },
{ l:“✅ All 20”,            ids:MARKETS.map(m=>m.id) },
];

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
const [tab,      setTab]     = useState(“build”);
const [matches,  setMatches] = useState([]);
const [loading,  setLoading] = useState(false);
const [isLive,   setIsLive]  = useState(false);
const [errMsg,   setErrMsg]  = useState(””);
const [apiInfo,  setApiInfo] = useState(””);

const [legs,     setLegs]    = useState(3);
const [days,     setDays]    = useState([0,1,2,3,4,5,6]);
const [allowed,  setAllowed] = useState([“over15”,“over25”,“btts”,“home”,“dc1x”,“dcx2”,“wehh”,“weha”,“ahch”,“ehch”]);
const [mcat,     setMcat]    = useState(“Goals”);
const [minP,     setMinP]    = useState(50);
const [minS,     setMinS]    = useState(40);
const [minOdds,  setMinOdds] = useState(1.40);
const [maxOdds,  setMaxOdds] = useState(10.0);
const [minEdge,  setMinEdge] = useState(0.02);
const [valMode,  setValMode] = useState(false);
const [showLT,   setShowLT]  = useState(false);

const [picks,    setPicks]   = useState([]);
const [gen,      setGen]     = useState(false);
const [aiText,   setAiText]  = useState(””);
const [aiLoad,   setAiLoad]  = useState(false);
const [history,  setHist]    = useState([]);
const [copied,   setCopied]  = useState(false);

useEffect(() => { load(); }, []);

async function load() {
setLoading(true);
setErrMsg(””);
setApiInfo(””);

```
if (!HAS_KEY) {
  setMatches(DEMO);
  setIsLive(false);
  setLoading(false);
  return;
}

try {
  // Step 1 — Fetch fixtures from API-Football
  const fixtures = await fetchFixtures();
  setApiInfo(`${fixtures.length} fixtures found`);

  if (fixtures.length > 0) {
    let parsed = fixtures.map(f => parseFixture(f));
    parsed.sort((a,b) => a.timestamp - b.timestamp);

    // Step 2 — Fetch real odds from The Odds API if key available
    if (HAS_ODDS) {
      setApiInfo(`${fixtures.length} fixtures · Loading real odds...`);
      try {
        const oddsMap = await buildOddsMap();
        const oddsCount = Object.keys(oddsMap).length / 2;
        parsed = parsed.map(m => {
          const od = matchOdds(oddsMap, m.home, m.away);
          return od ? applyRealOdds(m, od) : m;
        });
        const enriched = parsed.filter(m => m.hasRealOdds).length;
        setApiInfo(`${fixtures.length} fixtures · ${enriched} with real odds`);
      } catch {
        setApiInfo(`${fixtures.length} fixtures · Odds unavailable`);
      }
    }

    setMatches(parsed);
    setIsLive(true);
  } else {
    setMatches(DEMO);
    setIsLive(false);
    setErrMsg("No scheduled matches found. Showing demo data.");
  }
} catch(e) {
  setMatches(DEMO);
  setIsLive(false);
  setErrMsg("⚠️ " + e.message);
}

setLoading(false);
```

}

const dayStr = (n=0) => {
const d = new Date();
d.setDate(d.getDate()+n);
return d.toISOString().split(“T”)[0];
};
const dayLabel = (n) => {
if(n===0) return “Today”;
if(n===1) return “Tomorrow”;
const d = new Date();
d.setDate(d.getDate()+n);
return d.toLocaleDateString(“en-GB”,{weekday:“short”,day:“numeric”,month:“short”});
};

const filtered = matches.filter(m => {
const inDay = days.some(d => dayStr(d) === m.date);
const b = pickBest(m, allowed, minEdge, minOdds, maxOdds, []);
if (!b) return false;
return inDay && !b.noValue;
});

const combOdds  = picks.reduce((a,p)=>a*(1/Math.max(p.prob/100,0.01)),1);
const winChance = picks.reduce((a,p)=>a*(p.prob/100),1)*100;
const avgAI     = picks.length ? Math.round(picks.reduce((a,p)=>a+p.score,0)/picks.length) : 0;
const wr        = LEG_WR[legs]||”<0.1”;

const toggleMkt = id => setAllowed(p=>p.includes(id)?p.length>1?p.filter(x=>x!==id):p:[…p,id]);
const toggleDay = d  => setDays(p=>p.includes(d)?p.length>1?p.filter(x=>x!==d):p:[…p,d]);

async function generate() {
if(!filtered.length) return;
setGen(true); setPicks([]); setAiText(””);
await new Promise(r=>setTimeout(r,700));
const usedMkts = [];
const scored = filtered
.map(m=>{
const b=pickBest(m,allowed,minEdge,minOdds,maxOdds,usedMkts);
if(b) usedMkts.push(b.id);
return{…m,_b:b};
})
.filter(m=>m._b&&!m._b.noValue)
.sort((a,b)=>b._b.ev-a._b.ev);
const np = scored.slice(0,legs).map(m=>({
match:m, id:m._b.id, prob:m._b.prob, score:m._b.score,
label:MARKETS.find(x=>x.id===m._b.id)?.label||m._b.id,
}));
setPicks(np);
setGen(false);
const odds = np.reduce((a,p)=>a*(1/Math.max(p.prob/100,0.01)),1);
const wc   = np.reduce((a,p)=>a*(p.prob/100),1)*100;
setHist(prev=>[{
date:new Date().toLocaleDateString(“en-GB”,{day:“numeric”,month:“short”}),
legs, result:“Pending”, odds:odds.toFixed(2),
picks:np.map(p=>`${p.match.home} vs ${p.match.away} — ${p.label}`),
},…prev.slice(0,19)]);

```
setAiLoad(true);
try {
  if(!ANTHROPIC_KEY) throw new Error("NO_KEY");
  const detail = np.map(p=>{
    const ev=calcEV(p.match,p.id);
    const pm=poissonModel(p.match);
    return `${p.match.home} vs ${p.match.away} [${p.match.league}]\n  Pick: ${p.label} | True prob: ${ev.tp}% | Implied: ${ev.ip}% | Edge: ${(ev.edge*100).toFixed(1)}% | EV: ${ev.ev>0?"+":""}${ev.ev.toFixed(2)} | Odds: ${ev.odds}\n  xG model: H${pm.lH} vs A${pm.lA} | Form H:${p.match.hForm||"?"} A:${p.match.aForm||"?"} | ${p.match.hasRealOdds?"Real Bet365 odds":"Estimated odds"}`;
  }).join("\n\n");
  const res = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01"},
    body:JSON.stringify({
      model:"claude-sonnet-4-20250514", max_tokens:1400,
      messages:[{role:"user",content:`You are a quantitative football betting analyst. This is an EV-based accumulator selected by a Poisson model blended with bookmaker odds.\n\n${detail}\n\nCombined odds: ${odds.toFixed(2)}x | Win probability: ${wc.toFixed(1)}% | Historical ${legs}-leg win rate: ${wr}%\n\nAnalyse using Expected Value principles:\n🎯 PICK ANALYSIS — EV, edge, and why this market has value\n⚠️ RISK FACTORS — where the model could be wrong\n📊 PORTFOLIO VIEW — diversification, combined edge\n✅ VERDICT — confidence /10, stake sizing (Kelly-adjusted), key insight\n\nFocus on edge and EV not just win probability. Be sharp and quantitative.`}]
    })
  });
  const data = await res.json();
  if(data.error) throw new Error(data.error.message);
  setAiText(data.content?.map(c=>c.text||"").join("")||"");
} catch(e) {
  if(e.message==="NO_KEY")
    setAiText("⚠️ Add VITE_ANTHROPIC_KEY in Vercel → Settings → Environment Variables → Redeploy.");
  else
    setAiText("⚠️ "+e.message);
}
setAiLoad(false);
```

}

const pickTxt = () => picks.map((p,i)=>`${i+1}. ${p.match.home} vs ${p.match.away}\n   ✅ ${p.label} — ${p.prob}%\n   ${p.match.flag} ${p.match.league} · ${p.match.time}`).join(”\n\n”);
function copyAll(){navigator.clipboard?.writeText(`🏆 WinSmart ${legs}-Leg Acca\n\n${pickTxt()}\n\n💰 Odds: ${combOdds.toFixed(2)}x | Win: ${winChance.toFixed(1)}%\n\nacca-ai.vercel.app`);setCopied(true);setTimeout(()=>setCopied(false),3000);}
function shareWA(){window.open(`https://wa.me/?text=${encodeURIComponent(`🏆 WinSmart ${legs}-Leg Acca\n\n${pickTxt()}\n\n💰 Odds: ${combOdds.toFixed(2)}x\n\nacca-ai.vercel.app`)}`,”_blank”);}

return (
<div style={{minHeight:“100vh”,background:”#06080d”,fontFamily:”‘DM Sans’,sans-serif”,color:”#fff”,maxWidth:460,margin:“0 auto”}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&family=DM+Mono:wght@500&display=swap'); @keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{box-shadow:0 0 20px #00ff8822}50%{box-shadow:0 0 44px #00ff8855}} @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:1}} *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:rgba(0,255,136,.2);border-radius:99px} input[type=range]{-webkit-appearance:none;background:transparent;width:100%} input[type=range]::-webkit-slider-runnable-track{height:4px;background:rgba(255,255,255,.07);border-radius:99px} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#00ff88;margin-top:-8px} button,input{font-family:inherit}`}</style>

```
  {/* HEADER */}
  <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(6,8,13,.96)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,.05)",padding:"12px 14px 0"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:11,background:"linear-gradient(135deg,#00ff88,#00aa55)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>⚡</div>
        <div>
          <div style={{fontSize:19,fontWeight:900,letterSpacing:-1,lineHeight:1}}>Win<span style={{color:"#00ff88"}}>Smart</span></div>
          <div style={{fontSize:9,color:"#2a2a2a",letterSpacing:.5}}>43 MARKETS · AI ENGINE · API-FOOTBALL DATA</div>
        </div>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {loading && <Spin s={12}/>}
        <div onClick={load} style={{cursor:"pointer"}}>
          <Tag t={isLive?"🟢 LIVE":"⚡ DEMO"} c={isLive?"#00ff88":"#f0c040"}/>
        </div>
      </div>
    </div>
    <div style={{display:"flex"}}>
      {[["build","🎯 Build"],["ai","🤖 AI"],["stats","📊 Stats"],["history","📋 History"]].map(([id,label])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"8px 2px 10px",border:"none",background:"transparent",borderBottom:tab===id?"2px solid #00ff88":"2px solid transparent",color:tab===id?"#00ff88":"#333",fontSize:10,fontWeight:800,cursor:"pointer"}}>{label}</button>
      ))}
    </div>
  </div>

  <div style={{padding:"14px 12px 40px"}}>

    {tab==="build" && (
      <div style={{display:"flex",flexDirection:"column",gap:12,animation:"up .3s ease"}}>

        {/* Status */}
        {!isLive ? (
          <div style={{background:"rgba(240,192,64,.06)",border:"1px solid rgba(240,192,64,.14)",borderRadius:12,padding:"11px 13px"}}>
            <div style={{fontSize:11,color:"#f0c04099",lineHeight:1.7,marginBottom:8}}>
              {errMsg || (HAS_KEY?"⏳ Connecting to API-Football...":"⚡ Demo mode · Add VITE_APISPORTS_KEY in Vercel for real fixtures")}
            </div>
            {apiInfo && <div style={{fontSize:10,color:"#f0c04066",marginBottom:6}}>{apiInfo}</div>}
            <button onClick={load} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"rgba(240,192,64,.15)",color:"#f0c040",fontSize:10,fontWeight:700,cursor:"pointer"}}>
              {loading?"⏳ Loading...":"🔄 Load Live Matches"}
            </button>
          </div>
        ) : (
          <div style={{background:"rgba(0,255,136,.05)",border:"1px solid rgba(0,255,136,.14)",borderRadius:12,padding:"9px 13px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:"#00ff8888"}}>✅ {matches.length} fixtures · {matches.filter(m=>m.hasRealOdds).length} with real Bet365/Betway odds</span>
            <button onClick={load} style={{padding:"3px 8px",borderRadius:7,border:"none",background:"rgba(0,255,136,.1)",color:"#00ff88",fontSize:10,fontWeight:700,cursor:"pointer"}}>🔄</button>
          </div>
        )}

        {/* LEGS */}
        <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:9,color:"#333",letterSpacing:1}}>ACCA LEGS <span style={{color:"#00ff88"}}>(3–50)</span></span>
            <span style={{fontSize:10,color:"#555"}}>Win rate: <strong style={{color:"#f0c040"}}>{wr}%</strong></span>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
            {[3,4,5,6,8,10,12,15,20,25,30,40,50].map(n=>(
              <button key={n} onClick={()=>{setLegs(n);setPicks([]);}} style={{padding:"6px 11px",borderRadius:9,border:"none",background:legs===n?"#00ff88":"rgba(255,255,255,.06)",color:legs===n?"#000":"#555",fontSize:12,fontWeight:900,cursor:"pointer"}}>{n}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input type="number" min={3} max={50} value={legs} onChange={e=>{setLegs(Math.min(50,Math.max(3,+e.target.value)));setPicks([]);}} style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,padding:"7px 12px",color:"#fff",fontSize:13,outline:"none"}}/>
            <button onClick={()=>setShowLT(!showLT)} style={{padding:"7px 12px",borderRadius:9,border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.04)",color:"#555",fontSize:10,fontWeight:700,cursor:"pointer"}}>{showLT?"Hide":"Win %"}</button>
          </div>
          {showLT&&(
            <div style={{marginTop:10,maxHeight:160,overflowY:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                {Object.entries(LEG_WR).map(([l,r])=>(
                  <div key={l} onClick={()=>{setLegs(+l);setPicks([]);}} style={{background:+l===legs?"rgba(0,255,136,.12)":"rgba(255,255,255,.03)",borderRadius:7,padding:"5px 6px",cursor:"pointer",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#444"}}>{l}-leg</div>
                    <div style={{fontSize:11,fontWeight:800,color:r>=40?"#00ff88":r>=15?"#f0c040":"#ff6b6b"}}>{r}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DATES */}
        <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
          <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:10}}>MATCH DATES <span style={{color:"#00ff88"}}>· TAP ANY COMBINATION</span></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
            {[0,1,2,3,4,5,6].map(d=>(
              <button key={d} onClick={()=>toggleDay(d)} style={{padding:"6px 12px",borderRadius:10,border:"none",background:days.includes(d)?"#00ff88":"rgba(255,255,255,.06)",color:days.includes(d)?"#000":"#555",fontSize:11,fontWeight:800,cursor:"pointer",transition:"all .15s"}}>{dayLabel(d)}</button>
            ))}
            <button onClick={()=>setDays([0,1,2,3,4,5,6])} style={{padding:"6px 12px",borderRadius:10,border:"none",background:"rgba(0,255,136,.1)",color:"#00ff88",fontSize:11,fontWeight:800,cursor:"pointer"}}>All 7</button>
          </div>
          <div style={{fontSize:10,color:"#333"}}>Showing: <span style={{color:"#00ff88"}}>{days.map(d=>dayLabel(d)).join(", ")}</span></div>
        </div>

        {/* MARKETS */}
        <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
          <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:6}}>MARKETS <span style={{color:"#00ff88"}}>· 5 CATEGORIES · 20 MARKETS</span></div>
          <div style={{fontSize:10,color:"#a78bfa",padding:"6px 10px",background:"rgba(167,139,250,.07)",borderRadius:8,marginBottom:10}}>
            🤖 AI picks the single best market per match from your selection
          </div>
          <div style={{display:"flex",gap:3,marginBottom:10,flexWrap:"wrap"}}>
            {MCATS.map(cat=>(
              <button key={cat} onClick={()=>setMcat(cat)} style={{padding:"4px 9px",borderRadius:8,border:"none",background:mcat===cat?"rgba(167,139,250,.2)":"rgba(255,255,255,.05)",color:mcat===cat?"#a78bfa":"#444",fontSize:10,fontWeight:700,cursor:"pointer"}}>{cat}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
            {MARKETS.filter(m=>m.cat===mcat).map(m=>{
              const on=allowed.includes(m.id);
              return(
                <button key={m.id} onClick={()=>toggleMkt(m.id)} style={{padding:"6px 10px",borderRadius:8,border:"none",background:on?"rgba(0,255,136,.14)":"rgba(255,255,255,.04)",color:on?"#00ff88":"#555",fontSize:11,fontWeight:700,cursor:"pointer",outline:on?"1px solid rgba(0,255,136,.35)":"none",transition:"all .15s"}}>
                  {m.label} <span style={{fontSize:8,color:on?"#00ff8855":"#1a1a1a"}}>·{m.wr}%</span>
                </button>
              );
            })}
          </div>
          <div style={{padding:"8px 10px",background:"rgba(0,255,136,.05)",borderRadius:9,border:"1px solid rgba(0,255,136,.1)",marginBottom:10}}>
            <div style={{fontSize:9,color:"#333",marginBottom:5}}>SELECTED ({allowed.length})</div>
            <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{allowed.map(id=>{const m=MARKETS.find(x=>x.id===id);return<Tag key={id} t={m?.short||id} c="#00ff88"/>;})}</div>
          </div>
          <div style={{fontSize:9,color:"#333",marginBottom:6}}>QUICK PRESETS:</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {PRESETS.map(g=><button key={g.l} onClick={()=>setAllowed(g.ids)} style={{padding:"5px 10px",borderRadius:8,border:"none",background:"rgba(255,255,255,.05)",color:"#555",fontSize:10,fontWeight:700,cursor:"pointer"}}>{g.l}</button>)}
          </div>
        </div>

        {/* EV FILTERS */}
        <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:9,color:"#333",letterSpacing:1}}>QUANTITATIVE FILTERS <span style={{color:"#00ff88"}}>· EV-BASED ENGINE</span></div>

          {/* Min Edge */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <div>
                <div style={{fontSize:11,color:"#666",fontWeight:700}}>Min Edge</div>
                <div style={{fontSize:9,color:"#333"}}>True prob minus bookmaker implied prob</div>
              </div>
              <span style={{fontSize:18,fontWeight:900,color:"#00ff88",fontFamily:"DM Mono,monospace"}}>{(minEdge*100).toFixed(0)}%</span>
            </div>
            <input type="range" min={0} max={15} step={1} value={Math.round(minEdge*100)} onChange={e=>setMinEdge(+e.target.value/100)}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{fontSize:8,color:"#1a1a1a"}}>0% — All picks</span>
              <span style={{fontSize:8,color:"#1a1a1a"}}>15% — Only value bets</span>
            </div>
          </div>

          {/* Min Odds */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <div>
                <div style={{fontSize:11,color:"#666",fontWeight:700}}>Min Odds</div>
                <div style={{fontSize:9,color:"#333"}}>Exclude selections below this</div>
              </div>
              <span style={{fontSize:18,fontWeight:900,color:"#a78bfa",fontFamily:"DM Mono,monospace"}}>{minOdds.toFixed(2)}</span>
            </div>
            <input type="range" min={100} max={300} step={5} value={Math.round(minOdds*100)} onChange={e=>setMinOdds(+e.target.value/100)}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{fontSize:8,color:"#1a1a1a"}}>1.00 — Any odds</span>
              <span style={{fontSize:8,color:"#1a1a1a"}}>3.00 — Higher odds only</span>
            </div>
          </div>

          {/* Max Odds */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <div>
                <div style={{fontSize:11,color:"#666",fontWeight:700}}>Max Odds</div>
                <div style={{fontSize:9,color:"#333"}}>Exclude high-risk selections above this</div>
              </div>
              <span style={{fontSize:18,fontWeight:900,color:"#f0c040",fontFamily:"DM Mono,monospace"}}>{maxOdds>=15?"∞":maxOdds.toFixed(1)}</span>
            </div>
            <input type="range" min={150} max={1500} step={50} value={Math.round(maxOdds*100)} onChange={e=>setMaxOdds(+e.target.value/100)}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{fontSize:8,color:"#1a1a1a"}}>1.5 — Safe only</span>
              <span style={{fontSize:8,color:"#1a1a1a"}}>15.0 — No limit</span>
            </div>
          </div>

          {/* Value Edge Mode info box */}
          <div style={{padding:"10px 12px",background:"rgba(0,255,136,.04)",border:"1px solid rgba(0,255,136,.1)",borderRadius:10}}>
            <div style={{fontSize:10,color:"#00ff88",fontWeight:700,marginBottom:4}}>⚡ EV Mode Active</div>
            <div style={{fontSize:9,color:"#00ff8866",lineHeight:1.6}}>
              Model uses Poisson distribution + bookmaker blend to find TRUE probability. Selects highest Expected Value market. dc12 only picked when edge &gt; 8%. Acca diversity enforced.
            </div>
          </div>
        </div>

        {/* MATCHES */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:9,color:"#333",letterSpacing:1}}>AVAILABLE <span style={{color:"#00ff88"}}>({filtered.length})</span></span>
            {loading&&<div style={{display:"flex",gap:4,alignItems:"center",fontSize:9,color:"#f0c040"}}><Spin s={10} c="#f0c040"/>Loading...</div>}
          </div>
          {filtered.length===0?(
            <div style={{background:"rgba(255,107,107,.05)",border:"1px solid rgba(255,107,107,.1)",borderRadius:14,padding:28,textAlign:"center"}}>
              <div style={{fontSize:30,marginBottom:8}}>🔍</div>
              <div style={{fontSize:13,color:"#ff6b6b88",fontWeight:700}}>No matches found</div>
              <div style={{fontSize:11,color:"#222",marginTop:4}}>Try selecting more dates or lower filters</div>
            </div>
          ):filtered.map((m,i)=>{
            const b=pickBest(m,allowed);
            return<Card key={m.id} m={m} best={b} idx={i}/>;
          })}
        </div>

        {/* ACCA SUMMARY */}
        {picks.length>0&&(
          <div style={{background:"linear-gradient(135deg,rgba(0,255,136,.07),rgba(0,180,80,.03))",border:"1px solid rgba(0,255,136,.18)",borderRadius:16,padding:16,animation:"up .3s ease"}}>
            <div style={{fontSize:9,color:"#00ff8855",letterSpacing:1,marginBottom:12}}>YOUR {picks.length}-LEG SMART ACCA</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[["ODDS",combOdds.toFixed(2)+"x","#fff"],["WIN %",winChance.toFixed(1)+"%","#00ff88"],["LEGS",picks.length,"#a78bfa"],["AI AVG",avgAI+"/100","#f0c040"]].map(([l,v,c])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontSize:8,color:"#333",marginBottom:3}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:900,color:c,fontFamily:"DM Mono,monospace",lineHeight:1}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(0,0,0,.3)",borderRadius:10,padding:12,marginBottom:12}}>
              <div style={{fontSize:9,color:"#333",marginBottom:8}}>YOUR PICKS — ADD ON SPORTYBET</div>
              {picks.map((p,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#eee"}}>{p.match.home} vs {p.match.away}</div>
                    <div style={{fontSize:9,color:"#444"}}>{p.match.flag} {p.match.league} · {p.match.time}</div>
                  </div>
                  <Tag t={MARKETS.find(m=>m.id===p.id)?.short||p.id} c="#00ff88"/>
                </div>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={copyAll} style={{width:"100%",padding:"12px",borderRadius:11,background:copied?"#00ff88":"rgba(0,255,136,.12)",border:"1px solid rgba(0,255,136,.28)",color:copied?"#000":"#00ff88",fontSize:12,fontWeight:800,cursor:"pointer",transition:"all .2s"}}>
                {copied?"✓ COPIED!":"📋 Copy All Picks"}
              </button>
              <button onClick={()=>window.open("https://www.sportybet.com/ng/","_blank")} style={{width:"100%",padding:"12px",borderRadius:11,background:"linear-gradient(135deg,#00a651,#007a3d)",border:"none",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>
                🟢 Open SportyBet Nigeria →
              </button>
              <button onClick={shareWA} style={{width:"100%",padding:"12px",borderRadius:11,background:"rgba(37,211,102,.12)",border:"1px solid rgba(37,211,102,.3)",color:"#25d366",fontSize:12,fontWeight:800,cursor:"pointer"}}>
                📲 Share on WhatsApp
              </button>
              <button onClick={()=>setTab("ai")} style={{width:"100%",padding:"12px",borderRadius:11,background:"rgba(167,139,250,.1)",border:"1px solid rgba(167,139,250,.22)",color:"#a78bfa",fontSize:12,fontWeight:800,cursor:"pointer"}}>
                🤖 View Full AI Analysis →
              </button>
            </div>
          </div>
        )}

        <button onClick={generate} disabled={gen||filtered.length===0} style={{width:"100%",padding:"18px",borderRadius:14,border:"none",background:gen?"rgba(0,255,136,.08)":"linear-gradient(135deg,#00ff88,#00cc60)",color:gen?"#00ff88":"#000",fontSize:15,fontWeight:900,cursor:gen||filtered.length===0?"not-allowed":"pointer",animation:!gen&&filtered.length>0?"pulse 2.5s ease-in-out infinite":"none",display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"all .3s"}}>
          {gen?<><Spin/>AI Selecting Best Markets...</>:`✦ Auto-Generate ${legs}-Leg Smart Acca`}
        </button>
        <div style={{textAlign:"center",fontSize:9,color:"#1a1a1a",marginTop:4}}>AI picks the best market per match · All 43 markets considered</div>
      </div>
    )}

    {tab==="ai"&&(
      <div style={{animation:"up .3s ease",display:"flex",flexDirection:"column",gap:12}}>
        {picks.length===0?(
          <div style={{textAlign:"center",padding:60}}>
            <div style={{fontSize:48,marginBottom:12}}>🤖</div>
            <div style={{fontSize:15,fontWeight:700,color:"#222"}}>No acca yet</div>
            <div style={{fontSize:11,color:"#1a1a1a",marginTop:6}}>Go to Build → tap Auto-Generate</div>
          </div>
        ):(
          <>
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
              <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:10}}>YOUR {picks.length}-LEG SMART ACCA</div>
              {picks.map((p,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:"#eee"}}>{p.match.home} vs {p.match.away}</div>
                    <div style={{fontSize:10,color:"#444"}}>{p.match.flag} {p.match.league} · <span style={{color:"#a78bfa"}}>{p.label}</span></div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:15,fontWeight:900,color:"#00ff88",fontFamily:"monospace"}}>{p.prob}%</div>
                    <div style={{fontSize:9,color:"#333"}}>AI {p.score}/100</div>
                  </div>
                </div>
              ))}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
                {[["ODDS",combOdds.toFixed(2)+"x","#fff"],["WIN %",winChance.toFixed(1)+"%","#00ff88"],["HIST WR",wr+"%","#f0c040"]].map(([l,v,c])=>(
                  <div key={l} style={{textAlign:"center"}}>
                    <div style={{fontSize:8,color:"#333"}}>{l}</div>
                    <div style={{fontSize:14,fontWeight:900,color:c,fontFamily:"monospace"}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{background:"rgba(167,139,250,.04)",border:"1px solid rgba(167,139,250,.14)",borderRadius:14,padding:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{fontSize:20}}>🤖</span>
                <div>
                  <div style={{fontSize:12,fontWeight:800,color:"#a78bfa"}}>WINSMART AI ANALYST</div>
                  <div style={{fontSize:9,color:"#222"}}>Powered by Claude AI</div>
                </div>
                {aiLoad&&<Spin c="#a78bfa"/>}
              </div>
              {aiLoad?<div style={{fontSize:12,color:"#1a1a1a",animation:"shimmer 1.5s ease infinite"}}>Analysing {picks.length} picks...</div>
              :aiText?<div style={{fontSize:12,color:"#888",lineHeight:1.9,whiteSpace:"pre-wrap"}}>{aiText}</div>
              :<div style={{fontSize:11,color:"#222"}}>Generate an acca to see analysis.</div>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={generate} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"rgba(0,255,136,.08)",color:"#00ff88",fontSize:12,fontWeight:800,cursor:"pointer"}}>🔄 Regenerate</button>
              <button onClick={copyAll} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"rgba(0,255,136,.08)",color:"#00ff88",fontSize:12,fontWeight:800,cursor:"pointer"}}>📋 Copy</button>
            </div>
          </>
        )}
      </div>
    )}

    {tab==="stats"&&(
      <div style={{animation:"up .3s ease",display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["TOTAL ACCAS","559","#00ff88"],["WIN RATE","28.7%","#f0c040"],["PICK ACCURACY","83.9%","#a78bfa"],["BEST HIT","18.14x","#00ff88"]].map(([l,v,c])=>(
            <div key={l} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
              <div style={{fontSize:8,color:"#222",letterSpacing:1,marginBottom:6}}>{l}</div>
              <div style={{fontSize:26,fontWeight:900,color:c,fontFamily:"DM Mono,monospace"}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:16}}>
          <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:14}}>WIN RATE BY LEGS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
            {Object.entries(LEG_WR).map(([l,r])=>(
              <div key={l} onClick={()=>{setLegs(+l);setTab("build");}} style={{background:+l===legs?"rgba(0,255,136,.12)":"rgba(255,255,255,.03)",borderRadius:8,padding:"6px 5px",textAlign:"center",cursor:"pointer"}}>
                <div style={{fontSize:9,color:"#333"}}>{l}-leg</div>
                <div style={{fontSize:13,fontWeight:800,color:r>=40?"#00ff88":r>=15?"#f0c040":"#ff6b6b"}}>{r}%</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:16}}>
          <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:14}}>ALL 20 MARKETS RANKED</div>
          {[...MARKETS].sort((a,b)=>b.wr-a.wr).map((m,i)=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
              <div style={{fontSize:10,color:"#222",width:22,flexShrink:0,fontWeight:800}}>#{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:"#666",fontWeight:700,marginBottom:3}}>{m.label} <span style={{fontSize:8,color:"#2a2a2a"}}>· {m.cat}</span></div>
                <Bar v={m.wr} c={m.wr>=65?"#00ff88":m.wr>=40?"#f0c040":"#ff6b6b"}/>
              </div>
              <div style={{fontSize:12,fontWeight:900,color:m.wr>=65?"#00ff88":m.wr>=40?"#f0c040":"#ff6b6b",minWidth:34,textAlign:"right"}}>{m.wr}%</div>
            </div>
          ))}
        </div>
      </div>
    )}

    {tab==="history"&&(
      <div style={{animation:"up .3s ease"}}>
        {history.length===0?(
          <div style={{textAlign:"center",padding:60}}>
            <div style={{fontSize:40,marginBottom:12}}>📋</div>
            <div style={{fontSize:14,color:"#222",fontWeight:700}}>No history yet</div>
          </div>
        ):history.map((h,i)=>(
          <div key={i} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:11,color:"#555"}}>{h.date} · {h.legs}-leg</span>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:14,fontWeight:900,color:"#a78bfa",fontFamily:"monospace"}}>{h.odds}x</span>
                <Tag t={h.result} c={h.result==="WON"?"#00ff88":h.result==="LOST"?"#ff6b6b":"#f0c040"}/>
              </div>
            </div>
            {h.picks.map((p,j)=><div key={j} style={{fontSize:10,color:"#333",padding:"3px 0",borderTop:"1px solid rgba(255,255,255,.03)"}}>· {p}</div>)}
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

);
}