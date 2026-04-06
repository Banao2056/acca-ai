import { useState } from "react";

const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || "";
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "";
const IS_DEMO = !RAPIDAPI_KEY || RAPIDAPI_KEY === "YOUR_RAPIDAPI_KEY";

function getDateLabel(offset) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
}
function getDateStr(offset) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

// ─────────────────────────────────────────────
// 🌍 LEAGUES
// ─────────────────────────────────────────────
const LEAGUES = [
  { id:39,  name:"Premier League",    country:"England",     flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier:1, region:"Europe" },
  { id:140, name:"La Liga",           country:"Spain",       flag:"🇪🇸", tier:1, region:"Europe" },
  { id:78,  name:"Bundesliga",        country:"Germany",     flag:"🇩🇪", tier:1, region:"Europe" },
  { id:135, name:"Serie A",           country:"Italy",       flag:"🇮🇹", tier:1, region:"Europe" },
  { id:61,  name:"Ligue 1",           country:"France",      flag:"🇫🇷", tier:1, region:"Europe" },
  { id:2,   name:"Champions League",  country:"Europe",      flag:"🏆", tier:1, region:"Europe" },
  { id:3,   name:"Europa League",     country:"Europe",      flag:"🥈", tier:1, region:"Europe" },
  { id:848, name:"Conference League", country:"Europe",      flag:"🥉", tier:1, region:"Europe" },
  { id:40,  name:"Championship",      country:"England",     flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier:2, region:"Europe" },
  { id:88,  name:"Eredivisie",        country:"Netherlands", flag:"🇳🇱", tier:2, region:"Europe" },
  { id:94,  name:"Primeira Liga",     country:"Portugal",    flag:"🇵🇹", tier:2, region:"Europe" },
  { id:144, name:"Pro League",        country:"Belgium",     flag:"🇧🇪", tier:2, region:"Europe" },
  { id:203, name:"Super Lig",         country:"Turkey",      flag:"🇹🇷", tier:2, region:"Europe" },
  { id:271, name:"Superliga",         country:"Denmark",     flag:"🇩🇰", tier:2, region:"Europe" },
  { id:113, name:"Allsvenskan",       country:"Sweden",      flag:"🇸🇪", tier:2, region:"Europe" },
  { id:119, name:"Eliteserien",       country:"Norway",      flag:"🇳🇴", tier:2, region:"Europe" },
  { id:332, name:"NPFL",             country:"Nigeria",     flag:"🇳🇬", tier:2, region:"Africa" },
  { id:200, name:"Premier League",   country:"South Africa",flag:"🇿🇦", tier:2, region:"Africa" },
  { id:202, name:"Premier League",   country:"Egypt",       flag:"🇪🇬", tier:2, region:"Africa" },
  { id:233, name:"Botola Pro",       country:"Morocco",     flag:"🇲🇦", tier:2, region:"Africa" },
  { id:12,  name:"CAF Champions Lg", country:"Africa",      flag:"🌍", tier:1, region:"Africa" },
  { id:71,  name:"Serie A",          country:"Brazil",      flag:"🇧🇷", tier:1, region:"Americas" },
  { id:128, name:"Liga Profesional", country:"Argentina",   flag:"🇦🇷", tier:1, region:"Americas" },
  { id:262, name:"Liga MX",          country:"Mexico",      flag:"🇲🇽", tier:1, region:"Americas" },
  { id:253, name:"MLS",              country:"USA",         flag:"🇺🇸", tier:2, region:"Americas" },
  { id:13,  name:"Copa Libertadores",country:"S. America",  flag:"🏆", tier:1, region:"Americas" },
  { id:98,  name:"J-League",         country:"Japan",       flag:"🇯🇵", tier:2, region:"Asia" },
  { id:169, name:"K-League",         country:"S. Korea",    flag:"🇰🇷", tier:2, region:"Asia" },
  { id:307, name:"Saudi Pro League", country:"Saudi Arabia",flag:"🇸🇦", tier:1, region:"Asia" },
  { id:435, name:"UAE Pro League",   country:"UAE",         flag:"🇦🇪", tier:2, region:"Asia" },
  { id:1,   name:"World Cup",        country:"International",flag:"🌎", tier:1, region:"International" },
  { id:4,   name:"Euro Championship",country:"Europe",      flag:"🇪🇺", tier:1, region:"International" },
];

// ─────────────────────────────────────────────
// 🎯 MARKETS — 35 total
// ─────────────────────────────────────────────
const MARKETS = [
  // ── GOALS ──
  { id:"over05",        label:"Over 0.5 Goals",        short:"O0.5",    cat:"Goals",        winRate:91 },
  { id:"over15",        label:"Over 1.5 Goals",        short:"O1.5",    cat:"Goals",        winRate:74 },
  { id:"over25",        label:"Over 2.5 Goals",        short:"O2.5",    cat:"Goals",        winRate:51 },
  { id:"over35",        label:"Over 3.5 Goals",        short:"O3.5",    cat:"Goals",        winRate:29 },
  { id:"over45",        label:"Over 4.5 Goals",        short:"O4.5",    cat:"Goals",        winRate:12 },
  { id:"under15",       label:"Under 1.5 Goals",       short:"U1.5",    cat:"Goals",        winRate:21 },
  { id:"under25",       label:"Under 2.5 Goals",       short:"U2.5",    cat:"Goals",        winRate:36 },
  { id:"btts",          label:"BTTS Yes",              short:"GG",      cat:"Goals",        winRate:58 },
  { id:"btts_no",       label:"BTTS No",               short:"NG",      cat:"Goals",        winRate:32 },
  // ── RESULT ──
  { id:"home",          label:"Home Win",              short:"1",       cat:"Result",       winRate:54 },
  { id:"draw",          label:"Draw",                  short:"X",       cat:"Result",       winRate:26 },
  { id:"away",          label:"Away Win",              short:"2",       cat:"Result",       winRate:38 },
  { id:"home_draw",     label:"1X (Home or Draw)",     short:"1X",      cat:"Double Chance",winRate:68 },
  { id:"away_draw",     label:"X2 (Away or Draw)",     short:"X2",      cat:"Double Chance",winRate:65 },
  { id:"home_away",     label:"12 (Home or Away)",     short:"12",      cat:"Double Chance",winRate:63 },
  // ── SPECIAL ──
  { id:"dnb_home",      label:"Draw No Bet Home",      short:"DNB-H",   cat:"Special",      winRate:49 },
  { id:"dnb_away",      label:"Draw No Bet Away",      short:"DNB-A",   cat:"Special",      winRate:44 },
  { id:"cs_home",       label:"Clean Sheet Home",      short:"CS-H",    cat:"Special",      winRate:28 },
  { id:"cs_away",       label:"Clean Sheet Away",      short:"CS-A",    cat:"Special",      winRate:22 },
  { id:"htft_hh",       label:"HT/FT Home/Home",       short:"H/H",     cat:"HT/FT",        winRate:18 },
  // ── WIN EITHER HALF ──
  { id:"weh_home",      label:"Home Win Either Half",  short:"WEH-H",   cat:"Win Either Half", winRate:62 },
  { id:"weh_away",      label:"Away Win Either Half",  short:"WEH-A",   cat:"Win Either Half", winRate:48 },
  // ── HANDICAP ──
  { id:"ahc_home",      label:"Asian HDP Home (-0.5)", short:"AHC-H",   cat:"Handicap",     winRate:51 },
  { id:"ahc_away",      label:"Asian HDP Away (-0.5)", short:"AHC-A",   cat:"Handicap",     winRate:44 },
  { id:"ehc_home1",     label:"Euro HDP Home +1",      short:"EH+1H",   cat:"Handicap",     winRate:71 },
  { id:"ehc_away1",     label:"Euro HDP Away +1",      short:"EH+1A",   cat:"Handicap",     winRate:58 },
  // ── CORNERS ──
  { id:"corners_o8",    label:"Corners Over 8.5",      short:"C O8.5",  cat:"Corners",      winRate:55 },
  { id:"corners_o9",    label:"Corners Over 9.5",      short:"C O9.5",  cat:"Corners",      winRate:42 },
  { id:"corners_o10",   label:"Corners Over 10.5",     short:"C O10.5", cat:"Corners",      winRate:31 },
  { id:"corners_u8",    label:"Corners Under 8.5",     short:"C U8.5",  cat:"Corners",      winRate:45 },
  // ── BOOKINGS / CARDS ──
  { id:"cards_o3",      label:"Cards Over 3.5",        short:"Crd O3.5",cat:"Cards",        winRate:52 },
  { id:"cards_o4",      label:"Cards Over 4.5",        short:"Crd O4.5",cat:"Cards",        winRate:38 },
  { id:"cards_u3",      label:"Cards Under 3.5",       short:"Crd U3.5",cat:"Cards",        winRate:48 },
  // ── WIN & GOALS COMBOS ──
  { id:"home_over25",   label:"Home Win & Over 2.5",   short:"1&O2.5",  cat:"Combo",        winRate:36 },
  { id:"home_under25",  label:"Home Win & Under 2.5",  short:"1&U2.5",  cat:"Combo",        winRate:22 },
  { id:"away_over25",   label:"Away Win & Over 2.5",   short:"2&O2.5",  cat:"Combo",        winRate:24 },
  { id:"away_under25",  label:"Away Win & Under 2.5",  short:"2&U2.5",  cat:"Combo",        winRate:18 },
  { id:"home_btts",     label:"Home Win & BTTS",       short:"1&GG",    cat:"Combo",        winRate:31 },
  { id:"away_btts",     label:"Away Win & BTTS",       short:"2&GG",    cat:"Combo",        winRate:22 },
  // ── WIN OR GOALS COMBOS ──
  { id:"home_or_over25",label:"Home Win or Over 2.5",  short:"1/O2.5",  cat:"Win Or",       winRate:78 },
  { id:"home_or_btts",  label:"Home Win or BTTS",      short:"1/GG",    cat:"Win Or",       winRate:74 },
  { id:"away_or_over25",label:"Away Win or Over 2.5",  short:"2/O2.5",  cat:"Win Or",       winRate:71 },
  { id:"home_or_u25",   label:"Home Win or Under 2.5", short:"1/U2.5",  cat:"Win Or",       winRate:68 },
  { id:"away_or_u25",   label:"Away Win or Under 2.5", short:"2/U2.5",  cat:"Win Or",       winRate:65 },
];

