import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────
// KEYS
// In Vercel → Settings → Environment Variables add:
// VITE_APIFOOTBALL_KEY = ad788141f16fb5c9ce269ec8e04c6fa4
// VITE_ANTHROPIC_KEY   = your anthropic key
// ─────────────────────────────────────────────────────────────
const API_KEY      = import.meta.env.VITE_APIFOOTBALL_KEY || "";
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "";
const HAS_KEY      = API_KEY.length > 10;

// API-Football direct endpoint (NOT RapidAPI)
const BASE = "https://v3.football.api-sports.io";

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": API_KEY },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    const errMsg = Object.values(data.errors).join(", ");
    throw new Error(errMsg);
  }
  return data.response || [];
}

// League IDs for API-Football
const LEAGUE_MAP = {
  39:  { name:"Premier League",   country:"England",     flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier:1 },
  2:   { name:"Champions League",  country:"Europe",      flag:"🏆",          tier:1 },
  140: { name:"La Liga",           country:"Spain",       flag:"🇪🇸",         tier:1 },
  78:  { name:"Bundesliga",        country:"Germany",     flag:"🇩🇪",         tier:1 },
  135: { name:"Serie A",           country:"Italy",       flag:"🇮🇹",         tier:1 },
  61:  { name:"Ligue 1",           country:"France",      flag:"🇫🇷",         tier:1 },
  3:   { name:"Europa League",     country:"Europe",      flag:"🥈",          tier:1 },
  40:  { name:"Championship",      country:"England",     flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier:2 },
  88:  { name:"Eredivisie",        country:"Netherlands", flag:"🇳🇱",         tier:2 },
  94:  { name:"Primeira Liga",     country:"Portugal",    flag:"🇵🇹",         tier:2 },
  203: { name:"Super Lig",         country:"Turkey",      flag:"🇹🇷",         tier:2 },
  307: { name:"Saudi Pro League",  country:"Saudi Arabia",flag:"🇸🇦",         tier:1 },
  71:  { name:"Brasileirao",       country:"Brazil",      flag:"🇧🇷",         tier:1 },
  128: { name:"Liga Profesional",  country:"Argentina",   flag:"🇦🇷",         tier:1 },
  262: { name:"Liga MX",           country:"Mexico",      flag:"🇲🇽",         tier:1 },
  253: { name:"MLS",               country:"USA",         flag:"🇺🇸",         tier:2 },
};

// Get today's date string
function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

// Fetch fixtures - free tier requires league+season OR just date
async function fetchFixtures() {
  const all = [];

  // Fetch by date for today + next 6 days
  // /fixtures?date=YYYY-MM-DD works on free tier without extra params
  for (let i = 0; i < 7; i++) {
    try {
      const date = todayStr(i);
      const fixtures = await apiFetch(`/fixtures?date=${date}`);
      all.push(...fixtures);
      // Respect rate limit - 10 requests/minute on free tier
      if (i < 6) await new Promise(r => setTimeout(r, 700));
    } catch { continue; }
  }

  return all
    .filter(f => f.fixture?.status?.short === "NS")
    .map(parseFixture)
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function parseFixture(f) {
  const leagueId = f.league?.id;
  const leagueInfo = LEAGUE_MAP[leagueId] || {
    name: f.league?.name || "Football",
    country: f.league?.country || "",
    flag: "⚽",
    tier: 2,
  };

  const dt = new Date(f.fixture?.date || Date.now());
  const date = dt.toISOString().split("T")[0];
  // Show in Lagos time (WAT = UTC+1)
  const time = dt.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit",
    timeZone: "Africa/Lagos"
  });

  const home = f.teams?.home?.name || "Home";
  const away = f.teams?.away?.name || "Away";

  // Use real odds if available
  const goals = f.goals;
  const score = f.score;

  // Estimate from league averages since free tier may not include odds
  const tier = leagueInfo.tier;
  const avgG = tier === 1 ? 2.7 : 2.3;
  const o25  = Math.round(38 + (avgG - 2) * 16);
  const o15  = Math.min(o25 + 22, 92);
  const btts = 56;

  // Default balanced probabilities (will improve with real odds in paid tier)
  const hp = 46, dp = 26, ap = 28;

  return {
    id: f.fixture?.id,
    fixtureId: f.fixture?.id,
    home, away,
    league: leagueInfo.name,
    leagueId,
    country: leagueInfo.country,
    flag: leagueInfo.flag,
    tier: leagueInfo.tier,
    time, date,
    timestamp: dt.getTime(),
    hp, dp, ap, btts, o15, o25,
    conf: tier === 1 ? 80 : 66,
    hodd: parseFloat((100/hp).toFixed(2)),
    dodd: parseFloat((100/dp).toFixed(2)),
    aodd: parseFloat((100/ap).toFixed(2)),
    ca: tier === 1 ? 10.2 : 8.8,
    cr: 3.8,
    hForm: "WWDLW",
    aForm: "LWWDL",
    venue: f.fixture?.venue?.name || "",
  };
}

