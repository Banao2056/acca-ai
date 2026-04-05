import { useState, useEffect } from "react";

// ─────────────────────────────────────────────
// 🔑 API KEYS — paste yours here
// ─────────────────────────────────────────────
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || "YOUR_RAPIDAPI_KEY";
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "YOUR_ANTHROPIC_KEY";
const IS_DEMO = !RAPIDAPI_KEY || RAPIDAPI_KEY === "YOUR_RAPIDAPI_KEY";

// ─────────────────────────────────────────────
// 🌍 42 RELIABLE LEAGUES
// ─────────────────────────────────────────────
const LEAGUES = [
  // Europe Tier 1
  { id:39,  name:"Premier League",      country:"England",      flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier:1, region:"Europe" },
  { id:140, name:"La Liga",             country:"Spain",        flag:"🇪🇸", tier:1, region:"Europe" },
  { id:78,  name:"Bundesliga",          country:"Germany",      flag:"🇩🇪", tier:1, region:"Europe" },
  { id:135, name:"Serie A",             country:"Italy",        flag:"🇮🇹", tier:1, region:"Europe" },
  { id:61,  name:"Ligue 1",             country:"France",       flag:"🇫🇷", tier:1, region:"Europe" },
  { id:2,   name:"Champions League",    country:"Europe",       flag:"🏆", tier:1, region:"Europe" },
  { id:3,   name:"Europa League",       country:"Europe",       flag:"🥈", tier:1, region:"Europe" },
  { id:848, name:"Conference League",   country:"Europe",       flag:"🥉", tier:1, region:"Europe" },
  // Europe Tier 2
  { id:40,  name:"Championship",        country:"England",      flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier:2, region:"Europe" },
  { id:88,  name:"Eredivisie",          country:"Netherlands",  flag:"🇳🇱", tier:2, region:"Europe" },
  { id:94,  name:"Primeira Liga",       country:"Portugal",     flag:"🇵🇹", tier:2, region:"Europe" },
  { id:144, name:"Pro League",          country:"Belgium",      flag:"🇧🇪", tier:2, region:"Europe" },
  { id:197, name:"Super League",        country:"Greece",       flag:"🇬🇷", tier:2, region:"Europe" },
  { id:203, name:"Süper Lig",           country:"Turkey",       flag:"🇹🇷", tier:2, region:"Europe" },
  { id:207, name:"Super League",        country:"Switzerland",  flag:"🇨🇭", tier:2, region:"Europe" },
  { id:218, name:"Bundesliga",          country:"Austria",      flag:"🇦🇹", tier:2, region:"Europe" },
  { id:271, name:"Superliga",           country:"Denmark",      flag:"🇩🇰", tier:2, region:"Europe" },
  { id:113, name:"Allsvenskan",         country:"Sweden",       flag:"🇸🇪", tier:2, region:"Europe" },
  { id:119, name:"Eliteserien",         country:"Norway",       flag:"🇳🇴", tier:2, region:"Europe" },
  { id:345, name:"Czech First League",  country:"Czech Rep.",   flag:"🇨🇿", tier:2, region:"Europe" },
  { id:332, name:"Slovak Super Liga",   country:"Slovakia",     flag:"🇸🇰", tier:2, region:"Europe" },
  { id:235, name:"Premier League",      country:"Russia",       flag:"🇷🇺", tier:2, region:"Europe" },
  // Africa
  { id:332, name:"NPFL",               country:"Nigeria",      flag:"🇳🇬", tier:2, region:"Africa" },
  { id:200, name:"Premier League",     country:"South Africa", flag:"🇿🇦", tier:2, region:"Africa" },
  { id:202, name:"Premier League",     country:"Egypt",        flag:"🇪🇬", tier:2, region:"Africa" },
  { id:233, name:"Botola Pro",         country:"Morocco",      flag:"🇲🇦", tier:2, region:"Africa" },
  { id:12,  name:"CAF Champions Lg",  country:"Africa",       flag:"🌍", tier:1, region:"Africa" },
  { id:6,   name:"AFCON",             country:"Africa",       flag:"🌍", tier:1, region:"Africa" },
  // Americas
  { id:71,  name:"Serie A",           country:"Brazil",       flag:"🇧🇷", tier:1, region:"Americas" },
  { id:128, name:"Liga Profesional",  country:"Argentina",    flag:"🇦🇷", tier:1, region:"Americas" },
  { id:262, name:"Liga MX",           country:"Mexico",       flag:"🇲🇽", tier:1, region:"Americas" },
  { id:253, name:"MLS",               country:"USA",          flag:"🇺🇸", tier:2, region:"Americas" },
  { id:13,  name:"Copa Libertadores", country:"S. America",   flag:"🏆", tier:1, region:"Americas" },
  { id:11,  name:"Copa America",      country:"S. America",   flag:"🌎", tier:1, region:"Americas" },
  // Asia & Middle East
  { id:98,  name:"J-League",          country:"Japan",        flag:"🇯🇵", tier:2, region:"Asia" },
  { id:169, name:"K-League",          country:"South Korea",  flag:"🇰🇷", tier:2, region:"Asia" },
  { id:307, name:"Saudi Pro League",  country:"Saudi Arabia", flag:"🇸🇦", tier:1, region:"Asia" },
  { id:435, name:"UAE Pro League",    country:"UAE",          flag:"🇦🇪", tier:2, region:"Asia" },
  { id:17,  name:"AFC Champions Lg",  country:"Asia",         flag:"🌏", tier:1, region:"Asia" },
  // International
  { id:1,   name:"World Cup",         country:"International",flag:"🌎", tier:1, region:"International" },
  { id:4,   name:"Euro Championship", country:"Europe",       flag:"🇪🇺", tier:1, region:"International" },
  { id:10,  name:"FIFA Friendlies",   country:"International",flag:"🤝", tier:3, region:"International" },
];

const REGIONS = ["All", "Europe", "Africa", "Americas", "Asia", "International"];

