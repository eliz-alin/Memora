// ── State ──────────────────────────────────────────────────────────────────
const state = {
  xp: 0, level: 1, energy: 80, mood: null,
  gender: null,
  questActive: false, interval: null,
};

const XP_PER_LEVEL   = 100;
const QUEST_DURATION = 180;

function getTier(level) {
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}
function getVideoSrc(gender, mood, tier) {
  const suffix = tier > 1 ? `_t${tier}` : "";
  return `${gender}_${mood}${suffix}.mp4`;
}
function resolveVideo(gender, mood, tier) {
  return getVideoSrc(gender, mood || "neutral", tier);
}

const TIER_STYLES = {
  1: { glow: "rgba(245,197,24,0.18)",  ring: "",                                badge: "",   filter: "" },
  2: { glow: "rgba(100,200,255,0.28)", ring: "0 0 0 3px rgba(100,200,255,0.5)", badge: "⭐", filter: "drop-shadow(0 0 8px rgba(100,200,255,0.7))" },
  3: { glow: "rgba(255,120,255,0.32)", ring: "0 0 0 3px rgba(255,120,255,0.6)", badge: "👑", filter: "drop-shadow(0 0 12px rgba(255,120,255,0.8))" },
};

const MOOD_ENERGY = { happy: 5, neutral: 0, stressed: -10, tired: -15 };
const LEVEL_TITLES = ["Novice","Apprentice","Adventurer","Hero","Champion","Legend","Myth","Deity"];

// ── Helpers ────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function formatTime(t) {
  return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;
}
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

// ── Storage ────────────────────────────────────────────────────────────────
function saveState() {
  try { chrome.storage.local.set({ memoraState: { xp:state.xp, level:state.level, energy:state.energy, mood:state.mood, gender:state.gender }}); } catch(e) {}
}
function loadState(cb) {
  try { chrome.storage.local.get("memoraState", r => { if(r?.memoraState) Object.assign(state, r.memoraState); cb(); }); } catch(e) { cb(); }
}

// ── Chibi ──────────────────────────────────────────────────────────────────
let currentVideoSrc = "";
function playVideo(gender, mood, tier, force=false) {
  const video = $("chibi-video");
  const filename = resolveVideo(gender, mood, tier);
  let src; try { src = chrome.runtime.getURL(filename); } catch(e) { src = filename; }
  if (!force && src === currentVideoSrc) return;
  currentVideoSrc = src;
  video.classList.add("swap");
  setTimeout(() => { video.src = src; video.load(); video.play().catch(()=>{}); video.classList.remove("swap"); }, 200);
}
function applyTierVisuals(tier) {
  const video = $("chibi-video"), glow = document.querySelector(".character-glow");
  const badge = $("tier-badge"), box = $("character-box");
  const card = document.querySelector(".card"), lvlBadge = document.querySelector(".level-badge");
  const s = TIER_STYLES[tier] || TIER_STYLES[1];
  glow.style.background = `radial-gradient(circle, ${s.glow} 0%, transparent 70%)`;
  video.style.boxShadow = s.ring;
  video.style.filter    = s.filter;
  if (badge) badge.textContent = s.badge;
  [box, card, lvlBadge].forEach(el => { if(!el) return; el.classList.remove("tier2","tier3"); if(tier===2) el.classList.add("tier2"); if(tier===3) el.classList.add("tier3"); });
}