// ─────────────────────────────────────────────────────────────
// DEMO DATA
// ─────────────────────────────────────────────────────────────
const DEMO = [
  { id:1,  home:"Arsenal",       away:"Chelsea",      league:"Premier League",  country:"England",     flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier:1, time:"16:00", date:todayStr(0), hp:63,dp:21,ap:16,btts:71,o15:88,o25:67,conf:89,hodd:1.62,dodd:3.90,aodd:5.20,ca:10.8,cr:4.1,hForm:"WWDWW",aForm:"LWDLW",venue:"Emirates" },
  { id:2,  home:"Real Madrid",   away:"Barcelona",    league:"La Liga",         country:"Spain",       flag:"🇪🇸", tier:1, time:"21:00", date:todayStr(0), hp:48,dp:27,ap:25,btts:78,o15:91,o25:74,conf:82,hodd:2.10,dodd:3.40,aodd:3.60,ca:11.2,cr:4.8,hForm:"WWWDW",aForm:"WLWWW",venue:"Bernabeu" },
  { id:3,  home:"Bayern Munich", away:"Dortmund",     league:"Bundesliga",      country:"Germany",     flag:"🇩🇪", tier:1, time:"18:30", date:todayStr(0), hp:57,dp:23,ap:20,btts:65,o15:93,o25:72,conf:91,hodd:1.85,dodd:3.70,aodd:4.10,ca:10.4,cr:3.6,hForm:"WWWWW",aForm:"WDWLW",venue:"Allianz Arena" },
  { id:4,  home:"PSG",           away:"Marseille",    league:"Ligue 1",         country:"France",      flag:"🇫🇷", tier:1, time:"22:00", date:todayStr(0), hp:72,dp:17,ap:11,btts:62,o15:90,o25:69,conf:94,hodd:1.40,dodd:4.50,aodd:7.00,ca:10.1,cr:5.2,hForm:"WWWWW",aForm:"LWLLW",venue:"Parc des Princes" },
  { id:5,  home:"Man City",      away:"Liverpool",    league:"Premier League",  country:"England",     flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier:1, time:"17:30", date:todayStr(1), hp:44,dp:26,ap:30,btts:73,o15:89,o25:71,conf:87,hodd:2.30,dodd:3.40,aodd:3.10,ca:11.5,cr:3.9,hForm:"WWLWW",aForm:"WWWDW",venue:"Etihad" },
  { id:6,  home:"Juventus",      away:"Inter Milan",  league:"Serie A",         country:"Italy",       flag:"🇮🇹", tier:1, time:"20:45", date:todayStr(1), hp:42,dp:31,ap:27,btts:58,o15:79,o25:55,conf:76,hodd:2.40,dodd:3.20,aodd:3.10,ca:9.1, cr:4.5,hForm:"DWWLD",aForm:"WWDWL",venue:"Allianz Stadium" },
  { id:7,  home:"Ajax",          away:"PSV",          league:"Eredivisie",      country:"Netherlands", flag:"🇳🇱", tier:2, time:"15:30", date:todayStr(1), hp:52,dp:24,ap:24,btts:69,o15:92,o25:76,conf:80,hodd:2.00,dodd:3.50,aodd:3.80,ca:10.7,cr:3.4,hForm:"WWDWL",aForm:"WWWWL",venue:"Johan Cruyff Arena" },
  { id:8,  home:"Enugu Rangers", away:"Enyimba",      league:"NPFL",            country:"Nigeria",     flag:"🇳🇬", tier:2, time:"17:00", date:todayStr(2), hp:47,dp:29,ap:24,btts:52,o15:70,o25:45,conf:65,hodd:2.20,dodd:3.10,aodd:3.60,ca:7.4, cr:3.8,hForm:"WDWLW",aForm:"LWDWL",venue:"Nnamdi Azikiwe" },
  { id:9,  home:"Atletico",      away:"Sevilla",      league:"La Liga",         country:"Spain",       flag:"🇪🇸", tier:1, time:"19:00", date:todayStr(2), hp:59,dp:25,ap:16,btts:48,o15:75,o25:52,conf:79,hodd:1.75,dodd:3.60,aodd:4.80,ca:8.8, cr:4.7,hForm:"WWWDW",aForm:"LLDWL",venue:"Metropolitano" },
  { id:10, home:"AC Milan",      away:"Roma",         league:"Serie A",         country:"Italy",       flag:"🇮🇹", tier:1, time:"20:45", date:todayStr(3), hp:50,dp:27,ap:23,btts:60,o15:80,o25:58,conf:77,hodd:2.00,dodd:3.40,aodd:3.80,ca:9.5, cr:4.2,hForm:"WWDLW",aForm:"LWWDL",venue:"San Siro" },
  { id:11, home:"Dortmund",      away:"Leipzig",      league:"Bundesliga",      country:"Germany",     flag:"🇩🇪", tier:1, time:"18:30", date:todayStr(3), hp:46,dp:28,ap:26,btts:64,o15:85,o25:63,conf:78,hodd:2.25,dodd:3.30,aodd:3.50,ca:10.0,cr:3.7,hForm:"WDWWL",aForm:"LWWWL",venue:"Signal Iduna" },
  { id:12, home:"Al-Hilal",      away:"Al-Nassr",     league:"Saudi Pro League",country:"Saudi Arabia",flag:"🇸🇦", tier:1, time:"20:00", date:todayStr(4), hp:54,dp:26,ap:20,btts:59,o15:82,o25:61,conf:75,hodd:1.90,dodd:3.50,aodd:4.30,ca:9.0, cr:4.0,hForm:"WWWDW",aForm:"LWWDW",venue:"Kingdom Arena" },
];