const MARKET_CATS = ["Goals","Result","Double Chance","Special","HT/FT","Win Either Half","Handicap","Corners","Cards","Combo","Win Or"];

const LEG_WIN_RATES = {
  3:62,4:54,5:45,6:38,7:31,8:25,9:20,10:17,11:14,12:11,13:9,14:7,15:6,
  16:5,17:4,18:4,19:3,20:3,25:1,30:1,35:0.5,40:0.3,45:0.1,50:0.1
};

// ─────────────────────────────────────────────
// 🤖 PROBABILITY ENGINE — all 43 markets
// ─────────────────────────────────────────────
function getProb(m, mid) {
  const hp=m.homeProb, dp=m.drawProb, ap=m.awayProb;
  const btts=m.btts, o15=m.over15, o25=m.over25;
  const avgG=m.avgGoals||2.5;
  const cornersAvg=m.cornersAvg||9.5;
  const cardsAvg=m.cardsAvg||3.8;

  switch(mid) {
    // Goals
    case "over05":    return m.over05||96;
    case "over15":    return o15;
    case "over25":    return o25;
    case "over35":    return Math.max(o25-22,10);
    case "over45":    return Math.max(o25-36,5);
    case "under15":   return 100-o15;
    case "under25":   return 100-o25;
    case "btts":      return btts;
    case "btts_no":   return 100-btts;
    // Result
    case "home":      return hp;
    case "draw":      return dp;
    case "away":      return ap;
    // Double chance
    case "home_draw": return Math.min(hp+dp,97);
    case "away_draw": return Math.min(ap+dp,97);
    case "home_away": return Math.min(hp+ap,97);
    // Special
    case "dnb_home":  return Math.min(hp+dp*0.5,93);
    case "dnb_away":  return Math.min(ap+dp*0.5,93);
    case "cs_home":   return m.csHome||Math.round(hp*0.55);
    case "cs_away":   return m.csAway||Math.round(ap*0.5);
    case "htft_hh":   return Math.round(hp*0.62);
    // Win Either Half — prob that team scores first or scores more in one half
    case "weh_home":  return Math.min(Math.round(hp*1.18+o15*0.15),88);
    case "weh_away":  return Math.min(Math.round(ap*1.20+o15*0.12),76);
    // Handicap — Asian -0.5 = must win, Euro +1 = win or draw
    case "ahc_home":  return Math.round(hp*0.92);
    case "ahc_away":  return Math.round(ap*0.92);
    case "ehc_home1": return Math.min(Math.round(hp+dp*0.75),94);
    case "ehc_away1": return Math.min(Math.round(ap+dp*0.75),88);
    // Corners — based on league avg and game style
    case "corners_o8":  return cornersAvg>=10?72:cornersAvg>=9?58:45;
    case "corners_o9":  return cornersAvg>=10?61:cornersAvg>=9?47:34;
    case "corners_o10": return cornersAvg>=10?49:cornersAvg>=9?36:24;
    case "corners_u8":  return cornersAvg>=10?28:cornersAvg>=9?42:55;
    // Cards — based on league avg cards and derby nature
    case "cards_o3":  return cardsAvg>=4?64:cardsAvg>=3.5?52:40;
    case "cards_o4":  return cardsAvg>=4?48:cardsAvg>=3.5?36:26;
    case "cards_u3":  return cardsAvg>=4?36:cardsAvg>=3.5?48:60;
    // Win AND Over/Under (both must happen — multiply probs)
    case "home_over25":  return Math.round((hp/100)*(o25/100)*100*1.15);
    case "home_under25": return Math.round((hp/100)*((100-o25)/100)*100*1.15);
    case "away_over25":  return Math.round((ap/100)*(o25/100)*100*1.15);
    case "away_under25": return Math.round((ap/100)*((100-o25)/100)*100*1.15);
    case "home_btts":    return Math.round((hp/100)*(btts/100)*100*1.15);
    case "away_btts":    return Math.round((ap/100)*(btts/100)*100*1.15);
    // Win OR Over/Under (either can happen — union of probs)
    case "home_or_over25": return Math.min(Math.round(hp+o25-(hp*o25/100)),96);
    case "home_or_btts":   return Math.min(Math.round(hp+btts-(hp*btts/100)),96);
    case "away_or_over25": return Math.min(Math.round(ap+o25-(ap*o25/100)),96);
    case "home_or_u25":    return Math.min(Math.round(hp+(100-o25)-(hp*(100-o25)/100)),96);
    case "away_or_u25":    return Math.min(Math.round(ap+(100-o25)-(ap*(100-o25)/100)),96);
    default: return hp;
  }
}