// ── UI ─────────────────────────────────────────────────────────────────────
function updateUI() {
  const tier = getTier(state.level);
  $("level-number").textContent = state.level;
  $("level-title").textContent  = LEVEL_TITLES[Math.min(state.level-1, LEVEL_TITLES.length-1)];
  const tl = $("tier-label");
  if(tl){ tl.textContent = tier===3?"✦ Elite":tier===2?"✦ Advanced":""; tl.style.opacity = tier>1?"1":"0"; }
  const xpPct = Math.min((state.xp/XP_PER_LEVEL)*100,100);
  $("xp-fill").style.width  = xpPct+"%";
  $("xp-label").textContent = `${state.xp} / ${XP_PER_LEVEL} XP`;
  const enPct = Math.max(0,Math.min(state.energy,100));
  $("energy-fill").style.width  = enPct+"%";
  $("energy-label").textContent = `${enPct}%`;
  const fill = $("energy-fill");
  if(enPct>60) fill.style.background="linear-gradient(90deg,#1a6b3a,#2ecc71)";
  else if(enPct>30) fill.style.background="linear-gradient(90deg,#b8860b,#f5c518)";
  else fill.style.background="linear-gradient(90deg,#7b1818,#e74c3c)";
  document.querySelectorAll(".mood-btn").forEach(b => b.classList.toggle("selected", b.dataset.mood===state.mood));
  if(state.gender){ playVideo(state.gender, state.mood, tier); applyTierVisuals(tier); }
}

function showMain()       { $("onboarding").classList.add("hidden"); $("main").classList.remove("hidden"); }
function showOnboarding() { $("onboarding").classList.remove("hidden"); $("main").classList.add("hidden"); }

// ── XP / Level ─────────────────────────────────────────────────────────────
function gainXP(amount) {
  state.xp += amount; showToast(`+${amount} XP`);
  if(state.xp >= XP_PER_LEVEL){
    state.xp -= XP_PER_LEVEL; state.level += 1;
    state.energy = Math.min(100, state.energy+20);
    const tierUp = getTier(state.level) > getTier(state.level-1);
    showLevelUp(tierUp);
    if(tierUp) currentVideoSrc = "";
  }
  saveState(); updateUI();
}
function showToast(msg) {
  const t=$("xp-toast"); t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),1500);
}
function showLevelUp(tierUp=false) {
  const flash=document.createElement("div"); flash.className="level-flash"; document.body.appendChild(flash);
  setTimeout(()=>flash.remove(),500);
  const b=$("levelup-banner");
  b.textContent = tierUp?"🌟 TIER UP! NEW CHIBI UNLOCKED! 🌟":"⚔️ LEVEL UP! ⚔️";
  b.classList.toggle("tier-up",tierUp); b.classList.add("show");
  setTimeout(()=>{ b.classList.remove("show","tier-up"); }, tierUp?3500:2500);
}

// ══════════════════════════════════════════════════════════════════════════
//  MINI GAMES
// ══════════════════════════════════════════════════════════════════════════

const GAMES = ["scramble","math","memory","chain","trivia"];
let currentGame = null;
let questTimer  = null;
let questTime   = QUEST_DURATION;
let mathScore   = 0;
let chainScore  = 0;
let triviaScore = 0;

// ── Page context ──────────────────────────────────────────────────────────
let pageCtx = { words: [], title: "", url: "" };

const FALLBACK_WORDS = [
  "FOCUS","BRAIN","QUEST","LEARN","PROUD","BRAVE","SHINE","MAGIC",
  "STORM","FLAME","SWIFT","CRISP","DREAM","POWER","BLOOM","STUDY",
  "BUILD","WRITE","THINK","SOLVE","GRASP","CLEAR","SHARP","NOTED",
];

function fetchPageWords(cb) {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs[0]?.id) { cb(); return; }
      chrome.tabs.sendMessage(tabs[0].id, { type: "GET_PAGE_WORDS" }, resp => {
        if (chrome.runtime.lastError || !resp) { cb(); return; }
        pageCtx = resp;
        updatePageBadge();
        cb();
      });
    });
  } catch(e) { cb(); }
}

function getWordPool(minLen=4, maxLen=10) {
  const pool = pageCtx.words.filter(w => w.length >= minLen && w.length <= maxLen);
  return pool.length >= 5 ? pool : FALLBACK_WORDS;
}

function makeHint() {
  const src = pageCtx.title || pageCtx.url || "current page";
  return "From: " + src.slice(0, 32);
}