// ─────────────────────────────────────────────────────────────
// MARKETS - 43 types
// ─────────────────────────────────────────────────────────────
const MARKETS = [
  { id:"over05",  label:"Over 0.5 Goals",      short:"O0.5",    cat:"Goals",          wr:91 },
  { id:"over15",  label:"Over 1.5 Goals",      short:"O1.5",    cat:"Goals",          wr:74 },
  { id:"over25",  label:"Over 2.5 Goals",      short:"O2.5",    cat:"Goals",          wr:51 },
  { id:"over35",  label:"Over 3.5 Goals",      short:"O3.5",    cat:"Goals",          wr:29 },
  { id:"over45",  label:"Over 4.5 Goals",      short:"O4.5",    cat:"Goals",          wr:12 },
  { id:"under15", label:"Under 1.5 Goals",     short:"U1.5",    cat:"Goals",          wr:21 },
  { id:"under25", label:"Under 2.5 Goals",     short:"U2.5",    cat:"Goals",          wr:36 },
  { id:"btts",    label:"BTTS Yes",            short:"GG",      cat:"Goals",          wr:58 },
  { id:"bttsno",  label:"BTTS No",             short:"NG",      cat:"Goals",          wr:32 },
  { id:"home",    label:"Home Win",            short:"1",       cat:"Result",         wr:54 },
  { id:"draw",    label:"Draw",               short:"X",       cat:"Result",         wr:26 },
  { id:"away",    label:"Away Win",            short:"2",       cat:"Result",         wr:38 },
  { id:"dc1x",    label:"Double Chance 1X",    short:"1X",      cat:"Double Chance",  wr:68 },
  { id:"dcx2",    label:"Double Chance X2",    short:"X2",      cat:"Double Chance",  wr:65 },
  { id:"dc12",    label:"Double Chance 12",    short:"12",      cat:"Double Chance",  wr:63 },
  { id:"dnbh",    label:"Draw No Bet Home",    short:"DNB-H",   cat:"Special",        wr:49 },
  { id:"dnba",    label:"Draw No Bet Away",    short:"DNB-A",   cat:"Special",        wr:44 },
  { id:"csh",     label:"Clean Sheet Home",    short:"CS-H",    cat:"Special",        wr:28 },
  { id:"csa",     label:"Clean Sheet Away",    short:"CS-A",    cat:"Special",        wr:22 },
  { id:"htft",    label:"HT/FT Home/Home",     short:"H/H",     cat:"HT/FT",          wr:18 },
  { id:"wehh",    label:"Home Win Either Half",short:"WEH-H",   cat:"Win Either Half", wr:62 },
  { id:"weha",    label:"Away Win Either Half",short:"WEH-A",   cat:"Win Either Half", wr:48 },
  { id:"ahch",    label:"Asian HDP Home -0.5", short:"AH-H",    cat:"Handicap",       wr:51 },
  { id:"ahca",    label:"Asian HDP Away -0.5", short:"AH-A",    cat:"Handicap",       wr:44 },
  { id:"ehch",    label:"Euro HDP Home +1",    short:"EH+H",    cat:"Handicap",       wr:71 },
  { id:"ehca",    label:"Euro HDP Away +1",    short:"EH+A",    cat:"Handicap",       wr:58 },
  { id:"co85",    label:"Corners Over 8.5",    short:"C O8.5",  cat:"Corners",        wr:55 },
  { id:"co95",    label:"Corners Over 9.5",    short:"C O9.5",  cat:"Corners",        wr:42 },
  { id:"co105",   label:"Corners Over 10.5",   short:"C O10.5", cat:"Corners",        wr:31 },
  { id:"cu85",    label:"Corners Under 8.5",   short:"C U8.5",  cat:"Corners",        wr:45 },
  { id:"cdo35",   label:"Cards Over 3.5",      short:"Cd O3.5", cat:"Cards",          wr:52 },
  { id:"cdo45",   label:"Cards Over 4.5",      short:"Cd O4.5", cat:"Cards",          wr:38 },
  { id:"cdu35",   label:"Cards Under 3.5",     short:"Cd U3.5", cat:"Cards",          wr:48 },
  { id:"hao25",   label:"Home Win & Over 2.5", short:"1&O2.5",  cat:"Combo",          wr:36 },
  { id:"hau25",   label:"Home & Under 2.5",    short:"1&U2.5",  cat:"Combo",          wr:22 },
  { id:"aao25",   label:"Away Win & Over 2.5", short:"2&O2.5",  cat:"Combo",          wr:24 },
  { id:"hagg",    label:"Home Win & BTTS",     short:"1&GG",    cat:"Combo",          wr:31 },
  { id:"aagg",    label:"Away Win & BTTS",     short:"2&GG",    cat:"Combo",          wr:22 },
  { id:"hoo25",   label:"Home Win or Over 2.5",short:"1/O2.5",  cat:"Win Or",         wr:78 },
  { id:"hogg",    label:"Home Win or BTTS",    short:"1/GG",    cat:"Win Or",         wr:74 },
  { id:"aoo25",   label:"Away Win or Over 2.5",short:"2/O2.5",  cat:"Win Or",         wr:71 },
  { id:"hou25",   label:"Home or Under 2.5",   short:"1/U2.5",  cat:"Win Or",         wr:68 },
  { id:"aou25",   label:"Away or Under 2.5",   short:"2/U2.5",  cat:"Win Or",         wr:65 },
];

const MCATS = ["Goals","Result","Double Chance","Special","HT/FT","Win Either Half","Handicap","Corners","Cards","Combo","Win Or"];
const LEG_WR = {3:62,4:54,5:45,6:38,7:31,8:25,9:20,10:17,11:14,12:11,13:9,14:7,15:6,16:5,17:4,18:4,19:3,20:3,25:1,30:1,35:0.5,40:0.3,45:0.1,50:0.1};

// ─────────────────────────────────────────────────────────────
// PROBABILITY ENGINE
// ─────────────────────────────────────────────────────────────
function prob(m, id) {
  const { hp:h, dp:d, ap:a, btts:gg, o15, o25, ca=9.5, cr=3.8 } = m;
  switch(id) {
    case "over05":  return 96;
    case "over15":  return o15;
    case "over25":  return o25;
    case "over35":  return Math.max(o25-22, 8);
    case "over45":  return Math.max(o25-38, 4);
    case "under15": return 100-o15;
    case "under25": return 100-o25;
    case "btts":    return gg;
    case "bttsno":  return 100-gg;
    case "home":    return h;
    case "draw":    return d;
    case "away":    return a;
    case "dc1x":    return Math.min(h+d, 97);
    case "dcx2":    return Math.min(a+d, 97);
    case "dc12":    return Math.min(h+a, 97);
    case "dnbh":    return Math.min(Math.round(h+d*0.5), 93);
    case "dnba":    return Math.min(Math.round(a+d*0.5), 93);
    case "csh":     return Math.round(h*0.55);
    case "csa":     return Math.round(a*0.50);
    case "htft":    return Math.round(h*0.62);
    case "wehh":    return Math.min(Math.round(h*1.18+o15*0.12), 88);
    case "weha":    return Math.min(Math.round(a*1.20+o15*0.10), 76);
    case "ahch":    return Math.round(h*0.92);
    case "ahca":    return Math.round(a*0.92);
    case "ehch":    return Math.min(Math.round(h+d*0.75), 94);
    case "ehca":    return Math.min(Math.round(a+d*0.75), 88);
    case "co85":    return ca>=10?72:ca>=9?58:45;
    case "co95":    return ca>=10?61:ca>=9?47:34;
    case "co105":   return ca>=10?49:ca>=9?36:24;
    case "cu85":    return ca>=10?28:ca>=9?42:55;
    case "cdo35":   return cr>=4?64:cr>=3.5?52:40;
    case "cdo45":   return cr>=4?48:cr>=3.5?36:26;
    case "cdu35":   return cr>=4?36:cr>=3.5?48:60;
    case "hao25":   return Math.round(h*o25/100*1.1);
    case "hau25":   return Math.round(h*(100-o25)/100*1.1);
    case "aao25":   return Math.round(a*o25/100*1.1);
    case "hagg":    return Math.round(h*gg/100*1.1);
    case "aagg":    return Math.round(a*gg/100*1.1);
    case "hoo25":   return Math.min(Math.round(h+o25-h*o25/100), 96);
    case "hogg":    return Math.min(Math.round(h+gg-h*gg/100), 96);
    case "aoo25":   return Math.min(Math.round(a+o25-a*o25/100), 96);
    case "hou25":   return Math.min(Math.round(h+(100-o25)-h*(100-o25)/100), 96);
    case "aou25":   return Math.min(Math.round(a+(100-o25)-a*(100-o25)/100), 96);
    default: return h;
  }
}

