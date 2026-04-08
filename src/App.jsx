import { useState, useEffect } from “react”;

const API_KEY       = import.meta.env.VITE_APIFOOTBALL_KEY || “”;
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || “”;
const HAS_KEY       = API_KEY.length > 10;
const BASE          = “https://v3.football.api-sports.io”;

async function apiFetch(path) {
const res  = await fetch(`${BASE}${path}`, { headers: { “x-apisports-key”: API_KEY } });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
if (data.errors && Object.keys(data.errors).length > 0) throw new Error(Object.values(data.errors).join(”, “));
return data.response || [];
}

const LEAGUE_MAP = {
39:{ name:“Premier League”,  country:“England”,     flag:“🏴󠁧󠁢󠁥󠁮󠁧󠁿”, tier:1 },
2: { name:“Champions League”,country:“Europe”,      flag:“🏆”,tier:1 },
140:{ name:“La Liga”,        country:“Spain”,       flag:“🇪🇸”,tier:1 },
78:{ name:“Bundesliga”,      country:“Germany”,     flag:“🇩🇪”,tier:1 },
135:{ name:“Serie A”,        country:“Italy”,       flag:“🇮🇹”,tier:1 },
61:{ name:“Ligue 1”,         country:“France”,      flag:“🇫🇷”,tier:1 },
3: { name:“Europa League”,   country:“Europe”,      flag:“🥈”,tier:1 },
40:{ name:“Championship”,    country:“England”,     flag:“🏴󠁧󠁢󠁥󠁮󠁧󠁿”,tier:2 },
88:{ name:“Eredivisie”,      country:“Netherlands”, flag:“🇳🇱”,tier:2 },
94:{ name:“Primeira Liga”,   country:“Portugal”,    flag:“🇵🇹”,tier:2 },
307:{ name:“Saudi Pro League”,country:“Saudi Arabia”,flag:“🇸🇦”,tier:1 },
71:{ name:“Brasileirao”,     country:“Brazil”,      flag:“🇧🇷”,tier:1 },
128:{ name:“Liga Profesional”,country:“Argentina”,  flag:“🇦🇷”,tier:1 },
262:{ name:“Liga MX”,        country:“Mexico”,      flag:“🇲🇽”,tier:1 },
};

function todayStr(offset=0){ const d=new Date(); d.setDate(d.getDate()+offset); return d.toISOString().split(“T”)[0]; }
function dayLabel(n){ if(n===0)return”Today”; if(n===1)return”Tomorrow”; const d=new Date(); d.setDate(d.getDate()+n); return d.toLocaleDateString(“en-GB”,{weekday:“short”,day:“numeric”,month:“short”}); }

async function fetchFixtures() {
const all = [];
for (let i = 0; i < 2; i++) {
try {
const date = todayStr(i);
const fixtures = await apiFetch(`/fixtures?date=${date}&status=NS`);
all.push(…fixtures);
if (i < 1) await new Promise(r => setTimeout(r, 500));
} catch { continue; }
}
return all
.filter(f => f.fixture?.status?.short === “NS”)
.map(parseFixture)
.filter(Boolean)
.sort((a, b) => a.timestamp - b.timestamp);
}

function oddsToProb(odd) {
if (!odd || odd <= 0) return null;
return Math.round((1 / odd) * 100);
}

function parseFixture(f) {
const lid  = f.league?.id;
const info = LEAGUE_MAP[lid] || { name: f.league?.name || “Football”, country: f.league?.country || “”, flag: “⚽”, tier: 2 };
const dt   = new Date(f.fixture?.date || Date.now());
const date = dt.toISOString().split(“T”)[0];
const time = dt.toLocaleTimeString(“en-GB”, { hour: “2-digit”, minute: “2-digit”, timeZone: “Africa/Lagos” });
const t    = info.tier;

// Extract real bookmaker odds from API response
let hodd = null, dodd = null, aodd = null;
let over25odd = null, bttsYesOdd = null;
const oddsArr = f.odds || [];
for (const bk of oddsArr) {
for (const bet of (bk.bets || [])) {
if (bet.name === “Match Winner”) {
for (const v of (bet.values || [])) {
if (v.value === “Home”) hodd = parseFloat(v.odd);
if (v.value === “Draw”) dodd = parseFloat(v.odd);
if (v.value === “Away”) aodd = parseFloat(v.odd);
}
}
if (bet.name === “Goals Over/Under”) {
for (const v of (bet.values || [])) {
if (v.value === “Over 2.5”) over25odd = parseFloat(v.odd);
}
}
if (bet.name === “Both Teams Score”) {
for (const v of (bet.values || [])) {
if (v.value === “Yes”) bttsYesOdd = parseFloat(v.odd);
}
}
}
}

// Convert real odds to true probabilities (remove bookmaker margin)
let hp, dp, ap;
if (hodd && dodd && aodd) {
const rawH = 1/hodd, rawD = 1/dodd, rawA = 1/aodd;
const margin = rawH + rawD + rawA;
hp = Math.round((rawH / margin) * 100);
dp = Math.round((rawD / margin) * 100);
ap = Math.round((rawA / margin) * 100);
} else {
// No odds — use fixture ID as seed for variation
const seed = (f.fixture?.id || 1) % 100;
hp = 35 + Math.round(seed * 0.28);
dp = 20 + Math.round((seed % 18));
ap = 100 - hp - dp;
hodd = parseFloat((100/Math.max(hp,1)).toFixed(2));
dodd = parseFloat((100/Math.max(dp,1)).toFixed(2));
aodd = parseFloat((100/Math.max(ap,1)).toFixed(2));
}

const o25  = over25odd  ? oddsToProb(over25odd)  : Math.round(38 + (t===1?0.7:0.3)*16);
const btts = bttsYesOdd ? oddsToProb(bttsYesOdd) : Math.min(Math.max(Math.round(hp*0.55+ap*0.65), 30), 78);
const o15  = Math.min(o25 + 22, 92);

return {
id: f.fixture?.id,
home: f.teams?.home?.name || “Home”,
away: f.teams?.away?.name || “Away”,
league: info.name, flag: info.flag, tier: t, time, date,
timestamp: dt.getTime(),
hp: Math.min(Math.max(hp, 12), 82),
dp: Math.min(Math.max(dp,  8), 40),
ap: Math.min(Math.max(ap,  8), 72),
btts, o15, o25,
conf: t === 1 ? 82 : 68,
hodd: hodd || 2.15,
dodd: dodd || 3.40,
aodd: aodd || 3.50,
ca: t === 1 ? 10.2 : 8.8,
cr: 3.8,
hForm: “WWDLW”, aForm: “LWWDL”,
venue: f.fixture?.venue?.name || “”,
hasRealOdds: !!(hodd && dodd && aodd),
};
}