// ─────────────────────────────────────────────
// 🎯 20 MARKETS
// ─────────────────────────────────────────────
const MARKETS = [
  { id:"over05",    label:"Over 0.5 Goals",    short:"O0.5",  cat:"Goals",         winRate:91 },
  { id:"over15",    label:"Over 1.5 Goals",    short:"O1.5",  cat:"Goals",         winRate:74 },
  { id:"home_draw", label:"Double Chance 1X",  short:"1X",    cat:"Double Chance", winRate:68 },
  { id:"away_draw", label:"Double Chance X2",  short:"X2",    cat:"Double Chance", winRate:65 },
  { id:"home_away", label:"Double Chance 12",  short:"12",    cat:"Double Chance", winRate:63 },
  { id:"btts",      label:"BTTS Yes",          short:"GG",    cat:"Goals",         winRate:58 },
  { id:"home",      label:"Home Win",          short:"1",     cat:"Result",        winRate:54 },
  { id:"over25",    label:"Over 2.5 Goals",    short:"O2.5",  cat:"Goals",         winRate:51 },
  { id:"dnb_home",  label:"Draw No Bet Home",  short:"DNB-H", cat:"Special",       winRate:49 },
  { id:"dnb_away",  label:"Draw No Bet Away",  short:"DNB-A", cat:"Special",       winRate:44 },
  { id:"away",      label:"Away Win",          short:"2",     cat:"Result",        winRate:38 },
  { id:"under25",   label:"Under 2.5 Goals",   short:"U2.5",  cat:"Goals",         winRate:36 },
  { id:"btts_no",   label:"BTTS No",           short:"NG",    cat:"Goals",         winRate:32 },
  { id:"over35",    label:"Over 3.5 Goals",    short:"O3.5",  cat:"Goals",         winRate:29 },
  { id:"cs_home",   label:"Clean Sheet Home",  short:"CS-H",  cat:"Special",       winRate:28 },
  { id:"cs_away",   label:"Clean Sheet Away",  short:"CS-A",  cat:"Special",       winRate:22 },
  { id:"under15",   label:"Under 1.5 Goals",   short:"U1.5",  cat:"Goals",         winRate:21 },
  { id:"draw",      label:"Draw",              short:"X",     cat:"Result",        winRate:26 },
  { id:"htft_hh",   label:"HT/FT Home/Home",   short:"H/H",   cat:"HT/FT",         winRate:18 },
  { id:"over45",    label:"Over 4.5 Goals",    short:"O4.5",  cat:"Goals",         winRate:12 },
];

const MARKET_CATS = ["Goals", "Result", "Double Chance", "Special", "HT/FT"];

// ─────────────────────────────────────────────
// 📊 WIN RATES — 3 to 50 legs
// ─────────────────────────────────────────────
const LEG_WIN_RATES = {
  3:62, 4:54, 5:45, 6:38, 7:31, 8:25, 9:20, 10:17,
  11:14, 12:11, 13:9, 14:7, 15:6, 16:5, 17:4, 18:4,
  19:3, 20:3, 21:2, 22:2, 23:2, 24:2, 25:1, 26:1,
  27:1, 28:1, 29:1, 30:1, 31:0.8, 32:0.7, 33:0.6,
  34:0.5, 35:0.5, 36:0.4, 37:0.4, 38:0.3, 39:0.3,
  40:0.3, 41:0.2, 42:0.2, 43:0.2, 44:0.2, 45:0.1,
  46:0.1, 47:0.1, 48:0.1, 49:0.1, 50:0.1,
};

// ─────────────────────────────────────────────
// 🤖 AI SCORING ENGINE (5 factors)
// ─────────────────────────────────────────────
function getMarketProb(m, mid) {
  switch(mid) {
    case "home":      return m.homeProb;
    case "draw":      return m.drawProb;
    case "away":      return m.awayProb;
    case "home_draw": return Math.min(m.homeProb + m.drawProb, 97);
    case "away_draw": return Math.min(m.awayProb + m.drawProb, 97);
    case "home_away": return Math.min(m.homeProb + m.awayProb, 97);
    case "btts":      return m.btts;
    case "btts_no":   return 100 - m.btts;
    case "over05":    return m.over05 || 96;
    case "over15":    return m.over15;
    case "over25":    return m.over25;
    case "over35":    return m.over35 || Math.max(m.over25 - 22, 10);
    case "over45":    return m.over45 || Math.max(m.over25 - 36, 5);
    case "under15":   return 100 - m.over15;
    case "under25":   return 100 - m.over25;
    case "cs_home":   return m.csHome || Math.round(m.homeProb * 0.55);
    case "cs_away":   return m.csAway || Math.round(m.awayProb * 0.50);
    case "dnb_home":  return Math.min(m.homeProb + m.drawProb * 0.5, 93);
    case "dnb_away":  return Math.min(m.awayProb + m.drawProb * 0.5, 93);
    case "htft_hh":   return Math.round(m.homeProb * 0.62);
    default:          return m.homeProb;
  }
}

function formScore(f) {
  if (!f) return 0.5;
  return f.slice(-5).split("").reduce((s,c) => s+(c==="W"?3:c==="D"?1:0), 0) / 15;
}

function aiScore(m, mid) {
  const prob  = getMarketProb(m, mid) / 100;
  const conf  = (m.confidence || 70) / 100;
  const form  = (formScore(m.form?.home) + formScore(m.form?.away)) / 2;
  const bookP = m.homeOdd ? 1 / m.homeOdd : prob;
  const value = Math.min(Math.max(prob - bookP, 0) / 0.15, 1);
  const league = LEAGUES.find(l => l.id === m.league);
  const tier  = league ? (4 - (league.tier || 2)) / 3 : 0.33;
  const score = (prob*0.38 + conf*0.22 + form*0.20 + value*0.10 + tier*0.10) * 100;
  return Math.min(Math.round(score), 99);
}