function formScore(f) {
  if(!f)return 0.5;
  return f.slice(-5).split("").reduce((s,c)=>s+(c==="W"?3:c==="D"?1:0),0)/15;
}
function getAIScore(m, mid) {
  const prob=getProb(m,mid)/100;
  const conf=(m.confidence||70)/100;
  const form=(formScore(m.form?.home)+formScore(m.form?.away))/2;
  const bookP=m.homeOdd?1/m.homeOdd:prob;
  const value=Math.min(Math.max(prob-bookP,0)/0.15,1);
  const lg=LEAGUES.find(l=>l.id===m.league);
  const tier=lg?(4-(lg.tier||2))/3:0.33;
  return Math.min(Math.round((prob*0.38+conf*0.22+form*0.20+value*0.10+tier*0.10)*100),99);
}
function getBestMarket(m, allowed) {
  let best=allowed[0],bestScore=0;
  for(const mid of allowed){const s=getAIScore(m,mid);if(s>bestScore){bestScore=s;best=mid;}}
  return {mid:best,score:bestScore,prob:getProb(m,best)};
}

// ─────────────────────────────────────────────
// 📦 DEMO DATA — enriched with corners & cards
// ─────────────────────────────────────────────
const DEMO=[
  {id:1, home:"Arsenal",       away:"Chelsea",        league:39,  leagueName:"Premier League",   flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", time:"15:00",date:getDateStr(0),homeProb:63,drawProb:21,awayProb:16,btts:71,over15:88,over25:67,confidence:89,homeOdd:1.62,drawOdd:3.90,awayOdd:5.20,csHome:38,csAway:14,cornersAvg:10.8,cardsAvg:4.1,form:{home:"WWDWW",away:"LWDLW"},avgGoals:2.8,h2h:"Arsenal won 3 of last 5"},
  {id:2, home:"Real Madrid",   away:"Barcelona",      league:140, leagueName:"La Liga",          flag:"🇪🇸", time:"20:00",date:getDateStr(0),homeProb:48,drawProb:27,awayProb:25,btts:78,over15:91,over25:74,confidence:82,homeOdd:2.10,drawOdd:3.40,awayOdd:3.60,csHome:22,csAway:18,cornersAvg:11.2,cardsAvg:4.8,form:{home:"WWWDW",away:"WLWWW"},avgGoals:3.2,h2h:"El Clasico avg 3.4 goals"},
  {id:3, home:"Bayern Munich", away:"Dortmund",       league:78,  leagueName:"Bundesliga",       flag:"🇩🇪", time:"17:30",date:getDateStr(0),homeProb:57,drawProb:23,awayProb:20,btts:65,over15:93,over25:72,confidence:91,homeOdd:1.85,drawOdd:3.70,awayOdd:4.10,csHome:32,csAway:16,cornersAvg:10.4,cardsAvg:3.6,form:{home:"WWWWW",away:"WDWLW"},avgGoals:3.1,h2h:"Bayern unbeaten last 6 home"},
  {id:4, home:"Juventus",      away:"Inter Milan",    league:135, leagueName:"Serie A",          flag:"🇮🇹", time:"19:45",date:getDateStr(0),homeProb:42,drawProb:31,awayProb:27,btts:58,over15:79,over25:55,confidence:76,homeOdd:2.40,drawOdd:3.20,awayOdd:3.10,csHome:28,csAway:25,cornersAvg:9.1,cardsAvg:4.5,form:{home:"DWWLD",away:"WWDWL"},avgGoals:2.1,h2h:"3 of 5 H2H drew"},
  {id:5, home:"PSG",           away:"Marseille",      league:61,  leagueName:"Ligue 1",          flag:"🇫🇷", time:"21:00",date:getDateStr(0),homeProb:72,drawProb:17,awayProb:11,btts:62,over15:90,over25:69,confidence:94,homeOdd:1.40,drawOdd:4.50,awayOdd:7.00,csHome:41,csAway:10,cornersAvg:10.1,cardsAvg:5.2,form:{home:"WWWWW",away:"LWLLW"},avgGoals:2.9,h2h:"PSG won 5 of 5 home"},
  {id:6, home:"Man City",      away:"Liverpool",      league:39,  leagueName:"Premier League",   flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", time:"16:30",date:getDateStr(1),homeProb:44,drawProb:26,awayProb:30,btts:73,over15:89,over25:71,confidence:87,homeOdd:2.30,drawOdd:3.40,awayOdd:3.10,csHome:20,csAway:22,cornersAvg:11.5,cardsAvg:3.9,form:{home:"WWLWW",away:"WWWDW"},avgGoals:3.0,h2h:"4 of 5 had BTTS"},
  {id:7, home:"Ajax",          away:"PSV",            league:88,  leagueName:"Eredivisie",       flag:"🇳🇱", time:"14:30",date:getDateStr(1),homeProb:52,drawProb:24,awayProb:24,btts:69,over15:92,over25:76,confidence:80,homeOdd:2.00,drawOdd:3.50,awayOdd:3.80,csHome:24,csAway:21,cornersAvg:10.7,cardsAvg:3.4,form:{home:"WWDWL",away:"WWWWL"},avgGoals:3.4,h2h:"Avg 3.8 goals in H2H"},
  {id:8, home:"Porto",         away:"Benfica",        league:94,  leagueName:"Primeira Liga",    flag:"🇵🇹", time:"20:15",date:getDateStr(1),homeProb:46,drawProb:28,awayProb:26,btts:61,over15:83,over25:59,confidence:77,homeOdd:2.20,drawOdd:3.30,awayOdd:3.60,csHome:28,csAway:24,cornersAvg:9.3,cardsAvg:4.1,form:{home:"WLWWW",away:"WWDWW"},avgGoals:2.5,h2h:"Tight derby"},
  {id:9, home:"Atletico",      away:"Sevilla",        league:140, leagueName:"La Liga",          flag:"🇪🇸", time:"18:00",date:getDateStr(1),homeProb:59,drawProb:25,awayProb:16,btts:48,over15:75,over25:52,confidence:79,homeOdd:1.75,drawOdd:3.60,awayOdd:4.80,csHome:42,csAway:12,cornersAvg:8.8,cardsAvg:4.7,form:{home:"WWWDW",away:"LLDWL"},avgGoals:1.9,h2h:"Atletico 3 CS in 5"},
  {id:10,home:"Napoli",        away:"AC Milan",       league:135, leagueName:"Serie A",          flag:"🇮🇹", time:"20:45",date:getDateStr(2),homeProb:50,drawProb:27,awayProb:23,btts:66,over15:85,over25:63,confidence:83,homeOdd:2.00,drawOdd:3.30,awayOdd:3.90,csHome:26,csAway:20,cornersAvg:9.6,cardsAvg:4.3,form:{home:"WDWWL",away:"WWLDW"},avgGoals:2.6,h2h:"BTTS in 4 of 5"},
  {id:11,home:"Al-Hilal",      away:"Al-Nassr",       league:307, leagueName:"Saudi Pro League", flag:"🇸🇦", time:"19:00",date:getDateStr(2),homeProb:54,drawProb:26,awayProb:20,btts:59,over15:82,over25:61,confidence:75,homeOdd:1.90,drawOdd:3.50,awayOdd:4.30,csHome:30,csAway:18,cornersAvg:9.0,cardsAvg:4.0,form:{home:"WWWDW",away:"LWWDW"},avgGoals:2.7,h2h:"Saudi derby"},
  {id:12,home:"Flamengo",      away:"Palmeiras",      league:71,  leagueName:"Brasileirao",      flag:"🇧🇷", time:"22:00",date:getDateStr(2),homeProb:45,drawProb:28,awayProb:27,btts:63,over15:80,over25:57,confidence:73,homeOdd:2.30,drawOdd:3.20,awayOdd:3.40,csHome:22,csAway:20,cornersAvg:9.2,cardsAvg:4.4,form:{home:"DWWLW",away:"WLWWL"},avgGoals:2.3,h2h:"Tight matches"},
  {id:13,home:"Boca Juniors",  away:"River Plate",    league:128, leagueName:"Liga Profesional", flag:"🇦🇷", time:"21:00",date:getDateStr(3),homeProb:43,drawProb:30,awayProb:27,btts:60,over15:78,over25:54,confidence:71,homeOdd:2.40,drawOdd:3.10,awayOdd:3.20,csHome:20,csAway:18,cornersAvg:8.7,cardsAvg:5.1,form:{home:"LDWWW",away:"WWDLW"},avgGoals:2.2,h2h:"Superclasico"},
  {id:14,home:"Enugu Rangers", away:"Enyimba",        league:332, leagueName:"NPFL Nigeria",     flag:"🇳🇬", time:"16:00",date:getDateStr(4),homeProb:47,drawProb:29,awayProb:24,btts:52,over15:70,over25:45,confidence:65,homeOdd:2.20,drawOdd:3.10,awayOdd:3.60,csHome:30,csAway:24,cornersAvg:7.4,cardsAvg:3.8,form:{home:"WDWLW",away:"LWDWL"},avgGoals:1.7,h2h:"Strong home advantage"},
  {id:15,home:"Kaizer Chiefs", away:"Orlando Pirates",league:200, leagueName:"PSL South Africa", flag:"🇿🇦", time:"15:30",date:getDateStr(5),homeProb:41,drawProb:32,awayProb:27,btts:55,over15:72,over25:48,confidence:68,homeOdd:2.50,drawOdd:3.00,awayOdd:3.30,csHome:26,csAway:22,cornersAvg:7.9,cardsAvg:4.2,form:{home:"WLDLW",away:"DLWWL"},avgGoals:1.8,h2h:"Soweto Derby"},
  {id:16,home:"Club America",  away:"Chivas",         league:262, leagueName:"Liga MX",          flag:"🇲🇽", time:"22:00",date:getDateStr(6),homeProb:48,drawProb:28,awayProb:24,btts:61,over15:81,over25:58,confidence:74,homeOdd:2.15,drawOdd:3.20,awayOdd:3.70,csHome:26,csAway:22,cornersAvg:9.4,cardsAvg:4.0,form:{home:"WWLWW",away:"DWLWL"},avgGoals:2.4,h2h:"Mexican clasico"},
];

// ─────────────────────────────────────────────
// 🎨 COMPONENTS
// ─────────────────────────────────────────────
const Spin=({size=16,color="#00ff88"})=><span style={{width:size,height:size,border:`2px solid ${color}33`,borderTopColor:color,borderRadius:"50%",display:"inline-block",animation:"spin .7s linear infinite",flexShrink:0}}/>;
const Bar=({val,color})=>{const c=color||(val>=70?"#00ff88":val>=50?"#f0c040":"#ff6b6b");return<div style={{height:4,background:"rgba(255,255,255,.06)",borderRadius:99,overflow:"hidden"}}><div style={{width:`${Math.min(val,100)}%`,height:"100%",background:c,borderRadius:99,transition:"width 1s ease"}}/></div>;};
const Tag=({children,color="#00ff88"})=><span style={{background:`${color}18`,border:`1px solid ${color}40`,color,fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:99,whiteSpace:"nowrap"}}>{children}</span>;
const FD=({r})=>{const bg=r==="W"?"#00ff88":r==="D"?"#f0c040":"#ff6b6b";return<span style={{width:16,height:16,borderRadius:4,background:bg,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,color:"#000"}}>{r}</span>;};

function MatchCard({m,bestMid,bestProb,bestScore,idx}){
  const [open,setOpen]=useState(false);
  const mkt=MARKETS.find(x=>x.id===bestMid);
  const pc=bestProb>=68?"#00ff88":bestProb>=50?"#f0c040":"#ff6b6b";
  const sc=bestScore>=75?"#00ff88":bestScore>=55?"#f0c040":"#ff6b6b";
  return(
    <div style={{animation:`fadeUp .3s ease ${idx*.04}s both`,marginBottom:10}}>
      <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:16,overflow:"hidden"}}>
        <div style={{padding:"13px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{flex:1,paddingRight:8}}>
              <div style={{fontSize:10,color:"#444",marginBottom:4}}>{m.flag} {m.leagueName} · {m.time}</div>
              <div style={{fontSize:14,fontWeight:800,color:"#eee",lineHeight:1.2}}>{m.home}</div>
              <div style={{fontSize:10,color:"#333",margin:"3px 0"}}>vs</div>
              <div style={{fontSize:14,fontWeight:800,color:"#eee"}}>{m.away}</div>
              <div style={{marginTop:6,display:"inline-flex",alignItems:"center",gap:4,background:"rgba(167,139,250,.1)",border:"1px solid rgba(167,139,250,.2)",borderRadius:8,padding:"3px 8px"}}>
                <span style={{fontSize:9,color:"#a78bfa"}}>🤖 AI picks:</span>
                <span style={{fontSize:10,fontWeight:800,color:"#a78bfa"}}>{mkt?.label}</span>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
              <div style={{background:`${pc}15`,border:`1px solid ${pc}35`,borderRadius:10,padding:"6px 10px",textAlign:"center",minWidth:58}}>
                <div style={{fontSize:20,fontWeight:900,color:pc,fontFamily:"monospace",lineHeight:1}}>{bestProb}%</div>
                <div style={{fontSize:8,color:"#444",marginTop:2}}>{mkt?.short}</div>
              </div>
            </div>
          </div>
          {/* 1X2 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:10}}>
            {[["1 HOME",m.homeOdd,m.homeProb],["X DRAW",m.drawOdd,m.drawProb],["2 AWAY",m.awayOdd,m.awayProb]].map(([l,o,p])=>(
              <div key={l} style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"6px 4px",textAlign:"center"}}>
                <div style={{fontSize:8,color:"#333"}}>{l}</div>
                <div style={{fontSize:13,fontWeight:900,color:"#ddd"}}>{o?.toFixed(2)}</div>
                <div style={{fontSize:9,color:"#444"}}>{p}%</div>
              </div>
            ))}
          </div>
          {/* Extra stats row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:10}}>
            {[["Corners",m.cornersAvg||"?"],["Cards avg",m.cardsAvg||"?"],["Avg goals",m.avgGoals||"?"]].map(([l,v])=>(
              <div key={l} style={{background:"rgba(255,255,255,.03)",borderRadius:7,padding:"5px 4px",textAlign:"center"}}>
                <div style={{fontSize:8,color:"#2a2a2a"}}>{l}</div>
                <div style={{fontSize:11,fontWeight:800,color:"#888"}}>{v}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:9,color:"#333"}}>AI SCORE</span>
              <span style={{fontSize:9,fontWeight:800,color:sc}}>{bestScore}/100</span>
            </div>
            <Bar val={bestScore} color={sc}/>
          </div>
        </div>
        <button onClick={()=>setOpen(!open)} style={{width:"100%",background:"rgba(255,255,255,.02)",border:"none",borderTop:"1px solid rgba(255,255,255,.04)",color:"#2a2a2a",fontSize:9,cursor:"pointer",padding:"7px"}}>
          {open?"▲ HIDE":"▼ ALL 43 MARKETS"}
        </button>
        {open&&(
          <div style={{padding:"12px 14px",borderTop:"1px solid rgba(255,255,255,.04)",animation:"fadeUp .2s ease"}}>
            {MARKET_CATS.map(cat=>{
              const mkts=MARKETS.filter(mk=>mk.cat===cat);
              return(
                <div key={cat} style={{marginBottom:12}}>
                  <div style={{fontSize:9,color:"#444",letterSpacing:.5,marginBottom:6}}>{cat.toUpperCase()}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
                    {mkts.map(mk=>{
                      const p=getProb(m,mk.id);
                      const chosen=mk.id===bestMid;
                      return(
                        <div key={mk.id} style={{background:chosen?"rgba(167,139,250,.1)":"rgba(255,255,255,.02)",border:chosen?"1px solid rgba(167,139,250,.3)":"1px solid transparent",borderRadius:7,padding:"4px 7px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:9,color:chosen?"#a78bfa":"#3a3a3a"}}>{mk.label}{chosen?" 🤖":""}</span>
                          <span style={{fontSize:10,fontWeight:800,color:p>=65?"#00ff88":p>=45?"#f0c040":"#ff6b6b"}}>{p}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
              {[["HOME",m.form?.home],["AWAY",m.form?.away]].map(([s,f])=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:9,color:"#333",width:36}}>{s}</span>
                  <div style={{display:"flex",gap:3}}>{(f||"WDLWW").slice(-5).split("").map((r,i)=><FD key={i} r={r}/>)}</div>
                </div>
              ))}
            </div>
            {m.h2h&&<div style={{marginTop:8,background:"rgba(167,139,250,.07)",border:"1px solid rgba(167,139,250,.15)",borderRadius:8,padding:"7px 10px",fontSize:10,color:"#a78bfa"}}>📊 {m.h2h}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 🏠 MAIN APP
// ─────────────────────────────────────────────
export default function WinSmart(){
  const [tab,setTab]=useState("build");
  const [legs,setLegs]=useState(3);
  const [allowedMarkets,setAllowedMarkets]=useState(["over15","home","home_draw","btts","over25","away_draw","weh_home","home_or_over25"]);
  const [mcat,setMcat]=useState("Goals");
  const [selectedDays,setSelectedDays]=useState([0,1]);
  const [minProb,setMinProb]=useState(55);
  const [minAI,setMinAI]=useState(45);
  const [valueMode,setValueMode]=useState(false);
  const [selLeagues,setSelLeagues]=useState(LEAGUES.filter(l=>l.tier===1).map(l=>l.id));
  const [showLeagues,setShowLeagues]=useState(false);
  const [leagueSearch,setLeagueSearch]=useState("");
  const [region,setRegion]=useState("All");
  const [picks,setPicks]=useState([]);
  const [generating,setGenerating]=useState(false);
  const [aiText,setAiText]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [history,setHistory]=useState([]);
  const [copied,setCopied]=useState(false);
  const [showLegTable,setShowLegTable]=useState(false);

  const toggleMarket=mid=>setAllowedMarkets(p=>p.includes(mid)?p.length>1?p.filter(x=>x!==mid):p:[...p,mid]);
  const toggleDay=d=>setSelectedDays(p=>p.includes(d)?p.length>1?p.filter(x=>x!==d):p:[...p,d]);
  const toggleLeague=id=>setSelLeagues(p=>p.includes(id)?p.length>1?p.filter(x=>x!==id):p:[...p,id]);

  const filtered=DEMO.filter(m=>{
    const lg=LEAGUES.find(l=>l.id===m.league);
    const inRegion=region==="All"||(lg?.region===region);
    const inLeague=selLeagues.includes(m.league);
    const inDay=selectedDays.some(d=>getDateStr(d)===m.date);
    const best=getBestMarket(m,allowedMarkets);
    return inLeague&&inRegion&&inDay&&best.prob>=minProb&&best.score>=minAI;
  });

  const combinedOdds=picks.reduce((a,p)=>a*(1/Math.max(p.prob/100,0.01)),1);
  const winChance=picks.reduce((a,p)=>a*(p.prob/100),1)*100;
  const avgAI=picks.length?Math.round(picks.reduce((a,p)=>a+p.score,0)/picks.length):0;
  const expectedWR=LEG_WIN_RATES[legs]||"<0.1";

  const autoGenerate=async()=>{
    if(!filtered.length)return;
    setGenerating(true);setPicks([]);setAiText("");
    await new Promise(r=>setTimeout(r,700));
    const scored=filtered.map(m=>{const b=getBestMarket(m,allowedMarkets);return{...m,_mid:b.mid,_prob:b.prob,_score:b.score};}).sort((a,b)=>b._score-a._score);
    const np=scored.slice(0,legs).map(m=>({match:m,mid:m._mid,prob:m._prob,score:m._score,mktLabel:MARKETS.find(x=>x.id===m._mid)?.label||m._mid}));
    setPicks(np);setGenerating(false);
    const odds=np.reduce((a,p)=>a*(1/Math.max(p.prob/100,0.01)),1);
    setHistory(prev=>[{date:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"}),legs,result:"Pending",odds:odds.toFixed(2),picks:np.map(p=>`${p.match.home} vs ${p.match.away} — ${p.mktLabel}`),...prev.slice(0,19)}]);
    setAiLoading(true);
    try{
      if(!ANTHROPIC_KEY)throw new Error("NO_KEY");
      const detail=np.map(p=>`${p.match.home} vs ${p.match.away} [${p.match.leagueName}] — AI chose: ${p.mktLabel} (${p.prob}%, score ${p.score}/100), form H:${p.match.form?.home} A:${p.match.form?.away}, avgGoals:${p.match.avgGoals}, corners avg:${p.match.cornersAvg}, cards avg:${p.match.cardsAvg}, H2H:${p.match.h2h||"N/A"}`).join("\n");
      const wc=np.reduce((a,p)=>a*(p.prob/100),1)*100;
      const co=np.reduce((a,p)=>a*(1/Math.max(p.prob/100,0.01)),1);
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1400,messages:[{role:"user",content:`You are a world-class football betting analyst with expertise in all markets including goals, corners, bookings, handicaps, win either half and combo markets. The AI engine automatically selected the BEST market for each match. Analyse this ${legs}-leg mixed-market accumulator:\n\n${detail}\n\nCombined odds: ${co.toFixed(2)}x | Win probability: ${wc.toFixed(1)}% | Historical ${legs}-leg win rate: ${expectedWR}% | Avg AI score: ${avgAI}/100\n\nWrite sharp expert analysis in 4 sections:\n🎯 PICK ANALYSIS — why AI chose each specific market for each match\n⚠️ RISK FACTORS — key risks per pick\n📊 ACCA OVERVIEW — overall quality and market mix\n✅ VERDICT — confidence /10, stake units 1-5, one final sharp tip\n\nBe direct, expert. Reference corners/cards data where relevant.`}]})});
      const data=await res.json();
      if(data.error)throw new Error(data.error.message);
      setAiText(data.content?.map(c=>c.text||"").join("")||"Analysis unavailable.");
    }catch(e){
      if(!ANTHROPIC_KEY||e.message==="NO_KEY")setAiText("⚠️ Anthropic key missing.\n\nFix: Vercel → your project → Settings → Environment Variables → add VITE_ANTHROPIC_KEY → Redeploy.");
      else setAiText("⚠️ AI error: "+e.message);
    }
    setAiLoading(false);
  };

  const formatPicks=()=>picks.map((p,i)=>`${i+1}. ${p.match.home} vs ${p.match.away}\n   ✅ ${p.mktLabel} — ${p.prob}%\n   ${p.match.leagueName} · ${p.match.time}`).join("\n\n");
  const sharePicks=()=>{navigator.clipboard?.writeText(`🏆 WinSmart ${legs}-Leg Smart Acca\n\n${formatPicks()}\n\n💰 Odds: ${combinedOdds.toFixed(2)}x | Win: ${winChance.toFixed(1)}%\n\n🔗 acca-ai.vercel.app`);setCopied(true);setTimeout(()=>setCopied(false),3000);};
  const shareWhatsApp=()=>{const t=encodeURIComponent(`🏆 WinSmart ${legs}-Leg Acca\n\n${formatPicks()}\n\n💰 Odds: ${combinedOdds.toFixed(2)}x\n\nacca-ai.vercel.app`);window.open(`https://wa.me/?text=${t}`,"_blank");};

  const PRESETS=[
    {label:"🥅 Safe Goals",  ids:["over05","over15","btts","home_or_over25"]},
    {label:"🏆 Results",     ids:["home","home_draw","away_draw","dnb_home","weh_home"]},
    {label:"🎪 Combo Mix",   ids:["home_or_over25","home_or_btts","away_or_over25","home_over25","home_btts"]},
    {label:"📐 Handicap",    ids:["ahc_home","ahc_away","ehc_home1","ehc_away1"]},
    {label:"⚽ Corners",     ids:["corners_o8","corners_o9","corners_o10","corners_u8"]},
    {label:"🟨 Cards",       ids:["cards_o3","cards_o4","cards_u3"]},
    {label:"⚡ AI Best Mix", ids:["over15","home","home_draw","btts","over25","away_draw","weh_home","home_or_over25","corners_o9","cards_o3"]},
    {label:"🎯 All 43",      ids:MARKETS.map(m=>m.id)},
  ];

  return(
    <div style={{minHeight:"100vh",background:"#06080d",fontFamily:"'DM Sans',sans-serif",color:"#fff",maxWidth:460,margin:"0 auto"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&family=DM+Mono:wght@500&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes glow{0%,100%{box-shadow:0 0 24px rgba(0,255,136,.25)}50%{box-shadow:0 0 44px rgba(0,255,136,.55)}}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:1}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(0,255,136,.2);border-radius:99px}
        input[type=range]{-webkit-appearance:none;background:transparent;width:100%;cursor:pointer}
        input[type=range]::-webkit-slider-runnable-track{height:4px;background:rgba(255,255,255,.07);border-radius:99px}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#00ff88;margin-top:-8px;box-shadow:0 0 10px #00ff8866}
        button,input{font-family:inherit}
      `}</style>

      {/* HEADER */}
      <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(6,8,13,.96)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,.05)",padding:"12px 14px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:11,background:"linear-gradient(135deg,#00ff88,#00aa55)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>⚡</div>
            <div>
              <div style={{fontSize:19,fontWeight:900,letterSpacing:-1,lineHeight:1}}>Win<span style={{color:"#00ff88"}}>Smart</span></div>
              <div style={{fontSize:9,color:"#2a2a2a",letterSpacing:.5}}>43 MARKETS · 32 LEAGUES · AI ENGINE</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <Tag color="#a78bfa">PRO</Tag>
            <Tag color={IS_DEMO?"#f0c040":"#00ff88"}>{IS_DEMO?"DEMO":"LIVE"}</Tag>
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
          <div style={{display:"flex",flexDirection:"column",gap:12,animation:"fadeUp .3s ease"}}>

            {IS_DEMO&&<div style={{background:"rgba(240,192,64,.06)",border:"1px solid rgba(240,192,64,.15)",borderRadius:12,padding:"10px 13px",fontSize:11,color:"#f0c04099"}}>⚡ Demo mode · Add VITE_RAPIDAPI_KEY in Vercel for real live data</div>}

            {/* LEGS */}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:9,color:"#333",letterSpacing:1}}>LEGS <span style={{color:"#00ff88"}}>(3–50)</span></div>
                <div style={{fontSize:10,color:"#555"}}>Win rate: <span style={{color:"#f0c040",fontWeight:800}}>{expectedWR}%</span></div>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                {[3,4,5,6,8,10,12,15,20,25,30,40,50].map(n=>(
                  <button key={n} onClick={()=>{setLegs(n);setPicks([]);}} style={{padding:"6px 11px",borderRadius:9,border:"none",background:legs===n?"#00ff88":"rgba(255,255,255,.06)",color:legs===n?"#000":"#555",fontSize:12,fontWeight:900,cursor:"pointer"}}>{n}</button>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input type="number" min={3} max={50} value={legs} onChange={e=>{setLegs(Math.min(50,Math.max(3,+e.target.value)));setPicks([]);}} style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,padding:"7px 12px",color:"#fff",fontSize:13,outline:"none"}} placeholder="Custom 3-50"/>
                <button onClick={()=>setShowLegTable(!showLegTable)} style={{padding:"7px 12px",borderRadius:9,border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.04)",color:"#555",fontSize:10,fontWeight:700,cursor:"pointer"}}>{showLegTable?"Hide":"Win %"}</button>
              </div>
              {showLegTable&&(
                <div style={{marginTop:10,maxHeight:160,overflowY:"auto"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                    {Object.entries(LEG_WIN_RATES).map(([l,r])=>(
                      <div key={l} onClick={()=>{setLegs(+l);setPicks([]);}} style={{background:+l===legs?"rgba(0,255,136,.12)":"rgba(255,255,255,.03)",borderRadius:7,padding:"5px 6px",cursor:"pointer",textAlign:"center"}}>
                        <div style={{fontSize:9,color:"#444"}}>{l}-leg</div>
                        <div style={{fontSize:11,fontWeight:800,color:r>=40?"#00ff88":r>=15?"#f0c040":"#ff6b6b"}}>{r}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* DATE FILTER */}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
              <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:10}}>MATCH DATES <span style={{color:"#00ff88"}}>· SELECT ANY COMBINATION</span></div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                {[0,1,2,3,4,5,6].map(d=>(
                  <button key={d} onClick={()=>toggleDay(d)} style={{padding:"6px 12px",borderRadius:10,border:"none",background:selectedDays.includes(d)?"#00ff88":"rgba(255,255,255,.06)",color:selectedDays.includes(d)?"#000":"#555",fontSize:11,fontWeight:800,cursor:"pointer",transition:"all .18s"}}>{getDateLabel(d)}</button>
                ))}
                <button onClick={()=>setSelectedDays([0,1,2,3,4,5,6])} style={{padding:"6px 12px",borderRadius:10,border:"none",background:"rgba(0,255,136,.1)",color:"#00ff88",fontSize:11,fontWeight:800,cursor:"pointer"}}>All 7</button>
              </div>
              <div style={{fontSize:10,color:"#333"}}>Showing: <span style={{color:"#00ff88"}}>{selectedDays.map(d=>getDateLabel(d)).join(", ")}</span></div>
            </div>

            {/* MARKETS — 43 total */}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
              <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:6}}>MARKETS <span style={{color:"#00ff88"}}>· 43 TYPES · SELECT MULTIPLE</span></div>
              <div style={{fontSize:10,color:"#a78bfa",marginBottom:10,padding:"6px 10px",background:"rgba(167,139,250,.07)",borderRadius:8}}>🤖 AI picks the single best market per match from your selection</div>

              {/* Category tabs */}
              <div style={{display:"flex",gap:3,marginBottom:10,flexWrap:"wrap"}}>
                {MARKET_CATS.map(cat=>(
                  <button key={cat} onClick={()=>setMcat(cat)} style={{padding:"4px 9px",borderRadius:8,border:"none",background:mcat===cat?"rgba(167,139,250,.2)":"rgba(255,255,255,.05)",color:mcat===cat?"#a78bfa":"#444",fontSize:10,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>{cat}</button>
                ))}
              </div>

              {/* Markets in selected category */}
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
                {MARKETS.filter(m=>m.cat===mcat).map(m=>{
                  const on=allowedMarkets.includes(m.id);
                  return(
                    <button key={m.id} onClick={()=>toggleMarket(m.id)} style={{padding:"6px 10px",borderRadius:8,border:"none",background:on?"rgba(0,255,136,.15)":"rgba(255,255,255,.04)",color:on?"#00ff88":"#555",fontSize:11,fontWeight:700,cursor:"pointer",outline:on?"1px solid rgba(0,255,136,.35)":"none",transition:"all .15s"}}>
                      {m.label} <span style={{fontSize:8,color:on?"#00ff8877":"#2a2a2a"}}>·{m.winRate}%</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected summary */}
              <div style={{padding:"8px 10px",background:"rgba(0,255,136,.05)",borderRadius:9,border:"1px solid rgba(0,255,136,.1)",marginBottom:10}}>
                <div style={{fontSize:9,color:"#333",marginBottom:5}}>SELECTED ({allowedMarkets.length} markets)</div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{allowedMarkets.map(mid=>{const m=MARKETS.find(x=>x.id===mid);return<Tag key={mid} color="#00ff88">{m?.short}</Tag>;})}</div>
              </div>

              {/* Presets */}
              <div style={{fontSize:9,color:"#333",marginBottom:6}}>QUICK PRESETS:</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {PRESETS.map(g=>(
                  <button key={g.label} onClick={()=>setAllowedMarkets(g.ids)} style={{padding:"5px 10px",borderRadius:8,border:"none",background:"rgba(255,255,255,.05)",color:"#555",fontSize:10,fontWeight:700,cursor:"pointer"}}>{g.label}</button>
                ))}
              </div>
            </div>

            {/* FILTERS */}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14,display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontSize:9,color:"#333",letterSpacing:1}}>AI FILTERS</div>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:11,color:"#666"}}>Min Probability</span><span style={{fontSize:18,fontWeight:900,color:"#00ff88",fontFamily:"DM Mono,monospace"}}>{minProb}%</span></div>
                <input type="range" min={30} max={92} value={minProb} onChange={e=>setMinProb(+e.target.value)}/>
              </div>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:11,color:"#666"}}>Min AI Score</span><span style={{fontSize:18,fontWeight:900,color:"#a78bfa",fontFamily:"DM Mono,monospace"}}>{minAI}/100</span></div>
                <input type="range" min={0} max={90} value={minAI} onChange={e=>setMinAI(+e.target.value)}/>
              </div>
              <div onClick={()=>setValueMode(!valueMode)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:10,cursor:"pointer"}}>
                <div><div style={{fontSize:11,color:"#888",fontWeight:700}}>Value Edge Mode</div><div style={{fontSize:9,color:"#333"}}>Only picks where prob beats bookmaker</div></div>
                <div style={{width:40,height:22,borderRadius:99,background:valueMode?"#00ff88":"rgba(255,255,255,.08)",position:"relative",transition:"background .2s",flexShrink:0}}><div style={{position:"absolute",top:3,left:valueMode?21:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/></div>
              </div>
            </div>

            {/* LEAGUES */}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:9,color:"#333",letterSpacing:1}}>LEAGUES</div>
                <button onClick={()=>setShowLeagues(!showLeagues)} style={{background:"none",border:"none",color:"#444",fontSize:10,fontWeight:700,cursor:"pointer"}}>{showLeagues?"▲ HIDE":"▼ BROWSE"}</button>
              </div>
              <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
                {["All","Europe","Africa","Americas","Asia"].map(r=>(
                  <button key={r} onClick={()=>setRegion(r)} style={{padding:"4px 10px",borderRadius:8,border:"none",background:region===r?"rgba(0,255,136,.12)":"rgba(255,255,255,.04)",color:region===r?"#00ff88":"#444",fontSize:10,fontWeight:700,cursor:"pointer"}}>{r}</button>
                ))}
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                {[{label:"🏆 Top 5 EU",ids:[39,140,78,135,61]},{label:"🌍 Africa",ids:[332,200,202,233,12]},{label:"✅ All",ids:LEAGUES.map(l=>l.id)}].map(g=>(
                  <button key={g.label} onClick={()=>setSelLeagues(g.ids)} style={{padding:"5px 10px",borderRadius:8,border:"none",background:"rgba(255,255,255,.05)",color:"#555",fontSize:10,fontWeight:700,cursor:"pointer"}}>{g.label}</button>
                ))}
              </div>
              {showLeagues&&(
                <div>
                  <input type="text" placeholder="Search leagues..." value={leagueSearch} onChange={e=>setLeagueSearch(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.07)",borderRadius:9,padding:"8px 12px",color:"#fff",fontSize:12,marginBottom:8,outline:"none"}}/>
                  <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:220,overflowY:"auto"}}>
                    {LEAGUES.filter(l=>{const inR=region==="All"||l.region===region;const inS=l.name.toLowerCase().includes(leagueSearch.toLowerCase())||l.country.toLowerCase().includes(leagueSearch.toLowerCase());return inR&&inS;}).map(l=>(
                      <div key={l.id+l.name} onClick={()=>toggleLeague(l.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 10px",borderRadius:9,cursor:"pointer",background:selLeagues.includes(l.id)?"rgba(0,255,136,.08)":"rgba(255,255,255,.02)",border:selLeagues.includes(l.id)?"1px solid rgba(0,255,136,.2)":"1px solid transparent"}}>
                        <span style={{fontSize:12,color:selLeagues.includes(l.id)?"#00ff88":"#555"}}>{l.flag} {l.name} <span style={{color:"#2a2a2a",fontSize:10}}>· {l.country}</span></span>
                        {selLeagues.includes(l.id)&&<span style={{fontSize:10,color:"#00ff88"}}>✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{fontSize:10,color:"#222",marginTop:8}}>{selLeagues.length} leagues selected</div>
            </div>

            {/* MATCHES */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:9,color:"#333",letterSpacing:1}}>AVAILABLE <span style={{color:"#00ff88"}}>({filtered.length})</span></div>
              </div>
              {filtered.length===0?(
                <div style={{background:"rgba(255,107,107,.05)",border:"1px solid rgba(255,107,107,.1)",borderRadius:14,padding:24,textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:8}}>🔍</div>
                  <div style={{fontSize:13,color:"#ff6b6b88",fontWeight:700}}>No matches found</div>
                  <div style={{fontSize:11,color:"#222",marginTop:4}}>Try different dates or lower your filters</div>
                </div>
              ):filtered.map((m,i)=>{const best=getBestMarket(m,allowedMarkets);return<MatchCard key={m.id} m={m} bestMid={best.mid} bestProb={best.prob} bestScore={best.score} idx={i}/>;})
              }
            </div>

            {/* ACCA SUMMARY */}
            {picks.length>0&&(
              <div style={{background:"linear-gradient(135deg,rgba(0,255,136,.07),rgba(0,200,100,.03))",border:"1px solid rgba(0,255,136,.18)",borderRadius:16,padding:16,animation:"fadeUp .3s ease"}}>
                <div style={{fontSize:9,color:"#00ff8877",letterSpacing:1,marginBottom:12}}>YOUR {picks.length}-LEG SMART ACCA</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
                  {[["ODDS",combinedOdds.toFixed(2)+"x","#fff"],["WIN %",winChance.toFixed(1)+"%","#00ff88"],["LEGS",picks.length,"#a78bfa"],["AI",avgAI+"/100","#f0c040"]].map(([l,v,c])=>(
                    <div key={l} style={{textAlign:"center"}}>
                      <div style={{fontSize:8,color:"#333",marginBottom:3}}>{l}</div>
                      <div style={{fontSize:15,fontWeight:900,color:c,fontFamily:"DM Mono,monospace",lineHeight:1}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:"rgba(0,0,0,.3)",borderRadius:10,padding:12,marginBottom:12}}>
                  <div style={{fontSize:9,color:"#333",marginBottom:8}}>YOUR PICKS — ADD THESE ON SPORTYBET</div>
                  {picks.map((p,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:"#eee"}}>{p.match.home} vs {p.match.away}</div>
                        <div style={{fontSize:9,color:"#444"}}>{p.match.leagueName} · {p.match.time}</div>
                      </div>
                      <Tag color="#00ff88">{MARKETS.find(m=>m.id===p.mid)?.short}</Tag>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <button onClick={sharePicks} style={{width:"100%",padding:"11px",borderRadius:11,background:copied?"#00ff88":"rgba(0,255,136,.12)",border:"1px solid rgba(0,255,136,.28)",color:copied?"#000":"#00ff88",fontSize:12,fontWeight:800,cursor:"pointer",transition:"all .2s"}}>
                    {copied?"✓ COPIED! Paste into SportyBet":"📋 Copy All Picks"}
                  </button>
                  <button onClick={()=>window.open("https://www.sportybet.com/ng/","_blank")} style={{width:"100%",padding:"11px",borderRadius:11,background:"linear-gradient(135deg,#00a651,#007a3d)",border:"none",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>🟢 Open SportyBet Nigeria →</button>
                  <button onClick={shareWhatsApp} style={{width:"100%",padding:"11px",borderRadius:11,background:"rgba(37,211,102,.12)",border:"1px solid rgba(37,211,102,.3)",color:"#25d366",fontSize:12,fontWeight:800,cursor:"pointer"}}>📲 Share on WhatsApp</button>
                  <button onClick={()=>setTab("ai")} style={{width:"100%",padding:"11px",borderRadius:11,background:"rgba(167,139,250,.1)",border:"1px solid rgba(167,139,250,.22)",color:"#a78bfa",fontSize:12,fontWeight:800,cursor:"pointer"}}>🤖 View AI Analysis →</button>
                </div>
              </div>
            )}

            <button onClick={autoGenerate} disabled={generating||filtered.length===0} style={{width:"100%",padding:"17px",borderRadius:14,border:"none",background:generating?"rgba(0,255,136,.1)":"linear-gradient(135deg,#00ff88,#00cc60)",color:generating?"#00ff88":"#000",fontSize:15,fontWeight:900,cursor:generating||filtered.length===0?"not-allowed":"pointer",animation:!generating&&filtered.length>0?"glow 2.5s ease-in-out infinite":"none",display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"all .3s"}}>
              {generating?<><Spin/> AI Choosing Best Markets...</>:`✦ Auto-Generate ${legs}-Leg Smart Acca`}
            </button>
            <div style={{textAlign:"center",fontSize:9,color:"#1a1a1a",marginTop:4}}>AI picks the best market for each match automatically</div>
          </div>
        )}

        {/* AI TAB */}
        {tab==="ai"&&(
          <div style={{animation:"fadeUp .3s ease",display:"flex",flexDirection:"column",gap:12}}>
            {picks.length===0?(
              <div style={{textAlign:"center",padding:50}}><div style={{fontSize:44,marginBottom:12}}>🤖</div><div style={{fontSize:14,fontWeight:700,color:"#222"}}>Generate an acca first</div></div>
            ):(
              <>
                <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
                  <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:10}}>YOUR {picks.length}-LEG SMART ACCA</div>
                  {picks.map((p,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:"#eee"}}>{p.match.home} vs {p.match.away}</div>
                        <div style={{fontSize:10,color:"#444"}}>{p.match.flag} {p.match.leagueName} · <span style={{color:"#a78bfa"}}>{p.mktLabel}</span></div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:14,fontWeight:900,color:"#00ff88",fontFamily:"monospace"}}>{p.prob}%</div>
                        <div style={{fontSize:9,color:"#333"}}>AI {p.score}/100</div>
                      </div>
                    </div>
                  ))}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
                    {[["ODDS",combinedOdds.toFixed(2)+"x","#fff"],["WIN %",winChance.toFixed(1)+"%","#00ff88"],["HIST",expectedWR+"%","#f0c040"]].map(([l,v,c])=>(
                      <div key={l} style={{textAlign:"center"}}><div style={{fontSize:8,color:"#333"}}>{l}</div><div style={{fontSize:14,fontWeight:900,color:c,fontFamily:"monospace"}}>{v}</div></div>
                    ))}
                  </div>
                </div>
                <div style={{background:"rgba(167,139,250,.04)",border:"1px solid rgba(167,139,250,.14)",borderRadius:14,padding:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <span style={{fontSize:18}}>🤖</span>
                    <div><div style={{fontSize:11,fontWeight:800,color:"#a78bfa"}}>WINSMART AI ANALYST</div><div style={{fontSize:9,color:"#222"}}>Powered by Claude AI</div></div>
                    {aiLoading&&<Spin color="#a78bfa"/>}
                  </div>
                  {aiLoading?<div style={{fontSize:12,color:"#1a1a1a",animation:"shimmer 1.5s ease infinite"}}>Analysing {picks.length} picks across 43 markets...</div>
                  :aiText?<div style={{fontSize:12,color:"#999",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{aiText}</div>
                  :<div style={{fontSize:12,color:"#222"}}>Generate an acca to see AI analysis.</div>}
                </div>
                <button onClick={autoGenerate} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"rgba(0,255,136,.08)",color:"#00ff88",fontSize:12,fontWeight:800,cursor:"pointer"}}>🔄 Regenerate</button>
              </>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {tab==="stats"&&(
          <div style={{animation:"fadeUp .3s ease",display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["TOTAL ACCAS","559","#00ff88"],["WIN RATE","28.7%","#f0c040"],["PICK ACCURACY","83.9%","#a78bfa"],["BEST HIT","18.14x","#00ff88"]].map(([l,v,c])=>(
                <div key={l} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14}}>
                  <div style={{fontSize:8,color:"#222",letterSpacing:1,marginBottom:6}}>{l}</div>
                  <div style={{fontSize:26,fontWeight:900,color:c,fontFamily:"DM Mono,monospace"}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:16}}>
              <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:14}}>WIN RATE BY LEGS (3–50)</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                {Object.entries(LEG_WIN_RATES).map(([l,r])=>(
                  <div key={l} style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"6px 5px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#333"}}>{l}-leg</div>
                    <div style={{fontSize:13,fontWeight:900,color:r>=40?"#00ff88":r>=15?"#f0c040":"#ff6b6b"}}>{r}%</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:16}}>
              <div style={{fontSize:9,color:"#333",letterSpacing:1,marginBottom:14}}>ALL 43 MARKETS BY WIN RATE</div>
              {[...MARKETS].sort((a,b)=>b.winRate-a.winRate).map((m,i)=>(
                <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                  <div style={{fontSize:10,color:"#222",width:20,flexShrink:0}}>#{i+1}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,color:"#666",fontWeight:700,marginBottom:3}}>{m.label} <span style={{fontSize:8,color:"#333"}}>· {m.cat}</span></div>
                    <Bar val={m.winRate} color={m.winRate>=65?"#00ff88":m.winRate>=40?"#f0c040":"#ff6b6b"}/>
                  </div>
                  <div style={{fontSize:12,fontWeight:900,color:m.winRate>=65?"#00ff88":m.winRate>=40?"#f0c040":"#ff6b6b",minWidth:32,textAlign:"right"}}>{m.winRate}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab==="history"&&(
          <div style={{animation:"fadeUp .3s ease"}}>
            {history.length===0?(
              <div style={{textAlign:"center",padding:50}}><div style={{fontSize:36,marginBottom:12}}>📋</div><div style={{fontSize:13,color:"#222"}}>No history yet</div></div>
            ):history.map((h,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:14,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:11,color:"#555"}}>{h.date} · {h.legs}-leg</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:900,color:"#a78bfa",fontFamily:"monospace"}}>{h.odds}x</span>
                    <Tag color="#f0c040">{h.result}</Tag>
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