// Update the page context badge in the quest box
function updatePageBadge() {
  const badge = document.getElementById("page-badge");
  if (!badge) return;
  if (pageCtx.title || pageCtx.url) {
    const label = pageCtx.title || pageCtx.url;
    badge.textContent = "📄 " + label.slice(0, 28) + (label.length > 28 ? "…" : "");
    badge.classList.remove("hidden");
  }
}

const TRIVIA_STATIC = [
  { emojis:"🌍🌊🌞", answer:"Earth has oceans and sun",  options:["Earth has oceans and sun","A beach vacation","Storms at sea","Space travel"] },
  { emojis:"🐍🍎👩", answer:"Adam and Eve story",        options:["Adam and Eve story","Jungle fruit","Snake eating apple","Garden party"] },
  { emojis:"🚀🌕👨‍🚀", answer:"Moon landing",     options:["Moon landing","Space tourism","Alien encounter","Star Wars"] },
  { emojis:"🎵🎸🤘", answer:"Rock music",                options:["Rock music","Guitar lesson","Pop concert","Music school"] },
  { emojis:"📚☕🌧️", answer:"Studying on a rainy day",   options:["Studying on a rainy day","Book club","Coffee shop","Library"] },
  { emojis:"🦁👑🌅", answer:"The Lion King",             options:["The Lion King","African safari","Jungle sunrise","King of animals"] },
  { emojis:"💔😭🍦", answer:"Eating ice cream after heartbreak", options:["Eating ice cream after heartbreak","Birthday party","Sweet sadness","Crying child"] },
  { emojis:"🧠💪📖", answer:"Study hard to be smart",   options:["Study hard to be smart","Gym class","Brain surgery","School fight"] },
];

// ── Quest shell ────────────────────────────────────────────────────────────
function showQuestIdle() {
  $("quest-idle").classList.remove("hidden");
  $("quest-game").classList.add("hidden");
  $("quest-result").classList.add("hidden");
  $("quest-timer").classList.add("hidden");
  const previews = {
    scramble:"🔤 Unscramble a word from this page",
    math:"➕ Math Blitz — solve fast!",
    memory:"🧠 Memory Sequence challenge",
    chain:"🔗 Word Chain using page words",
    trivia:"🎭 Emoji Trivia — decode the combo",
  };
  const next = GAMES[Math.floor(Math.random()*GAMES.length)];
  $("quest-preview").textContent = previews[next] || "Solve a challenge, earn XP!";
  updatePageBadge();
}

function startQuest() {
  state.questActive = true;
  state.energy = Math.max(0, state.energy-5);
  questTime = QUEST_DURATION;
  $("quest-idle").classList.add("hidden");
  $("quest-result").classList.add("hidden");
  $("quest-game").classList.remove("hidden");
  $("quest-timer").classList.remove("hidden");

  // Pick a random game
  currentGame = rand(GAMES);
  document.querySelectorAll(".game").forEach(g => g.classList.add("hidden"));
  $(`game-${currentGame}`).classList.remove("hidden");

  // Start countdown
  clearInterval(questTimer);
  updateQuestTimer();
  questTimer = setInterval(() => {
    questTime--;
    updateQuestTimer();
    if(questTime <= 0) endQuest(false);
  }, 1000);

  // Init the chosen game
  initGame(currentGame);
  saveState(); updateUI();
}

function updateQuestTimer() {
  $("quest-timer").textContent = `⏱ ${formatTime(questTime)}`;
}

function endQuest(won, xpAmount=20) {
  clearInterval(questTimer);
  state.questActive = false;
  $("quest-game").classList.add("hidden");
  $("quest-timer").classList.add("hidden");
  $("quest-result").classList.remove("hidden");

  if(won) {
    $("result-emoji").textContent = ["🎉","🏆","⭐","🔥","✨"][Math.floor(Math.random()*5)];
    $("result-msg").textContent   = `Quest complete! +${xpAmount} XP`;
    gainXP(xpAmount);
  } else {
    $("result-emoji").textContent = "😅";
    $("result-msg").textContent   = "Time's up! Try again — you got this!";
    gainXP(5); // participation XP
  }
  saveState(); updateUI();
}