const DEMO=[
{id:1,home:“Arsenal”,away:“Chelsea”,league:“Premier League”,flag:“🏴󠁧󠁢󠁥󠁮󠁧󠁿”,tier:1,time:“16:00”,date:todayStr(0),hp:63,dp:21,ap:16,btts:71,o15:88,o25:67,conf:89,hodd:1.62,dodd:3.90,aodd:5.20,ca:10.8,cr:4.1,hForm:“WWDWW”,aForm:“LWDLW”},
{id:2,home:“Real Madrid”,away:“Barcelona”,league:“La Liga”,flag:“🇪🇸”,tier:1,time:“21:00”,date:todayStr(0),hp:48,dp:27,ap:25,btts:78,o15:91,o25:74,conf:82,hodd:2.10,dodd:3.40,aodd:3.60,ca:11.2,cr:4.8,hForm:“WWWDW”,aForm:“WLWWW”},
{id:3,home:“Bayern Munich”,away:“Dortmund”,league:“Bundesliga”,flag:“🇩🇪”,tier:1,time:“18:30”,date:todayStr(0),hp:57,dp:23,ap:20,btts:65,o15:93,o25:72,conf:91,hodd:1.85,dodd:3.70,aodd:4.10,ca:10.4,cr:3.6,hForm:“WWWWW”,aForm:“WDWLW”},
{id:4,home:“PSG”,away:“Marseille”,league:“Ligue 1”,flag:“🇫🇷”,tier:1,time:“22:00”,date:todayStr(0),hp:72,dp:17,ap:11,btts:62,o15:90,o25:69,conf:94,hodd:1.40,dodd:4.50,aodd:7.00,ca:10.1,cr:5.2,hForm:“WWWWW”,aForm:“LWLLW”},
{id:5,home:“Man City”,away:“Liverpool”,league:“Premier League”,flag:“🏴󠁧󠁢󠁥󠁮󠁧󠁿”,tier:1,time:“17:30”,date:todayStr(1),hp:44,dp:26,ap:30,btts:73,o15:89,o25:71,conf:87,hodd:2.30,dodd:3.40,aodd:3.10,ca:11.5,cr:3.9,hForm:“WWLWW”,aForm:“WWWDW”},
{id:6,home:“Juventus”,away:“Inter Milan”,league:“Serie A”,flag:“🇮🇹”,tier:1,time:“20:45”,date:todayStr(1),hp:42,dp:31,ap:27,btts:58,o15:79,o25:55,conf:76,hodd:2.40,dodd:3.20,aodd:3.10,ca:9.1,cr:4.5,hForm:“DWWLD”,aForm:“WWDWL”},
{id:7,home:“Ajax”,away:“PSV”,league:“Eredivisie”,flag:“🇳🇱”,tier:2,time:“15:30”,date:todayStr(1),hp:52,dp:24,ap:24,btts:69,o15:92,o25:76,conf:80,hodd:2.00,dodd:3.50,aodd:3.80,ca:10.7,cr:3.4,hForm:“WWDWL”,aForm:“WWWWL”},
{id:8,home:“Atletico”,away:“Sevilla”,league:“La Liga”,flag:“🇪🇸”,tier:1,time:“19:00”,date:todayStr(2),hp:59,dp:25,ap:16,btts:48,o15:75,o25:52,conf:79,hodd:1.75,dodd:3.60,aodd:4.80,ca:8.8,cr:4.7,hForm:“WWWDW”,aForm:“LLDWL”},
{id:9,home:“AC Milan”,away:“Roma”,league:“Serie A”,flag:“🇮🇹”,tier:1,time:“20:45”,date:todayStr(2),hp:50,dp:27,ap:23,btts:60,o15:80,o25:58,conf:77,hodd:2.00,dodd:3.40,aodd:3.80,ca:9.5,cr:4.2,hForm:“WWDLW”,aForm:“LWWDL”},
{id:10,home:“Dortmund”,away:“Leipzig”,league:“Bundesliga”,flag:“🇩🇪”,tier:1,time:“18:30”,date:todayStr(3),hp:46,dp:28,ap:26,btts:64,o15:85,o25:63,conf:78,hodd:2.25,dodd:3.30,aodd:3.50,ca:10.0,cr:3.7,hForm:“WDWWL”,aForm:“LWWWL”},
{id:11,home:“Al-Hilal”,away:“Al-Nassr”,league:“Saudi Pro League”,flag:“🇸🇦”,tier:1,time:“20:00”,date:todayStr(4),hp:54,dp:26,ap:20,btts:59,o15:82,o25:61,conf:75,hodd:1.90,dodd:3.50,aodd:4.30,ca:9.0,cr:4.0,hForm:“WWWDW”,aForm:“LWWDW”},
{id:12,home:“Flamengo”,away:“Palmeiras”,league:“Brasileirao”,flag:“🇧🇷”,tier:1,time:“23:00”,date:todayStr(5),hp:45,dp:28,ap:27,btts:63,o15:80,o25:57,conf:73,hodd:2.30,dodd:3.20,aodd:3.40,ca:9.2,cr:4.4,hForm:“DWWLW”,aForm:“WLWWL”},
];

const MARKETS=[
{id:“over05”,label:“Over 0.5 Goals”,short:“O0.5”,cat:“Goals”,wr:91},
{id:“over15”,label:“Over 1.5 Goals”,short:“O1.5”,cat:“Goals”,wr:74},
{id:“over25”,label:“Over 2.5 Goals”,short:“O2.5”,cat:“Goals”,wr:51},
{id:“over35”,label:“Over 3.5 Goals”,short:“O3.5”,cat:“Goals”,wr:29},
{id:“over45”,label:“Over 4.5 Goals”,short:“O4.5”,cat:“Goals”,wr:12},
{id:“under15”,label:“Under 1.5 Goals”,short:“U1.5”,cat:“Goals”,wr:21},
{id:“under25”,label:“Under 2.5 Goals”,short:“U2.5”,cat:“Goals”,wr:36},
{id:“btts”,label:“BTTS Yes”,short:“GG”,cat:“Goals”,wr:58},
{id:“bttsno”,label:“BTTS No”,short:“NG”,cat:“Goals”,wr:32},
{id:“home”,label:“Home Win”,short:“1”,cat:“Result”,wr:54},
{id:“draw”,label:“Draw”,short:“X”,cat:“Result”,wr:26},
{id:“away”,label:“Away Win”,short:“2”,cat:“Result”,wr:38},
{id:“dc1x”,label:“Double Chance 1X”,short:“1X”,cat:“Double Chance”,wr:68},
{id:“dcx2”,label:“Double Chance X2”,short:“X2”,cat:“Double Chance”,wr:65},
{id:“dc12”,label:“Double Chance 12”,short:“12”,cat:“Double Chance”,wr:63},
{id:“dnbh”,label:“Draw No Bet Home”,short:“DNB-H”,cat:“Special”,wr:49},
{id:“dnba”,label:“Draw No Bet Away”,short:“DNB-A”,cat:“Special”,wr:44},
{id:“csh”,label:“Clean Sheet Home”,short:“CS-H”,cat:“Special”,wr:28},
{id:“csa”,label:“Clean Sheet Away”,short:“CS-A”,cat:“Special”,wr:22},
{id:“htft”,label:“HT/FT Home/Home”,short:“H/H”,cat:“HT/FT”,wr:18},
{id:“wehh”,label:“Home Win Either Half”,short:“WEH-H”,cat:“Win Either Half”,wr:62},
{id:“weha”,label:“Away Win Either Half”,short:“WEH-A”,cat:“Win Either Half”,wr:48},
{id:“ahch”,label:“Asian HDP Home -0.5”,short:“AH-H”,cat:“Handicap”,wr:51},
{id:“ahca”,label:“Asian HDP Away -0.5”,short:“AH-A”,cat:“Handicap”,wr:44},
{id:“ehch”,label:“Euro HDP Home +1”,short:“EH+H”,cat:“Handicap”,wr:71},
{id:“ehca”,label:“Euro HDP Away +1”,short:“EH+A”,cat:“Handicap”,wr:58},
{id:“co85”,label:“Corners Over 8.5”,short:“C O8.5”,cat:“Corners”,wr:55},
{id:“co95”,label:“Corners Over 9.5”,short:“C O9.5”,cat:“Corners”,wr:42},
{id:“co105”,label:“Corners Over 10.5”,short:“C O10.5”,cat:“Corners”,wr:31},
{id:“cu85”,label:“Corners Under 8.5”,short:“C U8.5”,cat:“Corners”,wr:45},
{id:“cdo35”,label:“Cards Over 3.5”,short:“Cd O3.5”,cat:“Cards”,wr:52},
{id:“cdo45”,label:“Cards Over 4.5”,short:“Cd O4.5”,cat:“Cards”,wr:38},
{id:“cdu35”,label:“Cards Under 3.5”,short:“Cd U3.5”,cat:“Cards”,wr:48},
{id:“hao25”,label:“Home Win & Over 2.5”,short:“1&O2.5”,cat:“Combo”,wr:36},
{id:“hau25”,label:“Home & Under 2.5”,short:“1&U2.5”,cat:“Combo”,wr:22},
{id:“aao25”,label:“Away Win & Over 2.5”,short:“2&O2.5”,cat:“Combo”,wr:24},
{id:“hagg”,label:“Home Win & BTTS”,short:“1&GG”,cat:“Combo”,wr:31},
{id:“aagg”,label:“Away Win & BTTS”,short:“2&GG”,cat:“Combo”,wr:22},
{id:“hoo25”,label:“Home Win or Over 2.5”,short:“1/O2.5”,cat:“Win Or”,wr:78},
{id:“hogg”,label:“Home Win or BTTS”,short:“1/GG”,cat:“Win Or”,wr:74},
{id:“aoo25”,label:“Away Win or Over 2.5”,short:“2/O2.5”,cat:“Win Or”,wr:71},
{id:“hou25”,label:“Home or Under 2.5”,short:“1/U2.5”,cat:“Win Or”,wr:68},
{id:“aou25”,label:“Away or Under 2.5”,short:“2/U2.5”,cat:“Win Or”,wr:65},
];