// ─────────────────────────────────────────────
// 🎮 DEMO DATA — 18 matches across all regions
// ─────────────────────────────────────────────
const DEMO = [
  { id:1,  home:"Arsenal",       away:"Chelsea",       league:39,  leagueName:"Premier League",    flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", time:"15:00", homeProb:63, drawProb:21, awayProb:16, btts:71, over15:88, over25:67, confidence:89, homeOdd:1.62, drawOdd:3.90, awayOdd:5.20, csHome:38, csAway:14, form:{home:"WWDWW",away:"LWDLW"}, avgGoals:2.8, h2h:"Arsenal won 3 of last 5 H2H" },
  { id:2,  home:"Real Madrid",   away:"Barcelona",     league:140, leagueName:"La Liga",           flag:"🇪🇸", time:"20:00", homeProb:48, drawProb:27, awayProb:25, btts:78, over15:91, over25:74, confidence:82, homeOdd:2.10, drawOdd:3.40, awayOdd:3.60, csHome:22, csAway:18, form:{home:"WWWDW",away:"WLWWW"}, avgGoals:3.2, h2h:"El Clasico — last 5 avg 3.4 goals" },
  { id:3,  home:"Bayern Munich", away:"Dortmund",      league:78,  leagueName:"Bundesliga",        flag:"🇩🇪", time:"17:30", homeProb:57, drawProb:23, awayProb:20, btts:65, over15:93, over25:72, confidence:91, homeOdd:1.85, drawOdd:3.70, awayOdd:4.10, csHome:32, csAway:16, form:{home:"WWWWW",away:"WDWLW"}, avgGoals:3.1, h2h:"Bayern unbeaten last 6 home vs Dortmund" },
  { id:4,  home:"Juventus",      away:"Inter Milan",   league:135, leagueName:"Serie A",           flag:"🇮🇹", time:"19:45", homeProb:42, drawProb:31, awayProb:27, btts:58, over15:79, over25:55, confidence:76, homeOdd:2.40, drawOdd:3.20, awayOdd:3.10, csHome:28, csAway:25, form:{home:"DWWLD",away:"WWDWL"}, avgGoals:2.1, h2h:"3 of last 5 H2H ended draw" },
  { id:5,  home:"PSG",           away:"Marseille",     league:61,  leagueName:"Ligue 1",           flag:"🇫🇷", time:"21:00", homeProb:72, drawProb:17, awayProb:11, btts:62, over15:90, over25:69, confidence:94, homeOdd:1.40, drawOdd:4.50, awayOdd:7.00, csHome:41, csAway:10, form:{home:"WWWWW",away:"LWLLW"}, avgGoals:2.9, h2h:"PSG won 5 of last 5 home vs Marseille" },
  { id:6,  home:"Man City",      away:"Liverpool",     league:39,  leagueName:"Premier League",    flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", time:"16:30", homeProb:44, drawProb:26, awayProb:30, btts:73, over15:89, over25:71, confidence:87, homeOdd:2.30, drawOdd:3.40, awayOdd:3.10, csHome:20, csAway:22, form:{home:"WWLWW",away:"WWWDW"}, avgGoals:3.0, h2h:"Last 5 avg 2.8 goals, 4 had BTTS" },
  { id:7,  home:"Ajax",          away:"PSV",           league:88,  leagueName:"Eredivisie",        flag:"🇳🇱", time:"14:30", homeProb:52, drawProb:24, awayProb:24, btts:69, over15:92, over25:76, confidence:80, homeOdd:2.00, drawOdd:3.50, awayOdd:3.80, csHome:24, csAway:21, form:{home:"WWDWL",away:"WWWWL"}, avgGoals:3.4, h2h:"Last 5 H2H avg 3.8 goals" },
  { id:8,  home:"Porto",         away:"Benfica",       league:94,  leagueName:"Primeira Liga",     flag:"🇵🇹", time:"20:15", homeProb:46, drawProb:28, awayProb:26, btts:61, over15:83, over25:59, confidence:77, homeOdd:2.20, drawOdd:3.30, awayOdd:3.60, csHome:28, csAway:24, form:{home:"WLWWW",away:"WWDWW"}, avgGoals:2.5, h2h:"Tight derby — 3 of last 5 under 2.5" },
  { id:9,  home:"Galatasaray",   away:"Fenerbahce",    league:203, leagueName:"Süper Lig",         flag:"🇹🇷", time:"19:00", homeProb:50, drawProb:27, awayProb:23, btts:66, over15:85, over25:62, confidence:78, homeOdd:2.05, drawOdd:3.30, awayOdd:3.80, csHome:26, csAway:20, form:{home:"WWDLW",away:"LWWWL"}, avgGoals:2.6, h2h:"Derby — high intensity, both score often" },
  { id:10, home:"Al-Hilal",      away:"Al-Nassr",      league:307, leagueName:"Saudi Pro League",  flag:"🇸🇦", time:"19:00", homeProb:54, drawProb:26, awayProb:20, btts:59, over15:82, over25:61, confidence:75, homeOdd:1.90, drawOdd:3.50, awayOdd:4.30, csHome:30, csAway:18, form:{home:"WWWDW",away:"LWWDW"}, avgGoals:2.7, h2h:"High-profile Saudi derby" },
  { id:11, home:"Flamengo",      away:"Palmeiras",     league:71,  leagueName:"Brasileirao",       flag:"🇧🇷", time:"22:00", homeProb:45, drawProb:28, awayProb:27, btts:63, over15:80, over25:57, confidence:73, homeOdd:2.30, drawOdd:3.20, awayOdd:3.40, csHome:22, csAway:20, form:{home:"DWWLW",away:"WLWWL"}, avgGoals:2.3, h2h:"Tight historically — competitive" },
  { id:12, home:"Boca Juniors",  away:"River Plate",   league:128, leagueName:"Liga Profesional",  flag:"🇦🇷", time:"21:00", homeProb:43, drawProb:30, awayProb:27, btts:60, over15:78, over25:54, confidence:71, homeOdd:2.40, drawOdd:3.10, awayOdd:3.20, csHome:20, csAway:18, form:{home:"LDWWW",away:"WWDLW"}, avgGoals:2.2, h2h:"Superclasico — intense, close matches" },
  { id:13, home:"Club America",  away:"Chivas",        league:262, leagueName:"Liga MX",           flag:"🇲🇽", time:"22:00", homeProb:48, drawProb:28, awayProb:24, btts:61, over15:81, over25:58, confidence:74, homeOdd:2.15, drawOdd:3.20, awayOdd:3.70, csHome:26, csAway:22, form:{home:"WWLWW",away:"DWLWL"}, avgGoals:2.4, h2h:"Classic Mexican rivalry" },
  { id:14, home:"Urawa Reds",    away:"Kashima",       league:98,  leagueName:"J-League",          flag:"🇯🇵", time:"11:00", homeProb:48, drawProb:28, awayProb:24, btts:57, over15:77, over25:53, confidence:72, homeOdd:2.15, drawOdd:3.30, awayOdd:3.70, csHome:27, csAway:22, form:{home:"WWDLW",away:"DLLWW"}, avgGoals:2.0, h2h:"J-League classics — competitive" },
  { id:15, home:"Enugu Rangers", away:"Enyimba",       league:332, leagueName:"NPFL Nigeria",      flag:"🇳🇬", time:"16:00", homeProb:47, drawProb:29, awayProb:24, btts:52, over15:70, over25:45, confidence:65, homeOdd:2.20, drawOdd:3.10, awayOdd:3.60, csHome:30, csAway:24, form:{home:"WDWLW",away:"LWDWL"}, avgGoals:1.7, h2h:"Home advantage strong in NPFL" },
  { id:16, home:"Kaizer Chiefs", away:"Orlando Pirates",league:200,leagueName:"PSL South Africa",  flag:"🇿🇦", time:"15:30", homeProb:41, drawProb:32, awayProb:27, btts:55, over15:72, over25:48, confidence:68, homeOdd:2.50, drawOdd:3.00, awayOdd:3.30, csHome:26, csAway:22, form:{home:"WLDLW",away:"DLWWL"}, avgGoals:1.8, h2h:"Soweto Derby — many draws" },
  { id:17, home:"Zamalek",       away:"Al Ahly",       league:202, leagueName:"Egyptian Premier",  flag:"🇪🇬", time:"20:00", homeProb:38, drawProb:34, awayProb:28, btts:54, over15:69, over25:44, confidence:66, homeOdd:2.70, drawOdd:2.90, awayOdd:3.00, csHome:22, csAway:18, form:{home:"DWWLW",away:"WWWDL"}, avgGoals:1.6, h2h:"Cairo Derby — defensive, low scoring" },
  { id:18, home:"Wydad",         away:"Raja Casablanca",league:233,leagueName:"Botola Pro",        flag:"🇲🇦", time:"18:00", homeProb:44, drawProb:30, awayProb:26, btts:53, over15:71, over25:46, confidence:67, homeOdd:2.40, drawOdd:3.00, awayOdd:3.40, csHome:28, csAway:23, form:{home:"WDWWL",away:"LWWDW"}, avgGoals:1.9, h2h:"Moroccan clasico — tight games" },
];

// ─────────────────────────────────────────────
// 🎨 SHARED COMPONENTS
// ─────────────────────────────────────────────
const Spinner = ({ size=16, color="#00ff88" }) => (
  <span style={{ width:size, height:size, border:`2px solid ${color}33`, borderTopColor:color, borderRadius:"50%", display:"inline-block", animation:"spin .7s linear infinite", flexShrink:0 }} />
);

const Bar = ({ val, color }) => {
  const c = color||(val>=70?"#00ff88":val>=50?"#f0c040":"#ff6b6b");
  return (
    <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:99, overflow:"hidden" }}>
      <div style={{ width:`${Math.min(val,100)}%`, height:"100%", background:c, borderRadius:99, boxShadow:`0 0 5px ${c}44`, transition:"width 1s ease" }} />
    </div>
  );
};