// ── GAME: Word Scramble ────────────────────────────────────────────────────
function initGame_scramble() {
  const pool = getWordPool(4, 9);
  const word = rand(pool);
  // Ensure scrambled is different from original
  let scrambled;
  let tries = 0;
  do { scrambled = shuffle(word.split("")).join(""); tries++; } while (scrambled === word && tries < 10);
  $("scramble-word").textContent     = scrambled;
  $("scramble-hint").textContent     = makeHint();
  $("scramble-input").value          = "";
  $("scramble-feedback").textContent = "";
  $("scramble-input").dataset.answer = word;
  $("scramble-input").focus();
}

function checkScramble() {
  const input  = $("scramble-input").value.trim().toUpperCase();
  const answer = $("scramble-input").dataset.answer;
  if(input === answer) {
    $("scramble-feedback").textContent = "✅ Correct!";
    $("scramble-feedback").className = "feedback win";
    setTimeout(() => endQuest(true, 25), 900);
  } else {
    $("scramble-feedback").textContent = "❌ Not quite, try again!";
    $("scramble-feedback").className = "feedback lose";
    $("scramble-input").value = "";
  }
}

// ── GAME: Math Blitz ───────────────────────────────────────────────────────
let mathAnswer = 0;
function newMathQuestion() {
  const ops = ["+","-","×"];
  const op  = rand(ops);
  let a, b;
  if(op==="+") { a=Math.floor(Math.random()*50)+1; b=Math.floor(Math.random()*50)+1; mathAnswer=a+b; }
  else if(op==="-") { a=Math.floor(Math.random()*50)+20; b=Math.floor(Math.random()*a)+1; mathAnswer=a-b; }
  else { a=Math.floor(Math.random()*12)+1; b=Math.floor(Math.random()*12)+1; mathAnswer=a*b; }
  $("math-question").textContent = `${a} ${op} ${b} = ?`;
  $("math-input").value="";
  $("math-feedback").textContent="";
  $("math-input").focus();
}
function initGame_math() {
  mathScore = 0;
  $("math-score").textContent = "Score: 0";
  $("math-feedback").textContent = "";
  newMathQuestion();
}
function checkMath() {
  const input = parseInt($("math-input").value);
  if(isNaN(input)) return;
  if(input === mathAnswer) {
    mathScore++;
    $("math-score").textContent = `Score: ${mathScore}`;
    $("math-feedback").textContent = ["⚡ Fast!","🔥 Correct!","💥 Nice!"][Math.floor(Math.random()*3)];
    $("math-feedback").className = "feedback win";
    if(mathScore >= 5) { setTimeout(()=>endQuest(true, 20+mathScore*2), 600); return; }
    setTimeout(newMathQuestion, 600);
  } else {
    $("math-feedback").textContent = `❌ Answer was ${mathAnswer}`;
    $("math-feedback").className = "feedback lose";
    setTimeout(newMathQuestion, 900);
  }
}

// ── GAME: Memory Sequence ──────────────────────────────────────────────────
const MEMORY_COLORS = ["#e74c3c","#3498db","#2ecc71","#f5c518"];
const MEMORY_EMOJIS = ["🔴","🔵","🟢","🟡"];
let memSequence = [], memPlayerSeq = [], memPhase = "watch", memLevel = 0;

function initGame_memory() {
  memSequence = []; memLevel = 0;
  buildMemoryGrid();
  setTimeout(nextMemRound, 500);
}

function buildMemoryGrid() {
  const grid = $("memory-grid"); grid.innerHTML="";
  for(let i=0;i<4;i++){
    const btn = document.createElement("button");
    btn.className = "mem-btn";
    btn.dataset.idx = i;
    btn.style.background = "#1a1a2e";
    btn.textContent = MEMORY_EMOJIS[i];
    btn.addEventListener("click", ()=>memPlayerTap(i));
    grid.appendChild(btn);
  }
}