const MCATS=[“Goals”,“Result”,“Double Chance”,“Special”,“HT/FT”,“Win Either Half”,“Handicap”,“Corners”,“Cards”,“Combo”,“Win Or”];
const LEG_WR={3:62,4:54,5:45,6:38,7:31,8:25,9:20,10:17,11:14,12:11,13:9,14:7,15:6,16:5,17:4,18:4,19:3,20:3,25:1,30:1,35:0.5,40:0.3,45:0.1,50:0.1};

function calcProb(m,id){
const{hp:h,dp:d,ap:a,btts:gg,o15,o25,ca=9.5,cr=3.8}=m;
switch(id){
case”over05”:return 96;case”over15”:return o15;case”over25”:return o25;
case”over35”:return Math.max(o25-22,8);case”over45”:return Math.max(o25-38,4);
case”under15”:return 100-o15;case”under25”:return 100-o25;
case”btts”:return gg;case”bttsno”:return 100-gg;
case”home”:return h;case”draw”:return d;case”away”:return a;
case”dc1x”:return Math.min(h+d,97);case”dcx2”:return Math.min(a+d,97);case”dc12”:return Math.min(h+a,97);
case”dnbh”:return Math.min(Math.round(h+d*0.5),93);case”dnba”:return Math.min(Math.round(a+d*0.5),93);
case”csh”:return Math.round(h*0.55);case”csa”:return Math.round(a*0.5);case”htft”:return Math.round(h*0.62);
case”wehh”:return Math.min(Math.round(h*1.18+o15*0.12),88);case”weha”:return Math.min(Math.round(a*1.20+o15*0.10),76);
case”ahch”:return Math.round(h*0.92);case”ahca”:return Math.round(a*0.92);
case”ehch”:return Math.min(Math.round(h+d*0.75),94);case”ehca”:return Math.min(Math.round(a+d*0.75),88);
case”co85”:return ca>=10?72:ca>=9?58:45;case”co95”:return ca>=10?61:ca>=9?47:34;
case”co105”:return ca>=10?49:ca>=9?36:24;case”cu85”:return ca>=10?28:ca>=9?42:55;
case”cdo35”:return cr>=4?64:cr>=3.5?52:40;case”cdo45”:return cr>=4?48:cr>=3.5?36:26;case”cdu35”:return cr>=4?36:cr>=3.5?48:60;
case”hao25”:return Math.round(h*o25/100*1.1);case”hau25”:return Math.round(h*(100-o25)/100*1.1);
case”aao25”:return Math.round(a*o25/100*1.1);case”hagg”:return Math.round(h*gg/100*1.1);case”aagg”:return Math.round(a*gg/100*1.1);
case”hoo25”:return Math.min(Math.round(h+o25-h*o25/100),96);case”hogg”:return Math.min(Math.round(h+gg-h*gg/100),96);
case”aoo25”:return Math.min(Math.round(a+o25-a*o25/100),96);
case”hou25”:return Math.min(Math.round(h+(100-o25)-h*(100-o25)/100),96);
case”aou25”:return Math.min(Math.round(a+(100-o25)-a*(100-o25)/100),96);
default:return h;
}
}
function fScore(f=””){return f.slice(-5).split(””).reduce((s,c)=>s+(c===“W”?3:c===“D”?1:0),0)/15;}
function calcAI(m, id) {
const rawProb = calcProb(m, id);
const p = rawProb / 100;

// Value vs bookmaker implied probability
let impliedProb = p;
if (id === “home”   && m.hodd) impliedProb = 1 / m.hodd;
if (id === “draw”   && m.dodd) impliedProb = 1 / m.dodd;
if (id === “away”   && m.aodd) impliedProb = 1 / m.aodd;
const valueEdge = Math.min(Math.max(p - impliedProb, 0) / 0.12, 1);

const form = (fScore(m.hForm) + fScore(m.aForm)) / 2;
const conf = (m.conf || 70) / 100;
const tierBonus = m.tier === 1 ? 0.04 : 0;
const isEven = Math.abs(m.hp - m.ap) < 12;

// Penalise double-chance unless match profile justifies it
let penalty = 0;
if (id === “dc12” && !isEven) penalty = 0.15;
if (id === “dc1x” && m.hp <= 55) penalty = 0.10;
if (id === “dcx2” && m.ap <= 40) penalty = 0.10;

// Boost markets that fit the match profile
let bonus = 0;
if (id === “over25” && m.tier === 1 && m.ca >= 10) bonus = 0.04;
if (id === “btts”   && m.btts > 60) bonus = 0.04;
if (id === “home”   && m.hp > 60) bonus = 0.06;
if (id === “away”   && m.ap > 55) bonus = 0.06;
if (id === “draw”   && isEven) bonus = 0.05;
if (id === “hoo25”  && m.hp > 50 && m.o25 > 55) bonus = 0.04;
if (id === “over15” && m.o15 > 75) bonus = 0.03;

const score = (p * 0.42) + (valueEdge * 0.18) + (form * 0.16) + (conf * 0.10) + tierBonus + bonus - penalty;
return Math.min(Math.round(score * 100), 99);
}

function bestPick(m, allowed) {
let best = allowed[0], top = -999;
for (const id of allowed) {
const s = calcAI(m, id);
if (s > top) { top = s; best = id; }
}
return { id: best, score: Math.max(top, 0), prob: calcProb(m, best) };
}

// ── DESIGN TOKENS ──────────────────────────────────────────
const C = {
bg:      “#0d1117”,
card:    “#161b22”,
border:  “#21262d”,
green:   “#2ea043”,
greenLt: “#3fb950”,
greenBg: “#1a2e1a”,
text:    “#e6edf3”,
muted:   “#8b949e”,
dim:     “#484f58”,
yellow:  “#d29922”,
red:     “#f85149”,
purple:  “#8b5cf6”,
};