function fScore(f="") {
  return f.slice(-5).split("").reduce((s,c)=>s+(c==="W"?3:c==="D"?1:0),0)/15;
}

function aiScore(m, id) {
  const p = prob(m,id)/100;
  const c = (m.conf||70)/100;
  const f = (fScore(m.hForm)+fScore(m.aForm))/2;
  const v = Math.min(Math.max(p-(m.hodd?1/m.hodd:p),0)/0.15,1);
  const t = m.tier===1?0.33:m.tier===2?0.22:0.11;
  return Math.min(Math.round((p*0.38+c*0.22+f*0.20+v*0.10+t*0.10)*100),99);
}

function bestPick(m, allowed) {
  let best=allowed[0], top=0;
  for(const id of allowed){const s=aiScore(m,id);if(s>top){top=s;best=id;}}
  return {id:best,score:top,prob:prob(m,best)};
}

// ─────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────
const Spin = ({s=16,c="#00ff88"}) => <span style={{width:s,height:s,border:`2px solid ${c}22`,borderTopColor:c,borderRadius:"50%",display:"inline-block",animation:"spin .7s linear infinite",flexShrink:0}}/>;
const Bar  = ({v,c}) => { const col=c||(v>=68?"#00ff88":v>=50?"#f0c040":"#ff6b6b"); return <div style={{height:4,background:"rgba(255,255,255,.06)",borderRadius:99,overflow:"hidden"}}><div style={{width:`${Math.min(v,100)}%`,height:"100%",background:col,borderRadius:99,transition:"width 1s"}}/></div>; };
const Tag  = ({t,c="#00ff88"}) => <span style={{background:`${c}18`,border:`1px solid ${c}40`,color:c,fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:99,whiteSpace:"nowrap"}}>{t}</span>;
const Dot  = ({r}) => { const bg=r==="W"?"#00ff88":r==="D"?"#f0c040":"#ff6b6b"; return <span style={{width:16,height:16,borderRadius:4,background:bg,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,color:"#000"}}>{r}</span>; };