function nextMemRound() {
  memLevel++;
  if(memLevel > 6) { endQuest(true, 30); return; }
  $("memory-label").textContent = `Round ${memLevel} — Watch! 👀`;
  memSequence.push(Math.floor(Math.random()*4));
  memPlayerSeq = [];
  memPhase = "watch";
  disableMemBtns(true);
  playMemSequence(0);
}

function playMemSequence(i) {
  if(i >= memSequence.length){ memPhase="input"; disableMemBtns(false); $("memory-label").textContent="Your turn! 🎯"; return; }
  const btn = $("memory-grid").children[memSequence[i]];
  setTimeout(()=>{
    btn.classList.add("mem-active");
    setTimeout(()=>{ btn.classList.remove("mem-active"); playMemSequence(i+1); }, 500);
  }, 700*i);
}

function disableMemBtns(disabled) {
  document.querySelectorAll(".mem-btn").forEach(b => b.disabled=disabled);
}

function memPlayerTap(idx) {
  if(memPhase !== "input") return;
  const btn = $("memory-grid").children[idx];
  btn.classList.add("mem-active");
  setTimeout(()=>btn.classList.remove("mem-active"),200);
  memPlayerSeq.push(idx);
  const pos = memPlayerSeq.length-1;
  if(memPlayerSeq[pos] !== memSequence[pos]){
    $("memory-feedback").textContent="❌ Wrong! Starting over…";
    $("memory-feedback").className="feedback lose";
    memSequence=[]; memLevel=0;
    setTimeout(()=>{ $("memory-feedback").textContent=""; nextMemRound(); },1000);
    return;
  }
  if(memPlayerSeq.length === memSequence.length){
    $("memory-feedback").textContent=`✅ Round ${memLevel} done!`;
    $("memory-feedback").className="feedback win";
    setTimeout(()=>{ $("memory-feedback").textContent=""; nextMemRound(); },800);
  }
}

// ── GAME: Word Chain ───────────────────────────────────────────────────────
let chainWords = [], chainLastLetter = "";
function initGame_chain() {
  chainScore = 0;
  const pool = getWordPool(4, 8);
  const start = rand(pool.length >= 3 ? pool : ["APPLE","OCEAN","NIGHT","TIGER","RIVER"]);
  chainWords = [start];
  chainLastLetter = start[start.length-1];
  renderChain();
  $("chain-input").value="";
  $("chain-feedback").textContent=`Start with the letter: ${chainLastLetter}`;
  $("chain-score").textContent="Chain: 1";
  $("chain-input").focus();
}

function renderChain() {
  const d = $("chain-display");
  d.innerHTML = chainWords.slice(-3).map((w,i,a)=>
    `<span class="chain-word${i===a.length-1?" chain-last":""}">${w}</span>`
  ).join('<span class="chain-arrow">→</span>');
}

function checkChain() {
  const input = $("chain-input").value.trim().toUpperCase().replace(/[^A-Z]/g,"");
  $("chain-input").value="";
  if(!input){ return; }
  if(input[0] !== chainLastLetter){
    $("chain-feedback").textContent=`❌ Must start with "${chainLastLetter}"`;
    $("chain-feedback").className="feedback lose"; return;
  }
  if(chainWords.includes(input)){
    $("chain-feedback").textContent="❌ Already used!";
    $("chain-feedback").className="feedback lose"; return;
  }
  if(input.length < 2){
    $("chain-feedback").textContent="❌ Too short!";
    $("chain-feedback").className="feedback lose"; return;
  }
  chainWords.push(input);
  chainLastLetter = input[input.length-1];
  chainScore++;
  $("chain-score").textContent=`Chain: ${chainScore+1}`;
  $("chain-feedback").textContent=`✅ Nice! Next letter: ${chainLastLetter}`;
  $("chain-feedback").className="feedback win";
  renderChain();
  if(chainScore >= 6) { setTimeout(()=>endQuest(true, 20+chainScore*2),700); }
}