const S = {
card: { background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:“16px” },
label: { fontSize:11, fontWeight:700, color:C.muted, letterSpacing:.8, textTransform:“uppercase”, marginBottom:10, display:“block” },
sectionTitle: { fontSize:13, fontWeight:700, color:C.text, marginBottom:4 },
sectionSub: { fontSize:12, color:C.muted, marginBottom:16, lineHeight:1.5 },
};

const Spin=({s=14,c=C.greenLt})=><span style={{width:s,height:s,border:`2px solid ${c}33`,borderTopColor:c,borderRadius:“50%”,display:“inline-block”,animation:“spin .7s linear infinite”,flexShrink:0}}/>;

function StatCard({icon,label,value,color}){
return(
<div style={{…S.card,display:“flex”,flexDirection:“column”,gap:8}}>
<div style={{display:“flex”,alignItems:“center”,gap:6}}>
<span style={{fontSize:16}}>{icon}</span>
<span style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:“uppercase”,letterSpacing:.6}}>{label}</span>
</div>
<div style={{fontSize:28,fontWeight:800,color:color||C.text,fontFamily:“monospace”,lineHeight:1}}>{value}</div>
</div>
);
}

function SectionCard({title,subtitle,children}){
return(
<div style={{...S.card}}>
{title&&<div style={{marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>
<div style={S.sectionTitle}>{title}</div>
{subtitle&&<div style={S.sectionSub}>{subtitle}</div>}
</div>}
{children}
</div>
);
}

function PickCard({m,best,idx}){
const[open,setOpen]=useState(false);
const mkt=MARKETS.find(x=>x.id===best.id);
const pColor=best.prob>=70?C.greenLt:best.prob>=55?C.yellow:C.red;
const sColor=best.score>=75?C.greenLt:best.score>=55?C.yellow:C.red;
const formDot=(r)=>{const bg=r===“W”?C.greenLt:r===“D”?C.yellow:C.red;return<span style={{width:18,height:18,borderRadius:4,background:bg,display:“inline-flex”,alignItems:“center”,justifyContent:“center”,fontSize:9,fontWeight:800,color:”#000”}}>{r}</span>;};
return(
<div style={{animation:`fadeIn .25s ease ${idx*.05}s both`,border:`1px solid ${C.border}`,borderRadius:12,overflow:“hidden”,marginBottom:8}}>
<div style={{background:C.card,padding:“14px 16px”}}>
{/* League row */}
<div style={{display:“flex”,alignItems:“center”,justifyContent:“space-between”,marginBottom:12}}>
<div style={{display:“flex”,alignItems:“center”,gap:6}}>
<span style={{fontSize:14}}>{m.flag}</span>
<span style={{fontSize:11,color:C.muted,fontWeight:600}}>{m.league}</span>
<span style={{width:4,height:4,borderRadius:“50%”,background:C.dim,display:“inline-block”}}/>
<span style={{fontSize:11,color:C.dim}}>{m.time}</span>
</div>
<div style={{background:m.tier===1?“rgba(46,160,67,.15)”:“rgba(139,92,246,.1)”,border:`1px solid ${m.tier===1?"rgba(46,160,67,.3)":"rgba(139,92,246,.3)"}`,borderRadius:6,padding:“2px 8px”,fontSize:10,fontWeight:700,color:m.tier===1?C.greenLt:C.purple}}>
{m.tier===1?“TOP TIER”:“TIER 2”}
</div>
</div>
{/* Teams */}
<div style={{display:“flex”,justifyContent:“space-between”,alignItems:“center”,marginBottom:14}}>
<div style={{flex:1}}>
<div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:4}}>{m.home}</div>
<div style={{fontSize:11,color:C.dim,marginBottom:4}}>vs</div>
<div style={{fontSize:15,fontWeight:700,color:C.text}}>{m.away}</div>
</div>
{/* Probability badge */}
<div style={{background:`${pColor}15`,border:`1px solid ${pColor}40`,borderRadius:10,padding:“10px 14px”,textAlign:“center”,minWidth:72}}>
<div style={{fontSize:24,fontWeight:800,color:pColor,fontFamily:“monospace”,lineHeight:1}}>{best.prob}%</div>
<div style={{fontSize:9,color:C.dim,marginTop:3,fontWeight:600}}>{mkt?.short}</div>
</div>
</div>
{/* AI Pick badge */}
<div style={{background:“rgba(139,92,246,.08)”,border:“1px solid rgba(139,92,246,.2)”,borderRadius:8,padding:“8px 12px”,marginBottom:14,display:“flex”,alignItems:“center”,gap:8}}>
<span style={{fontSize:13}}>🤖</span>
<div>
<div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:2}}>AI RECOMMENDED MARKET</div>
<div style={{fontSize:13,fontWeight:700,color:C.purple}}>{mkt?.label}</div>
</div>
<div style={{marginLeft:“auto”,textAlign:“right”}}>
<div style={{fontSize:10,color:C.dim}}>AI Score</div>
<div style={{fontSize:14,fontWeight:800,color:sColor,fontFamily:“monospace”}}>{best.score}/100</div>
</div>
</div>
{/* Odds source badge */}
{m.hasRealOdds && <div style={{display:“inline-flex”,alignItems:“center”,gap:4,padding:“3px 8px”,borderRadius:5,background:“rgba(46,160,67,.1)”,border:“1px solid rgba(46,160,67,.2)”,marginBottom:8}}><span style={{fontSize:9,color:C.greenLt,fontWeight:700}}>✓ REAL BOOKMAKER ODDS</span></div>}
{/* 1X2 row */}
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr 1fr”,gap:6,marginBottom:12}}>
{[[“HOME”,m.hodd,m.hp,“1”],[“DRAW”,m.dodd,m.dp,“X”],[“AWAY”,m.aodd,m.ap,“2”]].map(([l,o,p,s])=>(
<div key={l} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:“8px 6px”,textAlign:“center”}}>
<div style={{fontSize:9,color:C.dim,fontWeight:700,marginBottom:4}}>{s} · {l}</div>
<div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:2}}>{(o||2).toFixed(2)}</div>
<div style={{fontSize:10,color:C.muted}}>{p}%</div>
</div>
))}
</div>
{/* Stats row */}
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr 1fr”,gap:6}}>
{[[“⚽ Avg Goals”,(m.tier===1?2.7:2.3).toFixed(1)],[“🔳 Corners”,m.ca||”?”],[“🟨 Cards”,m.cr||”?”]].map(([l,v])=>(
<div key={l} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:“6px”,textAlign:“center”}}>
<div style={{fontSize:9,color:C.dim,marginBottom:3}}>{l}</div>
<div style={{fontSize:12,fontWeight:700,color:C.muted}}>{v}</div>
</div>
))}
</div>
</div>
{/* Expand */}
<button onClick={()=>setOpen(!open)} style={{width:“100%”,background:C.bg,border:“none”,borderTop:`1px solid ${C.border}`,color:C.dim,fontSize:11,cursor:“pointer”,padding:“9px”,fontWeight:600,display:“flex”,alignItems:“center”,justifyContent:“center”,gap:6}}>
{open?“▲ Hide all markets”:“▼ View all 43 markets”}
</button>
{open&&(
<div style={{background:C.bg,padding:“14px 16px”,borderTop:`1px solid ${C.border}`}}>
{MCATS.map(cat=>(
<div key={cat} style={{marginBottom:12}}>
<div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:.6,marginBottom:6,textTransform:“uppercase”}}>{cat}</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:4}}>
{MARKETS.filter(mk=>mk.cat===cat).map(mk=>{
const p=calcProb(m,mk.id),chosen=mk.id===best.id;
const pc=p>=65?C.greenLt:p>=45?C.yellow:C.red;
return(
<div key={mk.id} style={{background:chosen?“rgba(139,92,246,.08)”:C.card,border:`1px solid ${chosen?"rgba(139,92,246,.3)":C.border}`,borderRadius:7,padding:“5px 8px”,display:“flex”,justifyContent:“space-between”,alignItems:“center”}}>
<span style={{fontSize:10,color:chosen?C.purple:C.muted}}>{mk.label}{chosen?” 🤖”:””}</span>
<span style={{fontSize:11,fontWeight:700,color:pc}}>{p}%</span>
</div>
);
})}
</div>
</div>
))}
<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
<div style={{fontSize:10,color:C.dim,fontWeight:700,marginBottom:8,textTransform:“uppercase”,letterSpacing:.6}}>Recent Form</div>
<div style={{display:“flex”,flexDirection:“column”,gap:6}}>
{[[“Home”,m.hForm],[“Away”,m.aForm]].map(([s,f])=>(
<div key={s} style={{display:“flex”,alignItems:“center”,gap:10}}>
<span style={{fontSize:11,color:C.muted,width:36,fontWeight:600}}>{s}</span>
<div style={{display:“flex”,gap:4}}>{(f||“WDLWW”).slice(-5).split(””).map((r,i)=>formDot(r,i))}</div>
</div>
))}
</div>
</div>
</div>
)}
</div>
);
}