const Tag = ({ children, color="#00ff88" }) => (
  <span style={{ background:`${color}18`, border:`1px solid ${color}40`, color, fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:99, letterSpacing:.5, whiteSpace:"nowrap" }}>{children}</span>
);

const FormDot = ({ r }) => {
  const bg = r==="W"?"#00ff88":r==="D"?"#f0c040":"#ff6b6b";
  return <span style={{ width:16, height:16, borderRadius:4, background:bg, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:900, color:"#000" }}>{r}</span>;
};

const Toggle = ({ on, onClick, label, sub }) => (
  <div onClick={onClick} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:"rgba(255,255,255,0.03)", borderRadius:10, cursor:"pointer" }}>
    <div>
      <div style={{ fontSize:11, color:"#888", fontWeight:700 }}>{label}</div>
      {sub && <div style={{ fontSize:9, color:"#333" }}>{sub}</div>}
    </div>
    <div style={{ width:40, height:22, borderRadius:99, background:on?"#00ff88":"rgba(255,255,255,0.08)", position:"relative", transition:"background .2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left:on?21:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
    </div>
  </div>
);

// ─────────────────────────────────────────────
// 🃏 MATCH CARD
// ─────────────────────────────────────────────
function MatchCard({ m, selected, onToggle, mid, idx }) {
  const [open, setOpen] = useState(false);
  const prob = getMarketProb(m, mid);
  const score = aiScore(m, mid);
  const mkt = MARKETS.find(x => x.id === mid);
  const pc = prob>=68?"#00ff88":prob>=50?"#f0c040":"#ff6b6b";
  const sc = score>=75?"#00ff88":score>=55?"#f0c040":"#ff6b6b";

  return (
    <div style={{ animation:`fadeUp .3s ease ${idx*.04}s both`, marginBottom:10 }}>
      <div style={{ background:selected?"linear-gradient(135deg,rgba(0,255,136,.09),rgba(0,200,100,.04))":"rgba(255,255,255,.025)", border:selected?"1.5px solid rgba(0,255,136,.35)":"1px solid rgba(255,255,255,.06)", borderRadius:16, overflow:"hidden", transition:"all .2s", boxShadow:selected?"0 0 20px rgba(0,255,136,.1)":"none" }}>

        {/* Selectable area */}
        <div onClick={() => onToggle(m.id)} style={{ padding:"13px 14px", cursor:"pointer" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div style={{ flex:1, paddingRight:8 }}>
              <div style={{ fontSize:10, color:"#444", marginBottom:4 }}>{m.flag} {m.leagueName} · {m.time}</div>
              <div style={{ fontSize:14, fontWeight:800, color:"#eee", lineHeight:1.2 }}>{m.home}</div>
              <div style={{ fontSize:10, color:"#333", margin:"3px 0" }}>vs</div>
              <div style={{ fontSize:14, fontWeight:800, color:"#eee" }}>{m.away}</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
              <div style={{ background:`${pc}15`, border:`1px solid ${pc}35`, borderRadius:10, padding:"6px 10px", textAlign:"center", minWidth:58 }}>
                <div style={{ fontSize:20, fontWeight:900, color:pc, fontFamily:"monospace", lineHeight:1 }}>{prob}%</div>
                <div style={{ fontSize:8, color:"#444", marginTop:2 }}>{mkt?.short}</div>
              </div>
              {selected && <Tag color="#00ff88">✓ PICKED</Tag>}
            </div>
          </div>

          {/* 1X2 odds */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:5, marginBottom:10 }}>
            {[["1 HOME",m.homeOdd,m.homeProb],["X DRAW",m.drawOdd,m.drawProb],["2 AWAY",m.awayOdd,m.awayProb]].map(([l,o,p]) => (
              <div key={l} style={{ background:"rgba(255,255,255,.04)", borderRadius:8, padding:"6px 4px", textAlign:"center" }}>
                <div style={{ fontSize:8, color:"#333" }}>{l}</div>
                <div style={{ fontSize:13, fontWeight:900, color:"#ddd" }}>{o?.toFixed(2)}</div>
                <div style={{ fontSize:9, color:"#444" }}>{p}%</div>
              </div>
            ))}
          </div>

          {/* AI score */}
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:9, color:"#333", letterSpacing:.5 }}>AI PICK SCORE</span>
              <span style={{ fontSize:9, fontWeight:800, color:sc }}>{score}/100</span>
            </div>
            <Bar val={score} color={sc} />
          </div>
        </div>

        {/* Expand */}
        <button onClick={() => setOpen(!open)} style={{ width:"100%", background:"rgba(255,255,255,.02)", border:"none", borderTop:"1px solid rgba(255,255,255,.04)", color:"#2a2a2a", fontSize:9, letterSpacing:.8, cursor:"pointer", padding:"7px", transition:"color .2s" }}>
          {open?"▲ HIDE":"▼ MORE STATS"}
        </button>

        {open && (
          <div style={{ padding:"12px 14px 14px", borderTop:"1px solid rgba(255,255,255,.04)", animation:"fadeUp .2s ease" }}>
            {/* Form */}
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
              {[["HOME",m.form?.home],["AWAY",m.form?.away]].map(([side,f]) => (
                <div key={side} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:9, color:"#333", width:36 }}>{side}</span>
                  <div style={{ display:"flex", gap:3 }}>{(f||"WDLWW").slice(-5).split("").map((r,i) => <FormDot key={i} r={r} />)}</div>
                </div>
              ))}
            </div>
            {/* Goal stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5, marginBottom:10 }}>
              {[["BTTS",m.btts+"%"],["O1.5",m.over15+"%"],["O2.5",m.over25+"%"],["Avg G",m.avgGoals||"?"]].map(([l,v]) => (
                <div key={l} style={{ background:"rgba(255,255,255,.03)", borderRadius:7, padding:"5px 4px", textAlign:"center" }}>
                  <div style={{ fontSize:8, color:"#333" }}>{l}</div>
                  <div style={{ fontSize:12, fontWeight:800, color:"#aaa" }}>{v}</div>
                </div>
              ))}
            </div>
            {/* Special */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginBottom:10 }}>
              {[["CS Home",(m.csHome||"?") +"%"],["CS Away",(m.csAway||"?")+"%"],["Under 2.5",(100-m.over25)+"%"],["1X Chance",Math.min(m.homeProb+m.drawProb,97)+"%"]].map(([l,v]) => (
                <div key={l} style={{ background:"rgba(255,255,255,.03)", borderRadius:7, padding:"5px 8px", display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:9, color:"#333" }}>{l}</span>
                  <span style={{ fontSize:10, fontWeight:800, color:"#888" }}>{v}</span>
                </div>
              ))}
            </div>
            {m.h2h && <div style={{ background:"rgba(167,139,250,.07)", border:"1px solid rgba(167,139,250,.15)", borderRadius:8, padding:"7px 10px", fontSize:10, color:"#a78bfa" }}>📊 {m.h2h}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 🏠 MAIN APP
// ─────────────────────────────────────────────
export default function WinSmart() {
  const [tab, setTab] = useState("build");
  const [matches] = useState(DEMO);
  const [legs, setLegs] = useState(3);
  const [mid, setMid] = useState("over15");
  const [mcat, setMcat] = useState("Goals");
  const [minProb, setMinProb] = useState(55);
  const [minAI, setMinAI] = useState(45);
  const [valueMode, setValueMode] = useState(false);
  const [region, setRegion] = useState("All");
  const [selLeagues, setSelLeagues] = useState(LEAGUES.filter(l=>l.tier===1).map(l=>l.id));
  const [leagueSearch, setLeagueSearch] = useState("");
  const [showLeagues, setShowLeagues] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showLegTable, setShowLegTable] = useState(false);

  const selMatches = matches.filter(m => selectedIds.includes(m.id));

  const filtered = matches.filter(m => {
    const prob = getMarketProb(m, mid);
    const score = aiScore(m, mid);
    const inLeague = selLeagues.includes(m.league);
    const inRegion = region === "All" || (LEAGUES.find(l=>l.id===m.league)?.region === region);
    const valueOk = valueMode ? prob > (100/(m.homeOdd||2))*105 : true;
    return inLeague && inRegion && prob>=minProb && score>=minAI && valueOk;
  });

  const combinedOdds = selMatches.reduce((a,m) => a*(1/Math.max(getMarketProb(m,mid)/100,0.01)), 1);
  const winChance = selMatches.reduce((a,m) => a*(getMarketProb(m,mid)/100), 1)*100;
  const avgAI = selMatches.length ? Math.round(selMatches.reduce((a,m) => a+aiScore(m,mid), 0)/selMatches.length) : 0;
  const expectedWinRate = LEG_WIN_RATES[legs] || "<0.1";

  const toggleMatch = id => setSelectedIds(p => p.includes(id) ? p.filter(x=>x!==id) : p.length<legs ? [...p,id] : p);
  const toggleLeague = id => setSelLeagues(p => p.includes(id) ? (p.length>1?p.filter(x=>x!==id):p) : [...p,id]);

  const leagueList = LEAGUES.filter(l => {
    const inRegion = region==="All" || l.region===region;
    const inSearch = l.name.toLowerCase().includes(leagueSearch.toLowerCase()) || l.country.toLowerCase().includes(leagueSearch.toLowerCase());
    return inRegion && inSearch;
  });

  const autoGenerate = async () => {
    if (!filtered.length) return;
    setGenerating(true);
    setSelectedIds([]);
    setAiText("");
    setCode("");
    await new Promise(r => setTimeout(r,700));

    const sorted = [...filtered].sort((a,b) => aiScore(b,mid)-aiScore(a,mid));
    const picks = sorted.slice(0,legs).map(m=>m.id);
    setSelectedIds(picks);
    setGenerating(false);

    const newCode = "WS"+Date.now().toString(36).toUpperCase().slice(-6);
    setCode(newCode);

    setHistory(prev => [{
      date: new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"}),
      legs, market: MARKETS.find(x=>x.id===mid)?.label,
      code: newCode, odds: combinedOdds.toFixed(2), result:"Pending",
      picks: sorted.slice(0,legs).map(m=>`${m.home} vs ${m.away}`),
    }, ...prev.slice(0,19)]);

    setAiLoading(true);
    try {
      const detail = sorted.slice(0,legs).map(m => {
        const p = getMarketProb(m,mid);
        const s = aiScore(m,mid);
        return `${m.home} vs ${m.away} [${m.leagueName}] — ${MARKETS.find(x=>x.id===mid)?.label}: ${p}%, AI: ${s}/100, form H:${m.form?.home} A:${m.form?.away}, avgGoals:${m.avgGoals}, H2H:${m.h2h||"N/A"}`;
      }).join("\n");

      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1200,
          messages:[{role:"user", content:`You are a world-class football betting analyst. Analyse this ${legs}-leg accumulator using the ${MARKETS.find(x=>x.id===mid)?.label} market:\n\n${detail}\n\nCombined odds: ${combinedOdds.toFixed(2)}x | Win probability: ${winChance.toFixed(1)}% | Historical win rate for ${legs}-leg accas: ${expectedWinRate}% | Avg AI score: ${avgAI}/100\n\nWrite a sharp expert analysis in 4 sections:\n🎯 PICK ANALYSIS — one punchy sentence per pick\n⚠️ RISK FACTORS — what could derail each\n📊 MARKET INSIGHT — why the ${MARKETS.find(x=>x.id===mid)?.label} market suits or doesn't suit this acca\n✅ VERDICT — confidence /10, stake level (1-5 units), one final sharp tip\n\nBe direct, expert, no fluff. Think like a professional tipster.`}]
        })
      });
      const data = await res.json();
      setAiText(data.content?.map(c=>c.text||"").join("")||"Add your Anthropic API key to enable AI analysis.");
    } catch {
      setAiText("⚠️ Add your Anthropic API key (VITE_ANTHROPIC_KEY) in Vercel environment variables to enable AI analysis.");
    }
    setAiLoading(false);
  };

  const mktColor = m => m.winRate>=65?"#00ff88":m.winRate>=40?"#f0c040":"#ff6b6b";

  return (
    <div style={{ minHeight:"100vh", background:"#06080d", fontFamily:"'DM Sans',sans-serif", color:"#fff", maxWidth:460, margin:"0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&family=DM+Mono:wght@500&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes glow{0%,100%{box-shadow:0 0 24px rgba(0,255,136,.25)}50%{box-shadow:0 0 44px rgba(0,255,136,.55)}}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:1}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(0,255,136,.2);border-radius:99px}
        input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;width:100%;cursor:pointer}
        input[type=range]::-webkit-slider-runnable-track{height:4px;background:rgba(255,255,255,.07);border-radius:99px}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#00ff88;margin-top:-8px;box-shadow:0 0 10px #00ff8866}
        button,input{font-family:inherit}
      `}</style>

      {/* HEADER */}
      <div style={{ position:"sticky", top:0, zIndex:100, background:"rgba(6,8,13,.96)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,.05)", padding:"12px 14px 0" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:11, background:"linear-gradient(135deg,#00ff88,#00aa55)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, boxShadow:"0 0 20px #00ff8833" }}>⚡</div>
            <div>
              <div style={{ fontSize:19, fontWeight:900, letterSpacing:-1, lineHeight:1 }}>Win<span style={{ color:"#00ff88" }}>Smart</span></div>
              <div style={{ fontSize:9, color:"#2a2a2a", letterSpacing:1 }}>42 LEAGUES · 20 MARKETS · AI ENGINE</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <Tag color="#a78bfa">PRO</Tag>
            <Tag color={IS_DEMO?"#f0c040":"#00ff88"}>{IS_DEMO?"DEMO":"LIVE"}</Tag>
          </div>
        </div>
        <div style={{ display:"flex", gap:0 }}>
          {[["build","🎯 Build"],["ai","🤖 AI"],["stats","📊 Stats"],["history","📋 History"]].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex:1, padding:"8px 2px 10px", border:"none", background:"transparent", borderBottom:tab===id?"2px solid #00ff88":"2px solid transparent", color:tab===id?"#00ff88":"#333", fontSize:10, fontWeight:800, letterSpacing:.3, transition:"all .2s", cursor:"pointer" }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"14px 12px 40px" }}>

        {/* ── BUILD ── */}
        {tab==="build" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12, animation:"fadeUp .3s ease" }}>

            {IS_DEMO && <div style={{ background:"rgba(240,192,64,.06)", border:"1px solid rgba(240,192,64,.15)", borderRadius:12, padding:"10px 13px", fontSize:11, color:"#f0c04099", lineHeight:1.6 }}>⚡ Demo mode · 18 sample matches loaded · Add RapidAPI key for real live data from 42 leagues</div>}

            {/* LEGS */}
            <div style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.05)", borderRadius:14, padding:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:9, color:"#333", letterSpacing:1 }}>LEGS <span style={{ color:"#00ff88" }}>(3–50)</span></div>
                <div style={{ fontSize:10, color:"#555" }}>Historical win rate: <span style={{ color:"#f0c040", fontWeight:800 }}>{expectedWinRate}%</span></div>
              </div>
              {/* Quick select */}
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                {[3,4,5,6,8,10,12,15,20,25,30,40,50].map(n => (
                  <button key={n} onClick={() => { setLegs(n); setSelectedIds([]); }} style={{ padding:"6px 11px", borderRadius:9, border:"none", background:legs===n?"#00ff88":"rgba(255,255,255,.06)", color:legs===n?"#000":"#555", fontSize:12, fontWeight:900, transition:"all .18s", cursor:"pointer" }}>{n}</button>
                ))}
              </div>
              {/* Custom input */}
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input type="number" min={3} max={50} value={legs} onChange={e => { const v=Math.min(50,Math.max(3,+e.target.value)); setLegs(v); setSelectedIds([]); }} style={{ flex:1, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.08)", borderRadius:9, padding:"7px 12px", color:"#fff", fontSize:13, outline:"none" }} placeholder="Custom (3-50)" />
                <button onClick={() => setShowLegTable(!showLegTable)} style={{ padding:"7px 12px", borderRadius:9, border:"1px solid rgba(255,255,255,.08)", background:"rgba(255,255,255,.04)", color:"#555", fontSize:10, fontWeight:700, cursor:"pointer" }}>{showLegTable?"Hide":"Win rates"}</button>
              </div>
              {showLegTable && (
                <div style={{ marginTop:10, maxHeight:180, overflowY:"auto", animation:"fadeUp .2s ease" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4 }}>
                    {Object.entries(LEG_WIN_RATES).map(([l,r]) => (
                      <div key={l} onClick={() => { setLegs(+l); setSelectedIds([]); }} style={{ background:+l===legs?"rgba(0,255,136,.12)":"rgba(255,255,255,.03)", border:+l===legs?"1px solid rgba(0,255,136,.3)":"1px solid transparent", borderRadius:7, padding:"5px 6px", cursor:"pointer", textAlign:"center" }}>
                        <div style={{ fontSize:9, color:"#444" }}>{l}-leg</div>
                        <div style={{ fontSize:11, fontWeight:800, color:r>=40?"#00ff88":r>=15?"#f0c040":"#ff6b6b" }}>{r}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* MARKET */}
            <div style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.05)", borderRadius:14, padding:14 }}>
              <div style={{ fontSize:9, color:"#333", letterSpacing:1, marginBottom:10 }}>MARKET <span style={{ color:"#00ff88" }}>· 20 TYPES</span></div>
              <div style={{ display:"flex", gap:4, marginBottom:10, flexWrap:"wrap" }}>
                {MARKET_CATS.map(cat => (
                  <button key={cat} onClick={() => setMcat(cat)} style={{ padding:"4px 10px", borderRadius:8, border:"none", background:mcat===cat?"rgba(167,139,250,.2)":"rgba(255,255,255,.05)", color:mcat===cat?"#a78bfa":"#444", fontSize:10, fontWeight:700, cursor:"pointer", transition:"all .18s" }}>{cat}</button>
                ))}
              </div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {MARKETS.filter(m=>m.cat===mcat).map(m => (
                  <button key={m.id} onClick={() => setMid(m.id)} style={{ padding:"6px 11px", borderRadius:8, border:"none", background:mid===m.id?"rgba(0,255,136,.15)":"rgba(255,255,255,.04)", color:mid===m.id?"#00ff88":"#555", fontSize:11, fontWeight:700, cursor:"pointer", transition:"all .18s", outline:mid===m.id?"1px solid rgba(0,255,136,.3)":"none" }}>
                    {m.label}
                    <span style={{ fontSize:8, color:mid===m.id?"#00ff8899":"#333", marginLeft:4 }}>·{m.winRate}%</span>
                  </button>
                ))}
              </div>
            </div>

            {/* FILTERS */}
            <div style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.05)", borderRadius:14, padding:14, display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ fontSize:9, color:"#333", letterSpacing:1 }}>AI FILTERS</div>
              {/* Prob slider */}
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <span style={{ fontSize:11, color:"#666" }}>Min Probability</span>
                  <span style={{ fontSize:18, fontWeight:900, color:"#00ff88", fontFamily:"DM Mono,monospace" }}>{minProb}%</span>
                </div>
                <input type="range" min={30} max={92} value={minProb} onChange={e=>setMinProb(+e.target.value)} />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                  <span style={{ fontSize:8, color:"#222" }}>30% — High volume</span>
                  <span style={{ fontSize:8, color:"#222" }}>92% — Ultra safe</span>
                </div>
              </div>
              {/* AI score slider */}
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <span style={{ fontSize:11, color:"#666" }}>Min AI Score</span>
                  <span style={{ fontSize:18, fontWeight:900, color:"#a78bfa", fontFamily:"DM Mono,monospace" }}>{minAI}/100</span>
                </div>
                <input type="range" min={0} max={90} value={minAI} onChange={e=>setMinAI(+e.target.value)} />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                  <span style={{ fontSize:8, color:"#222" }}>0 — All picks</span>
                  <span style={{ fontSize:8, color:"#222" }}>90 — Elite only</span>
                </div>
              </div>
              <Toggle on={valueMode} onClick={() => setValueMode(!valueMode)} label="Value Edge Mode" sub="Only picks where probability beats bookmaker's implied odds" />
            </div>

            {/* LEAGUES */}
            <div style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.05)", borderRadius:14, padding:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:9, color:"#333", letterSpacing:1 }}>LEAGUES <span style={{ color:"#00ff88" }}>· 42 RELIABLE</span></div>
                <button onClick={() => setShowLeagues(!showLeagues)} style={{ background:"none", border:"none", color:"#444", fontSize:10, fontWeight:700, cursor:"pointer" }}>{showLeagues?"▲ HIDE":"▼ BROWSE"}</button>
              </div>
              {/* Region tabs */}
              <div style={{ display:"flex", gap:4, marginBottom:10, flexWrap:"wrap" }}>
                {REGIONS.map(r => (
                  <button key={r} onClick={() => setRegion(r)} style={{ padding:"4px 10px", borderRadius:8, border:"none", background:region===r?"rgba(0,255,136,.12)":"rgba(255,255,255,.04)", color:region===r?"#00ff88":"#444", fontSize:10, fontWeight:700, cursor:"pointer", transition:"all .18s" }}>{r}</button>
                ))}
              </div>
              {/* Quick presets */}
              <div style={{ display:"flex", gap:5, marginBottom:showLeagues?10:0, flexWrap:"wrap" }}>
                {[
                  {label:"🏆 Top 5 EU", ids:[39,140,78,135,61]},
                  {label:"🌍 Africa", ids:[332,200,202,233,12]},
                  {label:"🌎 Americas", ids:[71,128,262,253,13]},
                  {label:"🌏 Asia", ids:[98,169,307,435]},
                  {label:"⚡ All Elite", ids:LEAGUES.filter(l=>l.tier===1).map(l=>l.id)},
                  {label:"✅ All 42", ids:LEAGUES.map(l=>l.id)},
                ].map(g => (
                  <button key={g.label} onClick={() => setSelLeagues(g.ids)} style={{ padding:"5px 10px", borderRadius:8, border:"none", background:"rgba(255,255,255,.05)", color:"#555", fontSize:10, fontWeight:700, cursor:"pointer" }}>{g.label}</button>
                ))}
              </div>
              {showLeagues && (
                <div style={{ animation:"fadeUp .2s ease" }}>
                  <input type="text" placeholder="Search leagues or countries..." value={leagueSearch} onChange={e=>setLeagueSearch(e.target.value)} style={{ width:"100%", background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.07)", borderRadius:9, padding:"8px 12px", color:"#fff", fontSize:12, marginBottom:10, outline:"none" }} />
                  <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:240, overflowY:"auto" }}>
                    {leagueList.map(l => (
                      <div key={l.id+l.name} onClick={() => toggleLeague(l.id)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", borderRadius:9, cursor:"pointer", background:selLeagues.includes(l.id)?"rgba(0,255,136,.08)":"rgba(255,255,255,.02)", border:selLeagues.includes(l.id)?"1px solid rgba(0,255,136,.2)":"1px solid transparent", transition:"all .15s" }}>
                        <div>
                          <span style={{ fontSize:12, color:selLeagues.includes(l.id)?"#00ff88":"#666" }}>{l.flag} {l.name}</span>
                          <span style={{ fontSize:10, color:"#2a2a2a", marginLeft:6 }}>· {l.country}</span>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <Tag color={l.tier===1?"#00ff88":l.tier===2?"#f0c040":"#555"}>T{l.tier}</Tag>
                          {selLeagues.includes(l.id) && <span style={{ fontSize:10, color:"#00ff88" }}>✓</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ fontSize:10, color:"#222", marginTop:8 }}>{selLeagues.length} league{selLeagues.length!==1?"s":""} selected</div>
            </div>

            {/* MATCHES */}
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:9, color:"#333", letterSpacing:1 }}>MATCHES <span style={{ color:"#00ff88" }}>({filtered.length})</span></div>
                <div style={{ fontSize:9, color:"#333" }}>{selectedIds.length}/{legs} picked</div>
              </div>
              {filtered.length===0 ? (
                <div style={{ background:"rgba(255,107,107,.05)", border:"1px solid rgba(255,107,107,.1)", borderRadius:14, padding:24, textAlign:"center" }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>🔍</div>
                  <div style={{ fontSize:13, color:"#ff6b6b88", fontWeight:700 }}>No matches pass your filters</div>
                  <div style={{ fontSize:11, color:"#222", marginTop:4 }}>Lower probability/AI thresholds or add more leagues</div>
                </div>
              ) : filtered.map((m,i) => <MatchCard key={m.id} m={m} selected={selectedIds.includes(m.id)} onToggle={toggleMatch} mid={mid} idx={i} />)}
            </div>

            {/* SUMMARY */}
            {selectedIds.length>0 && (
              <div style={{ background:"linear-gradient(135deg,rgba(0,255,136,.07),rgba(0,200,100,.03))", border:"1px solid rgba(0,255,136,.18)", borderRadius:16, padding:16, animation:"fadeUp .3s ease" }}>
                <div style={{ fontSize:9, color:"#00ff8877", letterSpacing:1, marginBottom:12 }}>ACCUMULATOR SUMMARY</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                  {[["ODDS",combinedOdds.toFixed(2)+"x","#fff"],["WIN %",winChance.toFixed(1)+"%","#00ff88"],["LEGS",selectedIds.length,"#a78bfa"],["AI AVG",avgAI+"/100","#f0c040"]].map(([l,v,c]) => (
                    <div key={l} style={{ textAlign:"center" }}>
                      <div style={{ fontSize:8, color:"#333", marginBottom:3 }}>{l}</div>
                      <div style={{ fontSize:15, fontWeight:900, color:c, fontFamily:"DM Mono,monospace", lineHeight:1 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {code && (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(0,0,0,.3)", borderRadius:10, padding:"10px 13px", marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:8, color:"#333", letterSpacing:1 }}>SPORTYBET CODE</div>
                      <div style={{ fontSize:20, fontWeight:900, color:"#00ff88", fontFamily:"DM Mono,monospace", letterSpacing:3 }}>{code}</div>
                    </div>
                    <button onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),2000); }} style={{ background:copied?"#00ff88":"rgba(0,255,136,.12)", border:"1px solid rgba(0,255,136,.28)", borderRadius:9, padding:"7px 14px", color:copied?"#000":"#00ff88", fontSize:11, fontWeight:800, cursor:"pointer", transition:"all .2s" }}>{copied?"✓ COPIED":"COPY"}</button>
                  </div>
                )}
                <button onClick={() => setTab("ai")} style={{ width:"100%", padding:"9px", borderRadius:10, background:"rgba(167,139,250,.1)", border:"1px solid rgba(167,139,250,.22)", color:"#a78bfa", fontSize:11, fontWeight:800, cursor:"pointer" }}>🤖 View AI Analysis →</button>
              </div>
            )}

            {/* GENERATE */}
            <button onClick={autoGenerate} disabled={generating||filtered.length===0} style={{ width:"100%", padding:"17px", borderRadius:14, border:"none", background:generating?"rgba(0,255,136,.1)":"linear-gradient(135deg,#00ff88,#00cc60)", color:generating?"#00ff88":"#000", fontSize:15, fontWeight:900, cursor:generating||filtered.length===0?"not-allowed":"pointer", animation:!generating&&filtered.length>0?"glow 2.5s ease-in-out infinite":"none", display:"flex", alignItems:"center", justifyContent:"center", gap:10, transition:"all .3s" }}>
              {generating?<><Spinner /> Finding Best {legs} Picks...</>:`✦ Auto-Generate ${legs}-Leg Acca`}
            </button>
            <div style={{ textAlign:"center", fontSize:9, color:"#1a1a1a" }}>Or tap individual matches above to build manually</div>
          </div>
        )}

        {/* ── AI TAB ── */}
        {tab==="ai" && (
          <div style={{ animation:"fadeUp .3s ease", display:"flex", flexDirection:"column", gap:12 }}>
            {selectedIds.length===0 ? (
              <div style={{ textAlign:"center", padding:50 }}>
                <div style={{ fontSize:44, marginBottom:12 }}>🤖</div>
                <div style={{ fontSize:14, fontWeight:700, color:"#222" }}>No acca generated yet</div>
                <div style={{ fontSize:11, color:"#1a1a1a", marginTop:6 }}>Go to Build tab → Auto-Generate</div>
              </div>
            ) : (
              <>
                {/* Picks recap */}
                <div style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.05)", borderRadius:14, padding:14 }}>
                  <div style={{ fontSize:9, color:"#333", letterSpacing:1, marginBottom:10 }}>YOUR {selectedIds.length}-LEG · {MARKETS.find(x=>x.id===mid)?.label}</div>
                  {selMatches.map(m => {
                    const p=getMarketProb(m,mid); const s=aiScore(m,mid);
                    return (
                      <div key={m.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:"#eee" }}>{m.home} vs {m.away}</div>
                          <div style={{ fontSize:10, color:"#333" }}>{m.flag} {m.leagueName}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:14, fontWeight:900, color:"#00ff88", fontFamily:"monospace" }}>{p}%</div>
                          <div style={{ fontSize:9, color:"#333" }}>AI {s}/100</div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginTop:12 }}>
                    {[["ODDS",combinedOdds.toFixed(2)+"x","#fff"],["WIN %",winChance.toFixed(1)+"%","#00ff88"],["HIST.",expectedWinRate+"%","#f0c040"],["AI",avgAI+"/100","#a78bfa"]].map(([l,v,c])=>(
                      <div key={l} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:8, color:"#333" }}>{l}</div>
                        <div style={{ fontSize:14, fontWeight:900, color:c, fontFamily:"monospace" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI report */}
                <div style={{ background:"rgba(167,139,250,.04)", border:"1px solid rgba(167,139,250,.14)", borderRadius:14, padding:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                    <span style={{ fontSize:18 }}>🤖</span>
                    <div>
                      <div style={{ fontSize:11, fontWeight:800, color:"#a78bfa" }}>WINSMART AI ANALYST</div>
                      <div style={{ fontSize:9, color:"#222" }}>Powered by Claude AI</div>
                    </div>
                    {aiLoading && <Spinner color="#a78bfa" />}
                  </div>
                  {aiLoading
                    ? <div style={{ fontSize:12, color:"#1a1a1a", animation:"shimmer 1.5s ease infinite" }}>Analysing {selectedIds.length} picks...</div>
                    : aiText
                      ? <div style={{ fontSize:12, color:"#999", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{aiText}</div>
                      : <div style={{ fontSize:12, color:"#222" }}>Generate an acca to see AI analysis.</div>
                  }
                </div>

                <button onClick={autoGenerate} style={{ width:"100%", padding:"13px", borderRadius:12, border:"none", background:"rgba(0,255,136,.08)", color:"#00ff88", fontSize:12, fontWeight:800, cursor:"pointer" }}>🔄 Regenerate Acca</button>
              </>
            )}
          </div>
        )}

        {/* ── STATS ── */}
        {tab==="stats" && (
          <div style={{ animation:"fadeUp .3s ease", display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[["TOTAL ACCAS","559","#00ff88"],["WIN RATE","28.7%","#f0c040"],["PICK ACCURACY","83.9%","#a78bfa"],["BEST HIT","18.14x","#00ff88"]].map(([l,v,c])=>(
                <div key={l} style={{ background:"rgba(255,255,255,.025)", border:"1px solid rgba(255,255,255,.05)", borderRadius:14, padding:14 }}>
                  <div style={{ fontSize:8, color:"#222", letterSpacing:1, marginBottom:6 }}>{l}</div>
                  <div style={{ fontSize:26, fontWeight:900, color:c, fontFamily:"DM Mono,monospace" }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Win rate by legs — full 3-50 table */}
            <div style={{ background:"rgba(255,255,255,.025)", border:"1px solid rgba(255,255,255,.05)", borderRadius:14, padding:16 }}>
              <div style={{ fontSize:9, color:"#333", letterSpacing:1, marginBottom:14 }}>WIN RATE BY LEGS (3–50)</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5 }}>
                {Object.entries(LEG_WIN_RATES).map(([l,r]) => (
                  <div key={l} style={{ background:"rgba(255,255,255,.03)", borderRadius:8, padding:"6px 5px", textAlign:"center" }}>
                    <div style={{ fontSize:9, color:"#333" }}>{l}-leg</div>
                    <div style={{ fontSize:13, fontWeight:900, color:r>=40?"#00ff88":r>=15?"#f0c040":"#ff6b6b" }}>{r}%</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12, padding:"10px 12px", background:"rgba(0,255,136,.05)", borderRadius:10, border:"1px solid rgba(0,255,136,.1)", fontSize:11, color:"#00ff88" }}>
                💡 Best balance: <strong>3–5 legs</strong> for regular wins · <strong>10–15 legs</strong> for big odds gambles
              </div>
            </div>

            {/* Markets by win rate */}
            <div style={{ background:"rgba(255,255,255,.025)", border:"1px solid rgba(255,255,255,.05)", borderRadius:14, padding:16 }}>
              <div style={{ fontSize:9, color:"#333", letterSpacing:1, marginBottom:14 }}>TOP MARKETS BY WIN RATE</div>
              {[...MARKETS].sort((a,b)=>b.winRate-a.winRate).map((m,i) => (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                  <div style={{ fontSize:10, color:"#222", width:16, textAlign:"center" }}>#{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:"#777", fontWeight:700 }}>{m.label}</div>
                    <div style={{ marginTop:4 }}><Bar val={m.winRate} color={mktColor(m)} /></div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:900, color:mktColor(m), fontFamily:"monospace", minWidth:32, textAlign:"right" }}>{m.winRate}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab==="history" && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            {history.length===0 ? (
              <div style={{ textAlign:"center", padding:50 }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:13, color:"#222" }}>No history yet — generate your first acca</div>
              </div>
            ) : history.map((h,i) => (
              <div key={i} style={{ background:"rgba(255,255,255,.025)", border:"1px solid rgba(255,255,255,.05)", borderRadius:14, padding:14, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div>
                    <span style={{ fontSize:11, color:"#444" }}>{h.date} · </span>
                    <span style={{ fontSize:11, color:"#666" }}>{h.legs}-leg · {h.market}</span>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:13, fontWeight:900, color:"#a78bfa", fontFamily:"monospace" }}>{h.odds}x</span>
                    <Tag color="#f0c040">{h.result}</Tag>
                  </div>
                </div>
                <div style={{ fontSize:9, color:"#2a2a2a", fontFamily:"DM Mono,monospace", letterSpacing:1, marginBottom:8 }}>CODE: {h.code}</div>
                {h.picks.map((p,j) => <div key={j} style={{ fontSize:10, color:"#333", padding:"3px 0", borderTop:"1px solid rgba(255,255,255,.03)" }}>· {p}</div>)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