// ── GAME: Emoji Trivia ─────────────────────────────────────────────────────
let triviaQueue = [], triviaIdx = 0;
function initGame_trivia() {
  triviaScore = 0;
  triviaQueue = shuffle(TRIVIA_STATIC);
  triviaIdx = 0;
  $("trivia-score").textContent = "Score: 0";
  showTriviaQuestion();
}
function showTriviaQuestion() {
  if(triviaIdx >= triviaQueue.length){ endQuest(true, 15+triviaScore*5); return; }
  const q = triviaQueue[triviaIdx];
  $("trivia-emoji").textContent = q.emojis;
  $("trivia-feedback").textContent = "";
  const opts = $("trivia-options"); opts.innerHTML="";
  shuffle(q.options).forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "trivia-opt";
    btn.textContent = opt;
    btn.addEventListener("click", ()=>checkTrivia(opt, q.answer, btn));
    opts.appendChild(btn);
  });
}
function checkTrivia(chosen, answer, btn) {
  document.querySelectorAll(".trivia-opt").forEach(b=>b.disabled=true);
  if(chosen===answer){
    btn.classList.add("t-correct");
    triviaScore++;
    $("trivia-score").textContent=`Score: ${triviaScore}`;
    $("trivia-feedback").textContent="🎉 Correct!";
    $("trivia-feedback").className="feedback win";
  } else {
    btn.classList.add("t-wrong");
    document.querySelectorAll(".trivia-opt").forEach(b=>{ if(b.textContent===answer) b.classList.add("t-correct"); });
    $("trivia-feedback").textContent="❌ Wrong!";
    $("trivia-feedback").className="feedback lose";
  }
  triviaIdx++;
  setTimeout(showTriviaQuestion, 1100);
}

// ── Game dispatcher ────────────────────────────────────────────────────────
function initGame(name) {
  mathScore=0; chainScore=0; triviaScore=0;
  if(name==="scramble") initGame_scramble();
  else if(name==="math")   initGame_math();
  else if(name==="memory") initGame_memory();
  else if(name==="chain")  initGame_chain();
  else if(name==="trivia") initGame_trivia();
}

// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener("load", () => {

  // Onboarding
  let selectedGender = null;
  const confirmBtn = $("onboard-confirm");
  document.querySelectorAll(".gender-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".gender-btn").forEach(b=>b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedGender = btn.dataset.gender;
      confirmBtn.disabled = false;
    });
  });
  confirmBtn.addEventListener("click", () => {
    if(!selectedGender) return;
    state.gender = selectedGender; state.mood = null;
    saveState(); showMain(); updateUI(); showQuestIdle();
  });

  // Start quest button
  $("start-btn").addEventListener("click", startQuest);

  // Result → next quest
  $("result-next").addEventListener("click", () => {
    $("quest-result").classList.add("hidden");
    showQuestIdle();
    updateUI();
  });

  // Skip game
  $("skip-btn").addEventListener("click", () => endQuest(false));

  // Game controls — enter key support
  $("scramble-input").addEventListener("keydown", e=>{ if(e.key==="Enter") checkScramble(); });
  $("scramble-submit").addEventListener("click", checkScramble);
  $("math-input").addEventListener("keydown", e=>{ if(e.key==="Enter") checkMath(); });
  $("math-submit").addEventListener("click", checkMath);
  $("chain-input").addEventListener("keydown", e=>{ if(e.key==="Enter") checkChain(); });
  $("chain-submit").addEventListener("click", checkChain);

  // Mood
  document.querySelectorAll(".mood-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const prev = state.mood;
      state.mood = btn.dataset.mood;
      if(prev !== state.mood) state.energy = Math.max(0,Math.min(100, state.energy+(MOOD_ENERGY[state.mood]||0)));
      gainXP(5); updateUI();
    });
  });

  // Boot
  loadState(() => {
    state.questActive=false; state.interval=null;
    if(state.gender){
      showMain(); updateUI();
      fetchPageWords(() => showQuestIdle());
    } else {
      showOnboarding();
    }
  });
});