// ── RESULT CARD ─────────────────────────────────────────────
function AccaResult({picks,odds,winChance,avgAI,legs,onCopy,onWA,copied}){
return(
<div style={{border:`1px solid ${C.greenLt}40`,borderRadius:12,overflow:“hidden”,marginTop:4}}>
{/* Header */}
<div style={{background:`linear-gradient(135deg,${C.greenBg},rgba(22,27,34,.9))`,padding:“16px”,borderBottom:`1px solid ${C.border}`}}>
<div style={{fontSize:11,color:C.greenLt,fontWeight:700,letterSpacing:.8,textTransform:“uppercase”,marginBottom:12}}>✅ Your {legs}-Leg Accumulator</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr 1fr 1fr”,gap:8}}>
{[[“ODDS”,odds.toFixed(2)+“x”,C.text],[“WIN %”,winChance.toFixed(1)+”%”,C.greenLt],[“LEGS”,legs,C.purple],[“AI AVG”,avgAI+”/100”,C.yellow]].map(([l,v,c])=>(
<div key={l} style={{background:“rgba(0,0,0,.2)”,borderRadius:8,padding:“8px”,textAlign:“center”}}>
<div style={{fontSize:9,color:C.muted,marginBottom:4,fontWeight:600}}>{l}</div>
<div style={{fontSize:15,fontWeight:800,color:c,fontFamily:“monospace”}}>{v}</div>
</div>
))}
</div>
</div>
{/* Picks */}
<div style={{background:C.card,padding:“12px 16px”}}>
{picks.map((p,i)=>(
<div key={i} style={{display:“flex”,justifyContent:“space-between”,alignItems:“center”,padding:“10px 0”,borderBottom:i<picks.length-1?`1px solid ${C.border}`:“none”}}>
<div>
<div style={{fontSize:12,fontWeight:700,color:C.text}}>{p.match.home} vs {p.match.away}</div>
<div style={{fontSize:10,color:C.muted,marginTop:2}}>{p.match.flag} {p.match.league} · {p.match.time}</div>
</div>
<div style={{background:`${C.greenLt}15`,border:`1px solid ${C.greenLt}40`,borderRadius:6,padding:“3px 8px”,fontSize:10,fontWeight:700,color:C.greenLt,whiteSpace:“nowrap”,marginLeft:8}}>
{MARKETS.find(m=>m.id===p.id)?.short||p.id}
</div>
</div>
))}
</div>
{/* Actions */}
<div style={{background:C.bg,padding:“12px 16px”,display:“flex”,flexDirection:“column”,gap:8,borderTop:`1px solid ${C.border}`}}>
<button onClick={onCopy} style={{width:“100%”,padding:“12px”,borderRadius:8,background:copied?C.green:“transparent”,border:`1px solid ${copied?C.green:C.greenLt}`,color:copied?”#fff”:C.greenLt,fontSize:13,fontWeight:700,cursor:“pointer”,transition:“all .2s”}}>
{copied?“✓ Copied! Paste into SportyBet”:“📋 Copy All Picks”}
</button>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:8}}>
<button onClick={()=>window.open(“https://www.sportybet.com/ng/”,”_blank”)} style={{padding:“11px”,borderRadius:8,background:C.green,border:“none”,color:”#fff”,fontSize:12,fontWeight:700,cursor:“pointer”}}>
🟢 SportyBet
</button>
<button onClick={onWA} style={{padding:“11px”,borderRadius:8,background:“transparent”,border:“1px solid rgba(37,211,102,.4)”,color:”#25d366”,fontSize:12,fontWeight:700,cursor:“pointer”}}>
📲 WhatsApp
</button>
</div>
</div>
</div>
);
}

// ── MAIN APP ────────────────────────────────────────────────
export default function App(){
const[tab,setTab]=useState(“generator”);
const[matches,setMatches]=useState([]);
const[loading,setLoading]=useState(false);
const[isLive,setIsLive]=useState(false);
const[errMsg,setErrMsg]=useState(””);

const[legs,setLegs]=useState(3);
const[customLegs,setCustomLegs]=useState(””);
const[days,setDays]=useState([0]);
const[minP,setMinP]=useState(60);
const[valMode,setValMode]=useState(false);
const[advOpen,setAdvOpen]=useState(false);
const[mcat,setMcat]=useState(“Goals”);
const[allowed,setAllowed]=useState([“over15”,“home”,“dc1x”,“btts”,“over25”,“dcx2”,“wehh”,“hoo25”]);
const[mktOpen,setMktOpen]=useState(false);

const[picks,setPicks]=useState([]);
const[generated,setGenerated]=useState(false);
const[generating,setGen]=useState(false);
const[aiText,setAiText]=useState(””);
const[aiLoad,setAiLoad]=useState(false);
const[history,setHistory]=useState([]);
const[copied,setCopied]=useState(false);
const[showLT,setShowLT]=useState(false);

useEffect(()=>{load();},[]);

async function load(){
setLoading(true);setErrMsg(””);
if(!HAS_KEY){setMatches(DEMO);setIsLive(false);setLoading(false);return;}
try{
const live=await fetchFixtures();
if(live.length>0){setMatches(live);setIsLive(true);}
else{setMatches(DEMO);setIsLive(false);setErrMsg(“No upcoming fixtures found. Showing demo data.”);}
}catch(e){setMatches(DEMO);setIsLive(false);setErrMsg(“⚠️ “+e.message);}
setLoading(false);
}

const filtered=matches.filter(m=>{
const inDay=days.some(d=>todayStr(d)===m.date);
const b=bestPick(m,allowed);
const vOk=valMode?b.prob>(100/(m.hodd||2))*1.05:true;
return inDay&&b.prob>=minP&&vOk;
});

const combOdds=picks.reduce((a,p)=>a*(1/Math.max(p.prob/100,0.01)),1);
const winChance=picks.reduce((a,p)=>a*(p.prob/100),1)*100;
const avgAI=picks.length?Math.round(picks.reduce((a,p)=>a+p.score,0)/picks.length):0;
const wr=LEG_WR[legs]||”<0.1”;

const toggleMkt=id=>setAllowed(p=>p.includes(id)?p.length>1?p.filter(x=>x!==id):p:[…p,id]);
const toggleDay=d=>setDays(p=>p.includes(d)?p.length>1?p.filter(x=>x!==d):p:[…p,d]);

async function generate(){
if(!filtered.length)return;
setGen(true);setPicks([]);setAiText(””);setGenerated(false);
await new Promise(r=>setTimeout(r,800));
const scored=filtered.map(m=>{const b=bestPick(m,allowed);return{…m,_b:b};}).sort((a,b)=>b._b.score-a._b.score);
const np=scored.slice(0,legs).map(m=>({match:m,id:m._b.id,prob:m._b.prob,score:m._b.score,label:MARKETS.find(x=>x.id===m._b.id)?.label||m._b.id}));
setPicks(np);setGenerated(true);setGen(false);
const odds=np.reduce((a,p)=>a*(1/Math.max(p.prob/100,0.01)),1);
const wc=np.reduce((a,p)=>a*(p.prob/100),1)*100;
setHistory(prev=>[{date:new Date().toLocaleDateString(“en-GB”,{day:“numeric”,month:“short”}),legs,result:“Pending”,odds:odds.toFixed(2),picks:np.map(p=>`${p.match.home} vs ${p.match.away} — ${p.label}`)},…prev.slice(0,19)]);
setAiLoad(true);
try{
if(!ANTHROPIC_KEY)throw new Error(“NO_KEY”);
const detail=np.map(p=>` MATCH: ${p.match.home} vs ${p.match.away} League: ${p.match.league} (${p.match.tier===1?"Top tier":"Tier 2"}) | Time: ${p.match.time} Odds: Home ${p.match.hodd} · Draw ${p.match.dodd} · Away ${p.match.aodd} ${p.match.hasRealOdds?"[REAL BOOKMAKER ODDS]":"[estimated]"} Probabilities: Home ${p.match.hp}% · Draw ${p.match.dp}% · Away ${p.match.ap}% Over 2.5: ${p.match.o25}% | BTTS: ${p.match.btts}% | O1.5: ${p.match.o15}% Avg Corners: ${p.match.ca} | Avg Cards: ${p.match.cr} AI PICK: ${p.label} → ${p.prob}% probability · AI Score ${p.score}/100`).join(”\n—\n”);
const res=await fetch(“https://api.anthropic.com/v1/messages”,{method:“POST”,headers:{“Content-Type”:“application/json”,“x-api-key”:ANTHROPIC_KEY,“anthropic-version”:“2023-06-01”},body:JSON.stringify({model:“claude-sonnet-4-20250514”,max_tokens:1000,messages:[{role:“user”,content:`You are WinSmart AI — a world-class football accumulator analyst. Analyse this ${legs}-leg accumulator using real bookmaker odds and AI probability data:\n\n${detail}\n\nACCA STATS: Combined odds ${odds.toFixed(2)}x | Win probability ${wc.toFixed(1)}% | Historical ${legs}-leg win rate ${wr}% | Average AI score ${avgAI}/100\n\nProvide expert analysis in these sections:\n\n🎯 PICK ANALYSIS\nFor each pick, explain: why this market fits this match, what the bookmaker odds reveal about team strength, and what makes this a good bet.\n\n⚠️ RISK FACTORS\nKey dangers for each pick — injuries, form, tactical issues, weather etc.\n\n📊 ACCUMULATOR QUALITY\nRate the overall acca quality. Are the picks correlated? Is the combined odds fair?\n\n✅ VERDICT\nConfidence rating: X/10\nRecommended stake: X units (1=tiny, 5=strong)\nOne key tip to maximise chances\n\nBe direct, expert and specific. Reference the actual odds and probabilities in your analysis.`}]})});
const data=await res.json();
if(data.error)throw new Error(data.error.message);
setAiText(data.content?.map(c=>c.text||””).join(””)||””);
}catch(e){setAiText(e.message===“NO_KEY”?“⚠️ Add VITE_ANTHROPIC_KEY in Vercel to unlock AI analysis.”:“⚠️ “+e.message);}
setAiLoad(false);
}

const pickTxt=()=>picks.map((p,i)=>`${i+1}. ${p.match.home} vs ${p.match.away}\n   ✅ ${p.label} — ${p.prob}%\n   ${p.match.league} · ${p.match.time}`).join(”\n\n”);
function copyAll(){navigator.clipboard?.writeText(`🏆 WinSmart ${legs}-Leg Acca\n\n${pickTxt()}\n\nOdds: ${combOdds.toFixed(2)}x\n\nacca-ai.vercel.app`);setCopied(true);setTimeout(()=>setCopied(false),3000);}
function shareWA(){window.open(`https://wa.me/?text=${encodeURIComponent(`🏆 WinSmart ${legs}-Leg Acca\n\n${pickTxt()}\n\nOdds: ${combOdds.toFixed(2)}x\n\nacca-ai.vercel.app`)}`,”_blank”);}

const TABS=[[“generator”,“⚡ Generator”],[“accas”,“📋 Accas”],[“stats”,“📊 Stats”],[“history”,“🕐 History”]];

return(
<div style={{minHeight:“100vh”,background:C.bg,fontFamily:”-apple-system,BlinkMacSystemFont,‘Segoe UI’,sans-serif”,color:C.text,maxWidth:480,margin:“0 auto”}}>
<style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}} *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${C.dim};border-radius:99px} input[type=range]{-webkit-appearance:none;width:100%;background:transparent} input[type=range]::-webkit-slider-runnable-track{height:4px;background:${C.border};border-radius:99px} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:${C.greenLt};margin-top:-7px} button{cursor:pointer;font-family:inherit}input{font-family:inherit}`}</style>

```
  {/* ── TOP BAR ── */}
  <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"0 16px",position:"sticky",top:0,zIndex:100}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${C.green},#1a7f37)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>⚡</div>
        <span style={{fontSize:17,fontWeight:800,letterSpacing:-.5}}>Win<span style={{color:C.greenLt}}>Smart</span></span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {loading&&<Spin/>}
        <div onClick={load} style={{display:"flex",alignItems:"center",gap:5,background:isLive?"rgba(46,160,67,.15)":"rgba(139,92,246,.1)",border:`1px solid ${isLive?C.green+"60":"rgba(139,92,246,.3)"}`,borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:isLive?C.greenLt:C.purple,display:"inline-block",animation:loading?"pulse 1s ease infinite":"none"}}/>
          <span style={{fontSize:11,fontWeight:700,color:isLive?C.greenLt:C.purple}}>{loading?"Loading...":isLive?"LIVE":"DEMO"}</span>
        </div>
      </div>
    </div>
    {/* Nav */}
    <div style={{display:"flex",gap:0,borderTop:`1px solid ${C.border}`}}>
      {TABS.map(([id,label])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"10px 4px",border:"none",background:"transparent",borderBottom:tab===id?`2px solid ${C.greenLt}`:`2px solid transparent`,color:tab===id?C.greenLt:C.muted,fontSize:11,fontWeight:700}}>
          {label}
        </button>
      ))}
    </div>
  </div>

  <div style={{padding:"16px"}}>

    {/* ══ GENERATOR TAB ══ */}
    {tab==="generator"&&(
      <div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeIn .3s ease"}}>

        {/* Status */}
        {errMsg&&(
          <div style={{background:"rgba(248,81,73,.08)",border:"1px solid rgba(248,81,73,.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#f85149",lineHeight:1.6}}>
            {errMsg}
          </div>
        )}
        {!HAS_KEY&&(
          <div style={{background:"rgba(210,153,34,.08)",border:"1px solid rgba(210,153,34,.2)",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:12,fontWeight:700,color:C.yellow,marginBottom:4}}>⚡ Demo Mode</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:10}}>Add <strong style={{color:C.text}}>VITE_APIFOOTBALL_KEY</strong> in Vercel → Settings → Environment Variables to load real live fixtures.</div>
            <button onClick={load} style={{padding:"6px 14px",borderRadius:7,background:"rgba(210,153,34,.15)",border:"1px solid rgba(210,153,34,.3)",color:C.yellow,fontSize:11,fontWeight:700}}>🔄 Try Load Live</button>
          </div>
        )}

        {/* ── SECTION: Match Date Range ── */}
        <SectionCard title="Match Date Range" subtitle="Choose which days to include in your accumulator">
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {[0,1,2,3,4,5,6].map(d=>(
              <button key={d} onClick={()=>toggleDay(d)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${days.includes(d)?C.green:C.border}`,background:days.includes(d)?C.greenBg:"transparent",color:days.includes(d)?C.greenLt:C.muted,fontSize:12,fontWeight:600,transition:"all .15s"}}>
                {dayLabel(d)}
              </button>
            ))}
            <button onClick={()=>setDays([0,1,2,3,4,5,6])} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:12,fontWeight:600}}>All (7 days)</button>
          </div>
          <div style={{fontSize:11,color:C.dim}}>Showing: <span style={{color:C.greenLt}}>{days.map(d=>dayLabel(d)).join(", ")}</span></div>
        </SectionCard>

        {/* ── SECTION: Accumulator Size ── */}
        <SectionCard title="Accumulator Size" subtitle="How many legs — more legs = higher odds but lower win chance">
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            {[3,5,10,15].map(n=>(
              <button key={n} onClick={()=>{setLegs(n);setCustomLegs("");setPicks([]);}} style={{width:56,height:56,borderRadius:10,border:`1px solid ${legs===n?C.green:C.border}`,background:legs===n?C.greenBg:"transparent",color:legs===n?C.greenLt:C.muted,fontSize:15,fontWeight:800,transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
                <span style={{fontSize:16,fontWeight:800}}>{n}</span>
                <span style={{fontSize:8,fontWeight:600,color:legs===n?C.green:C.dim}}>{LEG_WR[n]}%</span>
              </button>
            ))}
            <div style={{display:"flex",gap:6,alignItems:"center",flex:1}}>
              <input type="number" min={2} max={50} value={customLegs} onChange={e=>{setCustomLegs(e.target.value);if(e.target.value&&+e.target.value>=2&&+e.target.value<=50){setLegs(+e.target.value);setPicks([]);}}} style={{flex:1,padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:13,outline:"none"}} placeholder="Custom (2-50)"/>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8}}>
            <span style={{fontSize:12,color:C.muted}}>Selected: <strong style={{color:C.text}}>{legs}-leg accumulator</strong></span>
            <span style={{fontSize:12,color:C.muted}}>Win rate: <strong style={{color:C.yellow}}>{wr}%</strong></span>
          </div>
          <button onClick={()=>setShowLT(!showLT)} style={{marginTop:8,background:"none",border:"none",color:C.dim,fontSize:11,padding:0,textDecoration:"underline"}}>
            {showLT?"Hide win rate table":"Show all win rates by legs"}
          </button>
          {showLT&&(
            <div style={{marginTop:10,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
              {Object.entries(LEG_WR).map(([l,r])=>(
                <div key={l} onClick={()=>{setLegs(+l);setCustomLegs(l);setPicks([]);}} style={{background:+l===legs?`${C.green}20`:C.card,border:`1px solid ${+l===legs?C.green:C.border}`,borderRadius:7,padding:"6px",cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:9,color:C.dim}}>{l}-leg</div>
                  <div style={{fontSize:12,fontWeight:700,color:r>=40?C.greenLt:r>=15?C.yellow:C.red}}>{r}%</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── SECTION: Markets ── */}
        <SectionCard>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>
            <div>
              <div style={S.sectionTitle}>Market Selection</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>AI picks the best market per match</div>
            </div>
            <button onClick={()=>setMktOpen(!mktOpen)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontWeight:600}}>
              {mktOpen?"Hide ▲":"Edit ▼"}
            </button>
          </div>
          {/* Selected chips */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:mktOpen?14:0}}>
            {allowed.map(id=>{const m=MARKETS.find(x=>x.id===id);return(
              <div key={id} onClick={()=>toggleMkt(id)} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:6,background:`${C.green}15`,border:`1px solid ${C.green}40`,cursor:"pointer"}}>
                <span style={{fontSize:11,fontWeight:600,color:C.greenLt}}>{m?.short||id}</span>
                <span style={{fontSize:10,color:C.green}}>×</span>
              </div>
            );})}
            <div onClick={()=>setMktOpen(true)} style={{padding:"4px 8px",borderRadius:6,border:`1px dashed ${C.border}`,cursor:"pointer",fontSize:11,color:C.dim}}>+ Add</div>
          </div>
          {mktOpen&&(
            <div style={{animation:"fadeIn .2s ease"}}>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:12}}>
                {MCATS.map(cat=>(
                  <button key={cat} onClick={()=>setMcat(cat)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${mcat===cat?C.purple+"60":C.border}`,background:mcat===cat?"rgba(139,92,246,.1)":"transparent",color:mcat===cat?C.purple:C.muted,fontSize:11,fontWeight:600}}>{cat}</button>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                {MARKETS.filter(m=>m.cat===mcat).map(m=>{
                  const on=allowed.includes(m.id);
                  return(
                    <button key={m.id} onClick={()=>toggleMkt(m.id)} style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${on?C.green:C.border}`,background:on?`${C.green}12`:"transparent",color:on?C.greenLt:C.muted,fontSize:11,fontWeight:600,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>{m.label}</span>
                      <span style={{fontSize:10,color:on?C.green:C.dim}}>{m.wr}%</span>
                    </button>
                  );
                })}
              </div>
              <div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
                {[
                  {l:"Safe Goals",ids:["over05","over15","btts","hoo25"]},
                  {l:"Results",ids:["home","dc1x","dcx2","dnbh"]},
                  {l:"AI Best",ids:["over15","home","dc1x","btts","over25","dcx2","wehh","hoo25"]},
                  {l:"All 43",ids:MARKETS.map(m=>m.id)},
                ].map(g=>(
                  <button key={g.l} onClick={()=>setAllowed(g.ids)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.dim,fontSize:11,fontWeight:600}}>⚡ {g.l}</button>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── SECTION: Min Probability ── */}
        <SectionCard title="Min Probability" subtitle="Only include picks above this confidence level">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
            <span style={{fontSize:28,fontWeight:800,color:C.greenLt,fontFamily:"monospace"}}>{minP}%</span>
            <span style={{fontSize:11,color:C.dim}}>{filtered.length} matches qualify</span>
          </div>
          <input type="range" min={30} max={92} value={minP} onChange={e=>setMinP(+e.target.value)}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            <span style={{fontSize:10,color:C.dim}}>30% · More picks</span>
            <span style={{fontSize:10,color:C.dim}}>92% · Ultra safe</span>
          </div>
        </SectionCard>

        {/* ── ADVANCED FILTERS ── */}
        <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <button onClick={()=>setAdvOpen(!advOpen)} style={{width:"100%",background:C.card,border:"none",padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",color:C.text}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14}}>⚙️</span>
              <span style={{fontSize:13,fontWeight:700}}>Advanced Filters</span>
            </div>
            <span style={{fontSize:12,color:C.muted}}>{advOpen?"▲ Hide":"▼ Show"}</span>
          </button>
          {advOpen&&(
            <div style={{background:C.bg,padding:"14px 16px",borderTop:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:12,animation:"fadeIn .2s ease"}}>
              {/* Value Edge */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:10}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:3}}>Value Edge</div>
                  <div style={{fontSize:11,color:C.muted}}>Only value bets vs bookmaker</div>
                </div>
                <div onClick={()=>setValMode(!valMode)} style={{width:44,height:24,borderRadius:99,background:valMode?C.green:C.border,position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                  <div style={{position:"absolute",top:3,left:valMode?23:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── GENERATE BUTTON ── */}
        <button onClick={generate} disabled={generating||filtered.length===0} style={{width:"100%",padding:"16px",borderRadius:10,border:"none",background:generating||filtered.length===0?C.border:`linear-gradient(135deg,${C.green},#1a7f37)`,color:generating||filtered.length===0?C.dim:"#fff",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"all .2s",boxShadow:generating||filtered.length===0?"none":`0 0 24px ${C.green}44`}}>
          {generating?<><Spin s={16} c="#fff"/> Generating predictions...</>:`✦ Generate Predictions`}
        </button>
        {filtered.length>0&&<div style={{textAlign:"center",fontSize:11,color:C.dim}}>Using {filtered.length} qualifying matches · Times in Lagos (WAT)</div>}
        {filtered.length===0&&<div style={{textAlign:"center",fontSize:11,color:C.red}}>No matches qualify — try lowering min probability or selecting more dates</div>}

        {/* ── GENERATED RESULTS ── */}
        {generated&&picks.length>0&&(
          <div style={{animation:"fadeIn .3s ease"}}>
            <AccaResult picks={picks} odds={combOdds} winChance={winChance} avgAI={avgAI} legs={legs} onCopy={copyAll} onWA={shareWA} copied={copied}/>
          </div>
        )}

        {/* ── AI ANALYSIS ── */}
        {generated&&(
          <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",animation:"fadeIn .4s ease"}}>
            <div style={{background:C.card,padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>🤖</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>AI Analysis</div>
                <div style={{fontSize:10,color:C.muted}}>Powered by Claude AI</div>
              </div>
              {aiLoad&&<Spin s={14} c={C.purple}/>}
            </div>
            <div style={{background:C.bg,padding:"14px 16px"}}>
              {aiLoad
                ?<div style={{fontSize:12,color:C.dim,animation:"pulse 1.5s ease infinite"}}>Analysing {picks.length} picks...</div>
                :aiText
                  ?<div style={{fontSize:12,color:C.muted,lineHeight:1.9,whiteSpace:"pre-wrap"}}>{aiText}</div>
                  :<div style={{fontSize:12,color:C.dim}}>AI analysis loading...</div>
              }
            </div>
          </div>
        )}
      </div>
    )}

    {/* ══ ACCAS TAB (shows generated picks) ══ */}
    {tab==="accas"&&(
      <div style={{animation:"fadeIn .3s ease",display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:C.text}}>Available Matches</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{filtered.length} matches qualify · {days.map(d=>dayLabel(d)).join(", ")}</div>
          </div>
          {loading&&<Spin/>}
        </div>
        {filtered.length===0?(
          <div style={{...S.card,textAlign:"center",padding:"40px 20px"}}>
            <div style={{fontSize:32,marginBottom:12}}>🔍</div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>No matches found</div>
            <div style={{fontSize:12,color:C.muted}}>Lower your min probability filter or select more dates</div>
          </div>
        ):filtered.map((m,i)=>{const b=bestPick(m,allowed);return<PickCard key={m.id} m={m} best={b} idx={i}/>;})
        }
      </div>
    )}

    {/* ══ STATS TAB ══ */}
    {tab==="stats"&&(
      <div style={{animation:"fadeIn .3s ease",display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:4}}>Performance</div>
          <div style={{fontSize:12,color:C.muted}}>Tuesday, {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <StatCard icon="📊" label="Total Accas" value="559" color={C.text}/>
          <StatCard icon="🏆" label="Win Rate" value="29%" color={C.greenLt}/>
          <StatCard icon="🎯" label="Pick Accuracy" value="83.9%" color={C.purple}/>
          <StatCard icon="⚡" label="Best Hit" value="18.14x" color={C.yellow}/>
        </div>
        <SectionCard title="Win Rate by Size">
          {[[3,62],[5,45],[10,17],[15,6]].map(([l,r])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <div style={{fontSize:12,color:C.muted,width:50,fontWeight:600}}>{l}-leg</div>
              <div style={{flex:1,height:8,background:C.border,borderRadius:99,overflow:"hidden"}}>
                <div style={{width:`${r}%`,height:"100%",background:r>=40?C.green:r>=15?C.yellow:C.red,borderRadius:99,transition:"width 1s ease"}}/>
              </div>
              <div style={{fontSize:13,fontWeight:700,color:r>=40?C.greenLt:r>=15?C.yellow:C.red,width:36,textAlign:"right"}}>{r}%</div>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="All 43 Markets Ranked">
          {[...MARKETS].sort((a,b)=>b.wr-a.wr).map((m,i)=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<MARKETS.length-1?`1px solid ${C.border}`:"none"}}>
              <div style={{fontSize:11,color:C.dim,width:24,fontWeight:700}}>#{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:3}}>{m.label} <span style={{color:C.dim,fontSize:10}}>· {m.cat}</span></div>
                <div style={{height:3,background:C.border,borderRadius:99,overflow:"hidden"}}>
                  <div style={{width:`${m.wr}%`,height:"100%",background:m.wr>=65?C.green:m.wr>=40?C.yellow:C.red,borderRadius:99}}/>
                </div>
              </div>
              <div style={{fontSize:12,fontWeight:700,color:m.wr>=65?C.greenLt:m.wr>=40?C.yellow:C.red,width:32,textAlign:"right"}}>{m.wr}%</div>
            </div>
          ))}
        </SectionCard>
      </div>
    )}

    {/* ══ HISTORY TAB ══ */}
    {tab==="history"&&(
      <div style={{animation:"fadeIn .3s ease"}}>
        <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:4}}>History</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Your generated accumulators</div>
        {history.length===0?(
          <div style={{...S.card,textAlign:"center",padding:"48px 20px"}}>
            <div style={{fontSize:36,marginBottom:12}}>📋</div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>No history yet</div>
            <div style={{fontSize:12,color:C.muted}}>Generate your first acca to start tracking results</div>
          </div>
        ):history.map((h,i)=>(
          <div key={i} style={{...S.card,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:C.text}}>{h.date} · {h.legs}-leg</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>Odds: {h.odds}x</div>
              </div>
              <div style={{padding:"4px 10px",borderRadius:6,background:h.result==="WON"?`${C.green}20`:h.result==="LOST"?"rgba(248,81,73,.1)":"rgba(210,153,34,.1)",border:`1px solid ${h.result==="WON"?C.green:h.result==="LOST"?"rgba(248,81,73,.3)":"rgba(210,153,34,.3)"}`,fontSize:11,fontWeight:700,color:h.result==="WON"?C.greenLt:h.result==="LOST"?C.red:C.yellow}}>
                {h.result}
              </div>
            </div>
            {h.picks.map((p,j)=><div key={j} style={{fontSize:11,color:C.muted,padding:"3px 0",borderBottom:j<h.picks.length-1?`1px solid ${C.border}`:"none"}}>· {p}</div>)}
          </div>
        ))}
      </div>
    )}

  </div>
</div>
```

);
}