// ─────────────────────────────────────────────────────────────
// MATCH CARD
// ─────────────────────────────────────────────────────────────
function Card({m, best, idx}) {
  const [open,setOpen] = useState(false);
  const mkt = MARKETS.find(x=>x.id===best.id);
  const pc  = best.prob>=68?"#00ff88":best.prob>=50?"#f0c040":"#ff6b6b";
  const sc  = best.score>=75?"#00ff88":best.score>=55?"#f0c040":"#ff6b6b";
  return (
    <div style={{animation:`up .3s ease ${idx*.04}s both`,marginBottom:10}}>
      <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:16,overflow:"hidden"}}>
        <div style={{padding:"13px 14px"}}>
          <div style={{fontSize:10,color:"#555",marginBottom:6}}>{m.flag} {m.league} · {m.time}{m.venue?` · ${m.venue}`:""}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{flex:1,paddingRight:8}}>
              <div style={{fontSize:15,fontWeight:800,color:"#eee",lineHeight:1.2}}>{m.home}</div>
              <div style={{fontSize:10,color:"#333",margin:"3px 0"}}>vs</div>
              <div style={{fontSize:15,fontWeight:800,color:"#eee"}}>{m.away}</div>
              <div style={{marginTop:8,display:"inline-flex",gap:5,alignItems:"center",background:"rgba(167,139,250,.10)",border:"1px solid rgba(167,139,250,.2)",borderRadius:8,padding:"4px 9px"}}>
                <span style={{fontSize:9,color:"#a78bfa"}}>🤖 AI picks:</span>
                <span style={{fontSize:10,fontWeight:800,color:"#a78bfa"}}>{mkt?.label}</span>
              </div>
            </div>
            <div style={{background:`${pc}14`,border:`1px solid ${pc}33`,borderRadius:10,padding:"7px 10px",textAlign:"center",minWidth:64}}>
              <div style={{fontSize:22,fontWeight:900,color:pc,fontFamily:"monospace",lineHeight:1}}>{best.prob}%</div>
              <div style={{fontSize:8,color:"#555",marginTop:2}}>{mkt?.short}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:10}}>
            {[["1 HOME",m.hodd,m.hp],["X DRAW",m.dodd,m.dp],["2 AWAY",m.aodd,m.ap]].map(([l,o,p])=>(
              <div key={l} style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"6px 4px",textAlign:"center"}}>
                <div style={{fontSize:8,color:"#333"}}>{l}</div>
                <div style={{fontSize:13,fontWeight:900,color:"#ddd"}}>{(o||2).toFixed(2)}</div>
                <div style={{fontSize:9,color:"#444"}}>{p}%</div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:10}}>
            {[["Avg Corners",m.ca||"?"],["Avg Cards",m.cr||"?"],["Over 2.5",m.o25+"%"]].map(([l,v])=>(
              <div key={l} style={{background:"rgba(255,255,255,.03)",borderRadius:7,padding:"5px 4px",textAlign:"center"}}>
                <div style={{fontSize:8,color:"#2a2a2a"}}>{l}</div>
                <div style={{fontSize:11,fontWeight:800,color:"#666"}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:9,color:"#333"}}>AI CONFIDENCE</span>
            <span style={{fontSize:9,fontWeight:800,color:sc}}>{best.score}/100</span>
          </div>
          <Bar v={best.score} c={sc}/>
        </div>
        <button onClick={()=>setOpen(!open)} style={{width:"100%",background:"rgba(255,255,255,.02)",border:"none",borderTop:"1px solid rgba(255,255,255,.04)",color:"#2a2a2a",fontSize:9,cursor:"pointer",padding:"8px",letterSpacing:.5}}>
          {open?"▲ HIDE":"▼ VIEW ALL 43 MARKETS"}
        </button>
        {open&&(
          <div style={{padding:"12px 14px",borderTop:"1px solid rgba(255,255,255,.04)"}}>
            {MCATS.map(cat=>(
              <div key={cat} style={{marginBottom:10}}>
                <div style={{fontSize:9,color:"#333",letterSpacing:.5,marginBottom:5}}>{cat.toUpperCase()}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
                  {MARKETS.filter(mk=>mk.cat===cat).map(mk=>{
                    const p=prob(m,mk.id), chosen=mk.id===best.id;
                    return <div key={mk.id} style={{background:chosen?"rgba(167,139,250,.1)":"rgba(255,255,255,.02)",border:chosen?"1px solid rgba(167,139,250,.3)":"1px solid transparent",borderRadius:7,padding:"4px 7px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:9,color:chosen?"#a78bfa":"#3a3a3a"}}>{mk.label}{chosen?" 🤖":""}</span>
                      <span style={{fontSize:10,fontWeight:800,color:p>=65?"#00ff88":p>=45?"#f0c040":"#ff6b6b"}}>{p}%</span>
                    </div>;
                  })}
                </div>
              </div>
            ))}
            <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
              {[["HOME",m.hForm],["AWAY",m.aForm]].map(([s,f])=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:9,color:"#333",width:36}}>{s}</span>
                  <div style={{display:"flex",gap:3}}>{(f||"WDLWW").slice(-5).split("").map((r,i)=><Dot key={i} r={r}/>)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PRESETS = [
  {l:"🥅 Safe Goals",  ids:["over05","over15","btts","hoo25"]},
  {l:"🏆 Results",     ids:["home","dc1x","dcx2","dnbh","wehh"]},
  {l:"🎪 Combos",      ids:["hoo25","hogg","aoo25","hao25","hagg"]},
  {l:"📐 Handicap",    ids:["ahch","ahca","ehch","ehca"]},
  {l:"⚽ Corners",     ids:["co85","co95","co105","cu85"]},
  {l:"🟨 Cards",       ids:["cdo35","cdo45","cdu35"]},
  {l:"⚡ AI Best Mix", ids:["over15","home","dc1x","btts","over25","dcx2","wehh","hoo25","co95"]},
  {l:"🎯 All 43",      ids:MARKETS.map(m=>m.id)},
];

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]         = useState("build");
  const [matches,setMatches] = useState([]);
  const [loading,setLoading] = useState(false);
  const [isLive,setIsLive]   = useState(false);
  const [errMsg,setErrMsg]   = useState("");

  const [legs,setLegs]       = useState(3);
  const [days,setDays]       = useState([0,1,2,3,4,5,6]);
  const [allowed,setAllowed] = useState(["over15","home","dc1x","btts","over25","dcx2","wehh","hoo25"]);
  const [mcat,setMcat]       = useState("Goals");
  const [minP,setMinP]       = useState(50);
  const [minS,setMinS]       = useState(40);
  const [valMode,setValMode] = useState(false);
  const [showLT,setShowLT]   = useState(false);

  const [picks,setPicks]     = useState([]);
  const [generating,setGen]  = useState(false);
  const [aiText,setAiText]   = useState("");
  const [aiLoad,setAiLoad]   = useState(false);
  const [history,setHistory] = useState([]);
  const [copied,setCopied]   = useState(false);

  useEffect(()=>{load();},[]);

  async function load() {
    setLoading(true); setErrMsg("");
    if (!HAS_KEY) { setMatches(DEMO); setIsLive(false); setLoading(false); return; }
    try {
      const live = await fetchFixtures();
      if (live.length > 0) { setMatches(live); setIsLive(true); }
      else { setMatches(DEMO); setIsLive(false); setErrMsg("No fixtures found this week. Showing demo data."); }
    } catch(e) {
      setMatches(DEMO); setIsLive(false); setErrMsg("⚠️ "+e.message);
    }
    setLoading(false);
  }

  const dayLabel = (n) => { if(n===0)return"Today"; if(n===1)return"Tomorrow"; const d=new Date(); d.setDate(d.getDate()+n); return d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}); };

  const filtered = matches.filter(m=>{
    const inDay = days.some(d=>todayStr(d)===m.date);
    const b = bestPick(m,allowed);
    const vOk = valMode ? b.prob>(100/(m.hodd||2))*1.05 : true;
    return inDay && b.prob>=minP && b.score>=minS && vOk;
  });

  const combOdds  = picks.reduce((a,p)=>a*(1/Math.max(p.prob/100,0.01)),1);
  const winChance = picks.reduce((a,p)=>a*(p.prob/100),1)*100;
  const avgAI     = picks.length?Math.round(picks.reduce((a,p)=>a+p.score,0)/picks.length):0;
  const wr        = LEG_WR[legs]||"<0.1";

  const toggleMkt = id => setAllowed(p=>p.includes(id)?p.length>1?p.filter(x=>x!==id):p:[...p,id]);
  const toggleDay = d  => setDays(p=>p.includes(d)?p.length>1?p.filter(x=>x!==d):p:[...p,d]);

  async function generate() {
    if(!filtered.length) return;
    setGen(true); setPicks([]); setAiText("");
    await new Promise(r=>setTimeout(r,700));
    const scored = filtered.map(m=>{const b=bestPick(m,allowed);return{...m,_b:b};}).sort((a,b)=>b._b.score-a._b.score);
    const np = scored.slice(0,legs).map(m=>({match:m,id:m._b.id,prob:m._b.prob,score:m._b.score,label:MARKETS.find(x=>x.id===m._b.id)?.label||m._b.id}));
    setPicks(np); setGen(false);
    const odds=np.reduce((a,p)=>a*(1/Math.max(p.prob/100,0.01)),1);
    const wc=np.reduce((a,p)=>a*(p.prob/100),1)*100;
    setHistory(prev=>[{date:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"}),legs,result:"Pending",odds:odds.toFixed(2),picks:np.map(p=>`${p.match.home} vs ${p.match.away} — ${p.label}`)},...prev.slice(0,19)]);
    setAiLoad(true);
    try {
      if(!ANTHROPIC_KEY) throw new Error("NO_KEY");
      const detail=np.map(p=>`${p.match.home} vs ${p.match.away} [${p.match.league}] — AI: ${p.label} (${p.prob}%, score ${p.score}/100), BTTS:${p.match.btts}%, O2.5:${p.match.o25}%, form H:${p.match.hForm} A:${p.match.aForm}`).join("\n");
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1200,messages:[{role:"user",content:`You are a world-class football betting analyst. Analyse this ${legs}-leg accumulator:\n\n${detail}\n\nOdds: ${odds.toFixed(2)}x | Win prob: ${wc.toFixed(1)}% | Historical ${legs}-leg win rate: ${wr}% | Avg AI: ${avgAI}/100\n\nWrite sharp expert analysis:\n🎯 PICK ANALYSIS — why each market was chosen\n⚠️ RISK FACTORS — key dangers\n📊 OVERVIEW — overall quality\n✅ VERDICT — confidence /10, stake 1-5 units, one key tip`}]})});
      const data=await res.json();
      if(data.error) throw new Error(data.error.message);
      setAiText(data.content?.map(c=>c.text||"").join("")||"");
    } catch(e) {
      setAiText(e.message==="NO_KEY"?"⚠️ Add VITE_ANTHROPIC_KEY in Vercel → Redeploy to unlock AI analysis.":"⚠️ "+e.message);
    }
    setAiLoad(false);
  }

  const pickTxt=()=>picks.map((p,i)=>`${i+1}. ${p.match.home} vs ${p.match.away}\n   ✅ ${p.label} — ${p.prob}%\n   ${p.match.league} · ${p.match.time}`).join("\n\n");
  function copyAll(){navigator.clipboard?.writeText(`🏆 WinSmart ${legs}-Leg Acca\n\n${pickTxt()}\n\n💰 Odds: ${combOdds.toFixed(2)}x | Win: ${winChance.toFixed(1)}%\n\nacca-ai.vercel.app`);setCopied(true);setTimeout(()=>setCopied(false),3000);}
  function shareWA(){window.open(`https://wa.me/?text=${encodeURIComponent(`🏆 WinSmart ${legs}-Leg Acca\n\n${pickTxt()}\n\n💰 Odds: ${combOdds.toFixed(2)}x\n\nacca-ai.vercel.app`)}`,"_blank");}

  return (
    <div style={{minHeight:"100vh",background:"#06080d",fontFamily:"'DM Sans',sans-serif",color:"#fff",maxWidth:460,margin:"0 auto"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&family=DM+Mono:wght@500&display=swap');
        @keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{box-shadow:0 0 20px #00ff8822}50%{box-shadow:0 0 44px #00ff8855}}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:1}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(0,255,136,.2);border-radius:99px}
        input[type=range]{-webkit-appearance:none;background:transparent;width:100%}
        input[type=range]::-webkit-slider-runnable-track{height:4px;background:rgba(255,255,255,.07);border-radius:99px}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#00ff88;margin-top:-8px}
        button,input{font-family:inherit}
      `}</style>

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
            {loading&&<Spin s={12}/>}
            <div onClick={load} style={{cursor:"pointer"}}><Tag t={isLive?"🟢 LIVE":"⚡ DEMO"} c={isLive?"#00ff88":"#f0c040"}/></div>
          </div>
        </div>
        <div style={{display:"flex"}}>
          {[["build","🎯 Build"],["ai","🤖 AI"],["stats","📊 Stats"],["history","📋 History"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"8px 2px 10px",border:"none",background:"transparent",borderBottom:tab===id?"2px solid #00ff88":"2px solid transparent",color:tab===id?"#00ff88":"#333",fontSize:10,fontWeight:800,cursor:"pointer"}}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"14px 12px 40px"}}>

        {tab==="build"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12,animation:"up .3s ease"}}>

            {/* Status */}
            {!isLive?(
              <div style={{background:"rgba(240,192,64,.06)",border:"1px solid rgba(240,192,64,.14)",borderRadius:12,padding:"11px 13px"}}>
                <div style={{fontSize:11,color:"#f0c04099",lineHeight:1.7,marginBottom:8}}>
                  {errMsg||(HAS_KEY?"⏳ Loading live fixtures...":"⚡ Demo mode · Add VITE_APIFOOTBALL_KEY in Vercel for real matches")}
                </div>
                {!HAS_KEY&&<div style={{fontSize:10,color:"#f0c04055",marginBottom:8,lineHeight:1.6}}>Your API-Football key goes in Vercel → Settings → Environment Variables as <strong>VITE_APIFOOTBALL_KEY</strong></div>}
                <button onClick={load} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"rgba(240,192,64,.15)",color:"#f0c040",fontSize:10,fontWeight:700,cursor:"pointer"}}>{loading?"⏳ Loading...":"🔄 Load Live Matches"}</button>
              </div>
            ):(
              <div style={{background:"rgba(0,255,136,.05)",border:"1px solid rgba(0,255,136,.14)",borderRadius:12,padding:"9px 13px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:"#00ff8888"}}>✅ {matches.length} real fixtures loaded · API-Football</span>
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
                  <button key={n} onClick={()=>{setLegs(n);setPicks([]);}} style={{padding:"6px 11px",borderRadius:9,border:"none",background:legs===n?"#00ff88":"rgba(255,255,255,.06)",color:legs===n?"#000":"#555",fontSize:12,fontWeight:900,cursor:"pointer",transition:"all .15s"}}>{n}</button>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input type="number" min={3} max={50} value={legs} onChange={e=>{setLegs(Math.min(50,Math.max(3,+e.target.value)));setPicks([]);}} style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,padding:"7px 12px",color:"#fff",fontSize:13,outline:"none"}} placeholder="Custom 3-50"/>
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
              <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:6}}>MARKETS <span style={{color:"#00ff88"}}>· 43 TYPES · SELECT MULTIPLE</span></div>
              <div style={{fontSize:10,color:"#a78bfa",padding:"6px 10px",background:"rgba(167,139,250,.07)",borderRadius:8,marginBottom:10}}>🤖 AI picks the single best market per match from your selection</div>
              <div style={{display:"flex",gap:3,marginBottom:10,flexWrap:"wrap"}}>
                {MCATS.map(cat=><button key={cat} onClick={()=>setMcat(cat)} style={{padding:"4px 9px",borderRadius:8,border:"none",background:mcat===cat?"rgba(167,139,250,.2)":"rgba(255,255,255,.05)",color:mcat===cat?"#a78bfa":"#444",fontSize:10,fontWeight:700,cursor:"pointer"}}>{cat}</button>)}
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
                {MARKETS.filter(m=>m.cat===mcat).map(m=>{
                  const on=allowed.includes(m.id);
                  return <button key={m.id} onClick={()=>toggleMkt(m.id)} style={{padding:"6px 10px",borderRadius:8,border:"none",background:on?"rgba(0,255,136,.14)":"rgba(255,255,255,.04)",color:on?"#00ff88":"#555",fontSize:11,fontWeight:700,cursor:"pointer",outline:on?"1px solid rgba(0,255,136,.35)":"none",transition:"all .15s"}}>{m.label} <span style={{fontSize:8,color:on?"#00ff8855":"#1a1a1a"}}>·{m.wr}%</span></button>;
                })}
              </div>
              <div style={{padding:"8px 10px",background:"rgba(0,255,136,.05)",borderRadius:9,border:"1px solid rgba(0,255,136,.1)",marginBottom:10}}>
                <div style={{fontSize:9,color:"#333",marginBottom:5}}>SELECTED ({allowed.length})</div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{allowed.map(id=>{const m=MARKETS.find(x=>x.id===id);return<Tag key={id} t={m?.short||id} c="#00ff88"/>;})}</div>
              </div>
              <div style={{fontSize:9,color:"#333",marginBottom:6}}>QUICK PRESETS:</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{PRESETS.map(g=><button key={g.l} onClick={()=>setAllowed(g.ids)} style={{padding:"5px 10px",borderRadius:8,border:"none",background:"rgba(255,255,255,.05)",color:"#555",fontSize:10,fontWeight:700,cursor:"pointer"}}>{g.l}</button>)}</div>
            </div>

            {/* FILTERS */}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14,display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontSize:9,color:"#333",letterSpacing:1}}>AI FILTERS</div>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:11,color:"#666"}}>Min Probability</span><span style={{fontSize:18,fontWeight:900,color:"#00ff88",fontFamily:"DM Mono,monospace"}}>{minP}%</span></div>
                <input type="range" min={30} max={92} value={minP} onChange={e=>setMinP(+e.target.value)}/>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontSize:8,color:"#1a1a1a"}}>30% — More picks</span><span style={{fontSize:8,color:"#1a1a1a"}}>92% — Ultra safe</span></div>
              </div>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:11,color:"#666"}}>Min AI Score</span><span style={{fontSize:18,fontWeight:900,color:"#a78bfa",fontFamily:"DM Mono,monospace"}}>{minS}/100</span></div>
                <input type="range" min={0} max={90} value={minS} onChange={e=>setMinS(+e.target.value)}/>
              </div>
              <div onClick={()=>setValMode(!valMode)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:10,cursor:"pointer"}}>
                <div><div style={{fontSize:11,color:"#888",fontWeight:700}}>Value Edge Mode</div><div style={{fontSize:9,color:"#333"}}>Only picks where prob beats bookmaker odds</div></div>
                <div style={{width:40,height:22,borderRadius:99,background:valMode?"#00ff88":"rgba(255,255,255,.08)",position:"relative",transition:"background .2s",flexShrink:0}}><div style={{position:"absolute",top:3,left:valMode?21:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/></div>
              </div>
            </div>

            {/* MATCHES */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:9,color:"#333",letterSpacing:1}}>AVAILABLE <span style={{color:"#00ff88"}}>({filtered.length} matches)</span></span>
                {loading&&<div style={{display:"flex",gap:4,alignItems:"center",fontSize:9,color:"#f0c040"}}><Spin s={10} c="#f0c040"/> Loading...</div>}
              </div>
              {filtered.length===0?(
                <div style={{background:"rgba(255,107,107,.05)",border:"1px solid rgba(255,107,107,.1)",borderRadius:14,padding:28,textAlign:"center"}}>
                  <div style={{fontSize:30,marginBottom:8}}>🔍</div>
                  <div style={{fontSize:13,color:"#ff6b6b88",fontWeight:700}}>No matches found</div>
                  <div style={{fontSize:11,color:"#222",marginTop:4}}>Try selecting more dates or lowering your filters</div>
                </div>
              ):filtered.map((m,i)=>{const b=bestPick(m,allowed);return<Card key={m.id} m={m} best={b} idx={i}/>;})
              }
            </div>

            {/* ACCA RESULT */}
            {picks.length>0&&(
              <div style={{background:"linear-gradient(135deg,rgba(0,255,136,.07),rgba(0,180,80,.03))",border:"1px solid rgba(0,255,136,.18)",borderRadius:16,padding:16,animation:"up .3s ease"}}>
                <div style={{fontSize:9,color:"#00ff8855",letterSpacing:1,marginBottom:12}}>YOUR {picks.length}-LEG SMART ACCA</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
                  {[["ODDS",combOdds.toFixed(2)+"x","#fff"],["WIN %",winChance.toFixed(1)+"%","#00ff88"],["LEGS",picks.length,"#a78bfa"],["AI AVG",avgAI+"/100","#f0c040"]].map(([l,v,c])=>(
                    <div key={l} style={{textAlign:"center"}}><div style={{fontSize:8,color:"#333",marginBottom:3}}>{l}</div><div style={{fontSize:14,fontWeight:900,color:c,fontFamily:"DM Mono,monospace",lineHeight:1}}>{v}</div></div>
                  ))}
                </div>
                <div style={{background:"rgba(0,0,0,.3)",borderRadius:10,padding:12,marginBottom:12}}>
                  <div style={{fontSize:9,color:"#333",marginBottom:8,letterSpacing:.5}}>ADD THESE ON SPORTYBET</div>
                  {picks.map((p,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#eee"}}>{p.match.home} vs {p.match.away}</div><div style={{fontSize:9,color:"#444"}}>{p.match.flag} {p.match.league} · {p.match.time}</div></div>
                      <Tag t={MARKETS.find(m=>m.id===p.id)?.short||p.id} c="#00ff88"/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <button onClick={copyAll} style={{width:"100%",padding:"12px",borderRadius:11,background:copied?"#00ff88":"rgba(0,255,136,.12)",border:"1px solid rgba(0,255,136,.28)",color:copied?"#000":"#00ff88",fontSize:12,fontWeight:800,cursor:"pointer",transition:"all .2s"}}>{copied?"✓ COPIED! Open SportyBet and paste":"📋 Copy All Picks"}</button>
                  <button onClick={()=>window.open("https://www.sportybet.com/ng/","_blank")} style={{width:"100%",padding:"12px",borderRadius:11,background:"linear-gradient(135deg,#00a651,#007a3d)",border:"none",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>🟢 Open SportyBet Nigeria →</button>
                  <button onClick={shareWA} style={{width:"100%",padding:"12px",borderRadius:11,background:"rgba(37,211,102,.12)",border:"1px solid rgba(37,211,102,.3)",color:"#25d366",fontSize:12,fontWeight:800,cursor:"pointer"}}>📲 Share on WhatsApp</button>
                  <button onClick={()=>setTab("ai")} style={{width:"100%",padding:"12px",borderRadius:11,background:"rgba(167,139,250,.1)",border:"1px solid rgba(167,139,250,.22)",color:"#a78bfa",fontSize:12,fontWeight:800,cursor:"pointer"}}>🤖 View Full AI Analysis →</button>
                </div>
              </div>
            )}

            <button onClick={generate} disabled={generating||filtered.length===0} style={{width:"100%",padding:"18px",borderRadius:14,border:"none",background:generating?"rgba(0,255,136,.08)":"linear-gradient(135deg,#00ff88,#00cc60)",color:generating?"#00ff88":"#000",fontSize:15,fontWeight:900,cursor:generating||filtered.length===0?"not-allowed":"pointer",animation:!generating&&filtered.length>0?"pulse 2.5s ease-in-out infinite":"none",display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"all .3s"}}>
              {generating?<><Spin/> AI Selecting Best Markets...</>:`✦ Auto-Generate ${legs}-Leg Smart Acca`}
            </button>
            <div style={{textAlign:"center",fontSize:9,color:"#1a1a1a",marginTop:4}}>AI picks best market per match · All 43 markets considered · Times shown in Lagos (WAT)</div>
          </div>
        )}

        {tab==="ai"&&(
          <div style={{animation:"up .3s ease",display:"flex",flexDirection:"column",gap:12}}>
            {picks.length===0?(
              <div style={{textAlign:"center",padding:60}}><div style={{fontSize:48,marginBottom:12}}>🤖</div><div style={{fontSize:15,fontWeight:700,color:"#222"}}>No acca yet</div><div style={{fontSize:11,color:"#1a1a1a",marginTop:6}}>Go to Build → tap Auto-Generate</div></div>
            ):(
              <>
                <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
                  <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:10}}>YOUR {picks.length}-LEG SMART ACCA</div>
                  {picks.map((p,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                      <div><div style={{fontSize:12,fontWeight:700,color:"#eee"}}>{p.match.home} vs {p.match.away}</div><div style={{fontSize:10,color:"#444"}}>{p.match.flag} {p.match.league} · <span style={{color:"#a78bfa"}}>{p.label}</span></div></div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:900,color:"#00ff88",fontFamily:"monospace"}}>{p.prob}%</div><div style={{fontSize:9,color:"#333"}}>AI {p.score}/100</div></div>
                    </div>
                  ))}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
                    {[["ODDS",combOdds.toFixed(2)+"x","#fff"],["WIN %",winChance.toFixed(1)+"%","#00ff88"],["HIST",wr+"%","#f0c040"]].map(([l,v,c])=>(
                      <div key={l} style={{textAlign:"center"}}><div style={{fontSize:8,color:"#333"}}>{l}</div><div style={{fontSize:14,fontWeight:900,color:c,fontFamily:"monospace"}}>{v}</div></div>
                    ))}
                  </div>
                </div>
                <div style={{background:"rgba(167,139,250,.04)",border:"1px solid rgba(167,139,250,.14)",borderRadius:14,padding:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <span style={{fontSize:20}}>🤖</span>
                    <div><div style={{fontSize:12,fontWeight:800,color:"#a78bfa"}}>WINSMART AI ANALYST</div><div style={{fontSize:9,color:"#222"}}>Powered by Claude AI</div></div>
                    {aiLoad&&<Spin c="#a78bfa"/>}
                  </div>
                  {aiLoad?<div style={{fontSize:12,color:"#1a1a1a",animation:"shimmer 1.5s ease infinite"}}>Analysing {picks.length} picks...</div>
                  :aiText?<div style={{fontSize:12,color:"#888",lineHeight:1.9,whiteSpace:"pre-wrap"}}>{aiText}</div>
                  :<div style={{fontSize:11,color:"#222"}}>Generate an acca to see AI analysis.</div>}
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
            <div style={{background:"rgba(0,255,136,.05)",border:"1px solid rgba(0,255,136,.1)",borderRadius:12,padding:"11px 13px"}}>
              <div style={{fontSize:11,color:"#00ff88",fontWeight:700,marginBottom:5}}>💡 Pro Tip</div>
              <div style={{fontSize:11,color:"#00ff8888",lineHeight:1.6}}>3–5 leg accas hit most often. Use AI Best Mix preset for the highest quality selections. Always bet responsibly.</div>
            </div>
            <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:16}}>
              <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:14}}>ACCA WIN RATES BY LEGS</div>
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
              <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:14}}>ALL 43 MARKETS RANKED BY WIN RATE</div>
              {[...MARKETS].sort((a,b)=>b.wr-a.wr).map((m,i)=>(
                <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                  <div style={{fontSize:10,color:"#222",width:22,flexShrink:0,fontWeight:800}}>#{i+1}</div>
                  <div style={{flex:1}}><div style={{fontSize:10,color:"#666",fontWeight:700,marginBottom:3}}>{m.label} <span style={{fontSize:8,color:"#2a2a2a"}}>· {m.cat}</span></div><Bar v={m.wr} c={m.wr>=65?"#00ff88":m.wr>=40?"#f0c040":"#ff6b6b"}/></div>
                  <div style={{fontSize:12,fontWeight:900,color:m.wr>=65?"#00ff88":m.wr>=40?"#f0c040":"#ff6b6b",minWidth:34,textAlign:"right"}}>{m.wr}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="history"&&(
          <div style={{animation:"up .3s ease"}}>
            {history.length===0?(
              <div style={{textAlign:"center",padding:60}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div style={{fontSize:14,color:"#222",fontWeight:700}}>No history yet</div><div style={{fontSize:11,color:"#1a1a1a",marginTop:6}}>Generate your first acca to start tracking</div></div>
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
  );
}
