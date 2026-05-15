import { GROUPS, LEVELS, LEVEL_INDEX, MEME_WORDS, TIERS } from "./levels.js";
import { loadStore, resetStore, saveStore } from "./storage.js";
import { applyPhase2Fx, applyTheme } from "./theme.js";
import { CharacterManager } from "./characterManager.js";

const app = document.getElementById("app");
const hud = document.getElementById("hud");
const toastEl = document.getElementById("toast");

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const randPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const BACKGROUND_IMAGES = [
  "background/0.jpg",
  "background/1.jpg",
  "background/2.jpg",
  "background/3.jpg",
  "background/4.jpg",
  "background/5.jpg",
  "background/6.jpg",
  "background/7.jpg",
  "background/8.jpg",
  "background/9.jpg",
  "background/10.jpg",
];

const setRandomBackground = () => {
  const randomBg = randPick(BACKGROUND_IMAGES);
  app.style.backgroundImage = `url('${randomBg}')`;
  app.style.backgroundSize = "cover";
  app.style.backgroundPosition = "center";
  app.style.backgroundRepeat = "no-repeat";
};

const clearBackground = () => {
  app.style.backgroundImage = "";
};

let toastTimer = 0;
const toast = (text) => {
  toastEl.textContent = text;
  toastEl.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("on"), 1600);
};

const setHud = (text) => {
  hud.textContent = text;
};

const clearDynamicNodes = () => {
  const keepIds = new Set(["hud", "toast"]);
  [...app.children].forEach((n) => {
    const isKeep = keepIds.has(n.id) || n.classList.contains("grid") || n.classList.contains("game-character");
    if (!isKeep) n.remove();
  });
};

const Mode = {
  HOME: "HOME",
  MENU: "MENU",
  SELECT: "SELECT",
  TIERSELECT: "TIERSELECT",
  ACH: "ACH",
  SPECIAL: "SPECIAL",
  PLAY: "PLAY",
  TUTORIAL: "TUTORIAL",
  LIBRARY: "LIBRARY",
};

const Phase = {
  XRAY: "PHASE1_XRAY",
  ASSEMBLY: "PHASE2_ASSEMBLY",
  AWAKEN: "PHASE3_AWAKEN",
};

const store = loadStore();

const isHiddenLevel = (id) => GROUPS.some((g) => g.hidden === id);

const unlockSets = () => {
  const discoveredIds = new Set(Object.keys(store.discovered || {}));
  for (const g of GROUPS) {
    if (store.setsUnlocked?.[g.id]) continue;
    const ok = g.core.every((x) => discoveredIds.has(x));
    if (ok) {
      store.setsUnlocked[g.id] = true;
      toast(`主题组集齐：${g.name} · 解锁隐藏遗迹`);
    }
  }
};

const TIER_ORDER = TIERS.map((t) => t.id);

const getLevelsForTier = (tierId) => LEVELS.filter((lv) => lv.tier === tierId);

const isTierUnlocked = (tierId) => {
  const idx = TIER_ORDER.indexOf(tierId);
  if (idx <= 0) return true;
  const prevTier = TIER_ORDER[idx - 1];
  const prevLevels = getLevelsForTier(prevTier);
  return prevLevels.every((lv) => !!store.discovered?.[lv.id]);
};

const isTierCleared = (tierId) => {
  const levels = getLevelsForTier(tierId);
  return levels.length > 0 && levels.every((lv) => !!store.discovered?.[lv.id]);
};

const getUnplayedInTier = (tierId) => {
  return getLevelsForTier(tierId).filter((lv) => !store.discovered?.[lv.id]);
};

const getNextTier = (tierId) => {
  const idx = TIER_ORDER.indexOf(tierId);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
};

const isLevelUnlocked = (id) => {
  const lv = LEVELS[LEVEL_INDEX[id]];
  if (!lv) return false;
  if (lv.hidden) {
    const g = GROUPS.find((x) => x.hidden === id);
    if (g) return g.core.every((x) => !!store.discovered?.[x]);
  }
  return isTierUnlocked(lv.tier);
};

const applyProgress = (levelId, { flawless = false, runTimeMs = 0 } = {}) => {
  store.discovered[levelId] = store.discovered[levelId] || Date.now();
  const idx = LEVEL_INDEX[levelId] ?? 0;
  store.lastIndex = Math.max(store.lastIndex || 0, idx + 1);
  store.stats.clears = (store.stats.clears || 0) + 1;
  if (flawless) store.stats.flawless = (store.stats.flawless || 0) + 1;
  if (runTimeMs > 0) store.stats.bestTimeMs = store.stats.bestTimeMs ? Math.min(store.stats.bestTimeMs, runTimeMs) : runTimeMs;
  unlockSets();
  unlockAchievements();
  saveStore(store);
};

const unlockAchievements = () => {
  const a = store.achievements || (store.achievements = {});
  const discovered = Object.keys(store.discovered || {}).length;
  if (discovered >= 1) a.first = true;
  if ((store.stats?.flawless || 0) >= 1) a.flawless = true;
  if ((store.stats?.clears || 0) >= 10) a.veteran = true;
  const setCount = Object.keys(store.setsUnlocked || {}).length;
  if (setCount >= 1) a.set1 = true;
  if (setCount >= GROUPS.length) a.setAll = true;
};

const extractDecoys = (text) => {
  const s = String(text || "");
  const m = s.match(/“([^”]+)”/);
  if (!m) return [];
  return m[1]
    .split(/[\/、,，\s]+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8);
};

const splitTargetChars = (text) =>
  Array.from(String(text || "").replace(/\s+/g, "")).filter((x) => x && x.trim().length > 0);

const buildLevelRuntime = (lv) => {
  const difficulty = lv.difficulty || {};
  const chosenFragments = splitTargetChars(lv.char);
  const targetCharsSet = new Set(chosenFragments);
  const radicals = chosenFragments.map((text, i) => ({ id: `r${i}`, text }));
  const decoys = extractDecoys(lv.polluted);
  const allChars = LEVELS.flatMap((x) => splitTargetChars(x.char));
  const noiseWords = [...new Set([...decoys, ...MEME_WORDS, ...LEVELS.map((x) => x.char)].filter(Boolean))];
  const slangs = [...new Set([...noiseWords, ...allChars, lv.char].filter(Boolean))];
  const fakeRadicals = [...new Set([...slangs.flatMap((x) => splitTargetChars(x)), ...allChars])]
    .filter((x) => !chosenFragments.includes(x))
    .slice(0, 48);
  const timeMs = clamp(difficulty.timeMs || 24000, 8000, 120000);
  const assemblyTimeMs = clamp(difficulty.assemblyTimeMs || Math.round(timeMs * (lv.special ? 0.45 : 0.55)), 6000, 60000);
  return {
    id: lv.id,
    char: lv.char,
    radicals,
    targetCharsSet,
    fakeRadicals,
    slangs,
    poem: lv.contextLine || "",
    poemFrom: lv.contextFrom || "",
    monologue: lv.monologue || "",
    polluted: lv.polluted || "",
    origin: lv.origin || "",
    distorted: lv.distorted || "",
    examples: Array.isArray(lv.examples) ? lv.examples.slice(0, 3) : [],
    difficulty: {
      particles: clamp(difficulty.particles || 36, 24, 120),
      fakeRate: clamp(difficulty.fakeRate || 0.18, 0, 0.7),
      freezeMs: clamp(difficulty.freezeMs || 5000, 1000, 10000),
      timeMs,
      assemblyTimeMs,
      snapPx: clamp(difficulty.snapPx || 50, 22, 90),
    },
    theme: lv.theme || { a: "#fbbf24", b: "#22d3ee", fx: "" },
    special: !!lv.special,
    hidden: !!lv.hidden,
  };
};

const state = {
  mode: Mode.MENU,
  phase: Phase.XRAY,
  levelId: "",
  level: null,
  lens: { x: -1000, y: -1000, r: 120 },
  freeze: false,
  collected: new Set(),
  particles: [],
  raf: 0,
  lastT: 0,
  runStartAt: 0,
  runMistakes: 0,
  // 计分系统
  score: 0,
  combo: 0,
  maxCombo: 0,
  p1: { deadlineAt: 0, hintShown: false, highlightShown: false },
  p2: { dragging: -1, pos: [], distance: 999, snapped: false, deadlineAt: 0 },
  p3: { step: 0, timers: [] },
  tutorial: { firstCharCollected: false },
  characterManager: null,
};

const cancelRaf = () => {
  cancelAnimationFrame(state.raf);
  state.raf = 0;
  state.lastT = 0;
};

const setMode = (mode) => {
  state.mode = mode;
  cancelRaf();
  clearDynamicNodes();
  app.onpointermove = null;
  app.onpointerup = null;
  app.onpointerleave = null;

  // 清理角色系统
  if (state.characterManager) {
    state.characterManager.destroy();
    state.characterManager = null;
  }

  if (mode === Mode.HOME) initHome();
  else if (mode === Mode.MENU) initMenu();
  else if (mode === Mode.SELECT) initSelect();
  else if (mode === Mode.TIERSELECT) initTierSelect();
  else if (mode === Mode.ACH) initAchievements();
  else if (mode === Mode.SPECIAL) initSpecial();
  else if (mode === Mode.TUTORIAL) initTutorial();
  else if (mode === Mode.LIBRARY) initLibrary();
};

const setPhase = (phase) => {
  state.phase = phase;
  cancelRaf();
  clearDynamicNodes();
  // 确保角色元素仍在 DOM 中（clearDynamicNodes 可能在某些情况下移除）
  if (state.characterManager && state.characterManager.currentCharacter) {
    state.characterManager.currentCharacter.mount(app);
  }
  if (phase === Phase.XRAY) initPhaseCountdown();
  else if (phase === Phase.ASSEMBLY) initPhase2();
  else initPhase3();
};

const startLevelById = (id) => {
  const idx = LEVEL_INDEX[id];
  const lv = LEVELS[idx ?? 0] || LEVELS[0];
  if (!isLevelUnlocked(lv.id)) {
    toast(isHiddenLevel(lv.id) ? "集齐主题组可解锁隐藏遗迹" : "该遗迹尚未解锁");
    return;
  }
  const rt = buildLevelRuntime(lv);
  state.levelId = rt.id;
  state.level = rt;
  state.runStartAt = performance.now();
  state.runMistakes = 0;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  applyTheme(rt.theme);
  setRandomBackground();
  document.title = `汉字考古2126 · ${rt.char}`;
  state.mode = Mode.PLAY;

  // 初始化角色系统
  if (state.characterManager) {
    state.characterManager.destroy();
  }
  state.characterManager = new CharacterManager(app);
  state.characterManager.setGameState(state);
  state.characterManager.init();
  // 角色从倒计时阶段就开始出现和移动
  state.characterManager.start();

  setPhase(Phase.XRAY);
};

const findNextPlayableId = (fromId) => {
  const fromLv = LEVELS[LEVEL_INDEX[fromId]];
  const tier = fromLv?.tier || "easy";
  const unplayed = getUnplayedInTier(tier).filter((lv) => lv.id !== fromId);
  if (unplayed.length > 0) return randPick(unplayed).id;
  const next = getNextTier(tier);
  if (next && isTierUnlocked(next)) {
    const nextUnplayed = getUnplayedInTier(next);
    if (nextUnplayed.length > 0) return randPick(nextUnplayed).id;
  }
  return fromId;
};

const mk = (tag, cls, html) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html != null) el.innerHTML = html;
  return el;
};

const escapeHtml = (text) =>
  String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// === 计分系统 ===
const BASE_SCORE = 100;
const COMBO_MULTIPLIER = 0.5; // 每连击+50%

const addScore = (base) => {
  const multiplier = 1 + state.combo * COMBO_MULTIPLIER;
  const pts = Math.round(base * multiplier);
  state.score += pts;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  return pts;
};

const resetCombo = () => {
  state.combo = 0;
};

const calcStars = () => {
  const mistakes = state.runMistakes;
  const combo = state.maxCombo;
  const lv = state.level;
  const totalChars = lv ? lv.radicals.length : 1;
  if (mistakes === 0 && combo >= totalChars) return 3;
  if (mistakes <= 1) return 2;
  return 1;
};

// === 粒子点击特效 ===
const spawnClickFx = (x, y, text, isCorrect) => {
  const fx = mk("div", "click-fx");
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;

  if (isCorrect) {
    const pts = state.score; // 已经加过分了
    fx.innerHTML = `<span class="fx-char">${escapeHtml(text)}</span><span class="fx-score">+${state.combo > 1 ? `combo x${state.combo - 1}` : BASE_SCORE}</span>`;
    fx.classList.add("correct");
  } else {
    fx.innerHTML = `<span class="fx-char">✗</span>`;
    fx.classList.add("wrong");
  }

  app.appendChild(fx);
  requestAnimationFrame(() => fx.classList.add("animate"));
  setTimeout(() => fx.remove(), 800);
};

// === 进度条 ===
const updateProgressBar = () => {
  let bar = document.getElementById("progress-bar");
  if (!bar) {
    bar = mk("div", "progress-bar-wrap");
    bar.id = "progress-bar";
    bar.innerHTML = `<div class="progress-fill"></div><div class="progress-text"></div>`;
    app.appendChild(bar);
  }
  const lv = state.level;
  if (!lv) return;
  const total = lv.radicals.length;
  const done = state.collected.size;
  const pct = Math.round((done / total) * 100);
  bar.querySelector(".progress-fill").style.width = `${pct}%`;
  bar.querySelector(".progress-text").textContent = `${done} / ${total}`;
};

// === 分数HUD ===
const updateScoreHud = () => {
  let el = document.getElementById("score-hud");
  if (!el) {
    el = mk("div", "score-hud");
    el.id = "score-hud";
    app.appendChild(el);
  }
  const comboText = state.combo > 1 ? ` · ${state.combo}x连击` : "";
  el.textContent = `${state.score}分${comboText}`;
  if (state.combo > 1) {
    el.classList.add("combo");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("combo"), 600);
  }
};

const initHome = () => {
  clearBackground();
  setHud("");
  document.title = "汉字考古2126";

  const root = mk("div", "home-screen");
  root.innerHTML = `
    <div class="home-page">
      <section class="phone-frame">
        <img class="homepage-image" src="./assets/homepage-design.png" alt="首页设计图" />
        <div class="home-overlay">
          <header class="hero">
            <p class="hero-subtitle">中华文字探源计划</p>
            <h1 class="hero-title">汉字考古 2126</h1>
          </header>
          <nav class="quick-actions">
            <button class="action-button" id="homeStartBtn">开始考古</button>
            <button class="action-button" id="homeLibraryBtn">字库图鉴</button>
            <button class="action-button" id="homeTutorialBtn">教程说明</button>
          </nav>
        </div>
      </section>
    </div>
  `;
  app.appendChild(root);

  root.querySelector("#homeStartBtn").onclick = () => setMode(Mode.TIERSELECT);
  root.querySelector("#homeLibraryBtn").onclick = () => setMode(Mode.LIBRARY);
  root.querySelector("#homeTutorialBtn").onclick = () => {
    const modal = document.getElementById("tutorialModal");
    if (modal) { modal.classList.add("show"); document.body.style.overflow = "hidden"; }
  };

  // 教程弹窗关闭逻辑
  const closeModal = document.getElementById("closeModal");
  const tutorialModal = document.getElementById("tutorialModal");
  if (closeModal) closeModal.onclick = () => { tutorialModal.classList.remove("show"); document.body.style.overflow = ""; };
  if (tutorialModal) tutorialModal.onclick = (e) => { if (e.target === tutorialModal) { tutorialModal.classList.remove("show"); document.body.style.overflow = ""; } };
  const tutContent = document.querySelector(".tutorial-content");
  if (tutContent) tutContent.onclick = (e) => e.stopPropagation();
};

const initMenu = () => {
  clearBackground();
  setHud("汉字考古2126 · 梗词语义修复");
  const root = mk("div", "screen");
  root.onpointermove = (e) => {
    const rect = root.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    root.style.setProperty("--mx", `${x.toFixed(2)}%`);
    root.style.setProperty("--my", `${y.toFixed(2)}%`);
  };
  const card = mk("div", "card");
  root.appendChild(card);
  const title = mk("div", "title");
  title.textContent = "汉字考古2126";
  card.appendChild(title);
  const sub = mk("div", "sub");
  sub.textContent = "梗词考古 · 关键词拼装 · 语义修复";
  card.appendChild(sub);

  const row = mk("div", "row");
  card.appendChild(row);

  const cont = mk("button", "btn");
  cont.textContent = "继续考古";
  cont.onclick = () => setMode(Mode.TIERSELECT);
  row.appendChild(cont);

  const tutorial = mk("button", "btn");
  tutorial.textContent = "教程演示";
  tutorial.onclick = () => startTutorial();
  row.appendChild(tutorial);

  const pick = mk("button", "btn ghost");
  pick.textContent = "遗迹选择";
  pick.onclick = () => setMode(Mode.SELECT);
  row.appendChild(pick);

  const ach = mk("button", "btn ghost");
  ach.textContent = "成就";
  ach.onclick = () => setMode(Mode.ACH);
  row.appendChild(ach);

  app.appendChild(root);
};

const TIER_COLORS = { easy: "#34d399", normal: "#fbbf24", hard: "#f97316", hell: "#ef4444" };

const initTierSelect = () => {
  clearBackground();
  setHud("");
  document.title = "选择难度 - 汉字考古2126";

  const root = mk("div", "tier-screen");
  let html = `
    <button class="back-button" id="tierBackBtn" aria-label="返回首页">←</button>
    <div class="tier-container">
      <header class="tier-header">
        <h1 class="tier-title">选择难度</h1>
        <p class="tier-subtitle">由浅入深，逐级解锁</p>
      </header>
      <div class="tier-list">`;

  for (const tier of TIERS) {
    const unlocked = isTierUnlocked(tier.id);
    const cleared = isTierCleared(tier.id);
    const levels = getLevelsForTier(tier.id);
    const doneCount = levels.filter((lv) => !!store.discovered?.[lv.id]).length;
    const color = TIER_COLORS[tier.id];
    html += `
      <div class="tier-card ${unlocked ? "" : "locked"} ${cleared ? "cleared" : ""}" data-tier="${tier.id}">
        <div class="tier-badge" style="background:${unlocked ? color : "#666"}">${tier.name}</div>
        <div class="tier-desc">${tier.desc}</div>
        <div class="tier-progress">${doneCount} / ${levels.length} 已通关</div>
        <div class="tier-bar"><div class="tier-bar-fill" style="width:${Math.round((doneCount / levels.length) * 100)}%;background:${color}"></div></div>
        ${!unlocked ? '<div class="tier-lock-hint">通关上一难度后解锁</div>' : ""}
        ${cleared ? '<div class="tier-clear-tag">已通关</div>' : ""}
      </div>`;
  }

  html += `</div></div>`;
  root.innerHTML = html;
  app.appendChild(root);

  root.querySelector("#tierBackBtn").onclick = () => setMode(Mode.HOME);

  root.querySelectorAll(".tier-card").forEach((card) => {
    card.onclick = () => {
      const tierId = card.dataset.tier;
      if (!isTierUnlocked(tierId)) {
        toast("请先通关上一难度");
        return;
      }
      if (isTierCleared(tierId)) {
        const next = getNextTier(tierId);
        if (next && isTierUnlocked(next)) {
          toast(`${TIERS.find((t) => t.id === tierId).name}已全部通关，前往下一难度`);
          showTierLevels(root, next);
        } else if (next) {
          toast("恭喜通关！下一难度即将解锁");
        } else {
          toast("恭喜！你已通关全部难度");
        }
        return;
      }
      showTierLevels(root, tierId);
    };
  });
};

const showTierLevels = (root, tierId) => {
  const tier = TIERS.find((t) => t.id === tierId);
  const levels = getLevelsForTier(tierId);
  const color = TIER_COLORS[tierId];

  root.innerHTML = `
    <button class="back-button" id="lvBackBtn" aria-label="返回难度选择">←</button>
    <div class="tier-container">
      <header class="tier-header">
        <h1 class="tier-title">${tier.name}</h1>
        <p class="tier-subtitle">${tier.desc}</p>
      </header>
      <div class="tier-levels-grid" id="tierLevelsGrid"></div>
    </div>`;

  const grid = root.querySelector("#tierLevelsGrid");
  for (const lv of levels) {
    const done = !!store.discovered?.[lv.id];
    const card = mk("div", `tier-level-card ${done ? "done" : ""}`);
    card.innerHTML = `
      <div class="tier-lv-word">${lv.char}</div>
      <div class="tier-lv-status" style="color:${done ? color : "rgba(74,85,104,0.6)"}">${done ? "已通关" : "未挑战"}</div>
    `;
    if (!done) {
      card.onclick = () => startLevelById(lv.id);
    } else {
      card.classList.add("completed");
      card.onclick = () => toast("该关卡已通关");
    }
    grid.appendChild(card);
  }

  root.querySelector("#lvBackBtn").onclick = () => setMode(Mode.TIERSELECT);
};

const initSelect = () => {
  clearBackground();
  setHud("遗迹选择 · 点击已解锁的遗迹开始");
  const root = mk("div", "screen");
  const card = mk("div", "card");
  root.appendChild(card);
  const title = mk("div", "title");
  title.textContent = "遗迹选择";
  card.appendChild(title);
  const sub = mk("div", "sub");
  sub.textContent = "每关目标不同 · 通过透镜收集关键词并拼出正确梗词";
  card.appendChild(sub);

  const grid = mk("div", "gridLevels");
  card.appendChild(grid);

  for (const lv of LEVELS) {
    const unlocked = isLevelUnlocked(lv.id);
    const done = !!store.discovered?.[lv.id];
    const cell = mk("div", `lv ${unlocked ? "" : "locked"} ${done ? "done" : ""}`.trim());
    const shown = unlocked ? lv.char : "？";
    cell.innerHTML = `${shown}<small>${lv.hidden ? "隐藏" : done ? "已收录" : unlocked ? "可考古" : "未解锁"}</small>`;
    cell.onclick = () => {
      if (!unlocked) {
        toast(isHiddenLevel(lv.id) ? "集齐主题组可解锁隐藏遗迹" : "该遗迹尚未解锁");
        return;
      }
      startLevelById(lv.id);
    };
    grid.appendChild(cell);
  }

  const row = mk("div", "row");
  card.appendChild(row);
  const back = mk("button", "btn ghost");
  back.textContent = "返回";
  back.onclick = () => setMode(Mode.HOME);
  row.appendChild(back);

  app.appendChild(root);
};

const initSpecial = () => {
  clearBackground();
  setHud("特殊遗迹 · 规则会变化");
  const root = mk("div", "screen");
  const card = mk("div", "card");
  root.appendChild(card);
  const title = mk("div", "title");
  title.textContent = "特殊遗迹";
  card.appendChild(title);
  const sub = mk("div", "sub");
  sub.textContent = "这类遗迹往往是隐藏遗迹：集齐主题组后解锁，并在拼铸阶段改变磁性规则。";
  card.appendChild(sub);

  const grid = mk("div", "gridLevels");
  card.appendChild(grid);

  const list = LEVELS.filter((x) => x.special || x.hidden);
  for (const lv of list) {
    const unlocked = isLevelUnlocked(lv.id);
    const done = !!store.discovered?.[lv.id];
    const cell = mk("div", `lv ${unlocked ? "" : "locked"} ${done ? "done" : ""}`.trim());
    const shown = unlocked ? lv.char : "？";
    cell.innerHTML = `${shown}<small>${lv.hidden ? "隐藏" : "特殊"} · ${done ? "已收录" : unlocked ? "可挑战" : "未解锁"}</small>`;
    cell.onclick = () => {
      if (!unlocked) {
        toast("集齐主题组可解锁隐藏遗迹");
        return;
      }
      startLevelById(lv.id);
    };
    grid.appendChild(cell);
  }

  const row = mk("div", "row");
  card.appendChild(row);
  const back = mk("button", "btn ghost");
  back.textContent = "返回";
  back.onclick = () => setMode(Mode.HOME);
  row.appendChild(back);

  app.appendChild(root);
};

const initAchievements = () => {
  clearBackground();
  unlockAchievements();
  saveStore(store);
  setHud("成就 · 你的修复记录");
  const root = mk("div", "screen");
  const card = mk("div", "card");
  root.appendChild(card);
  const title = mk("div", "title");
  title.textContent = "成就";
  card.appendChild(title);
  const sub = mk("div", "sub");
  const clears = store.stats?.clears || 0;
  const flawless = store.stats?.flawless || 0;
  const discovered = Object.keys(store.discovered || {}).length;
  sub.textContent = `已收录 ${discovered} 个梗词 · 通关 ${clears} 次 · 零失误 ${flawless} 次`;
  card.appendChild(sub);

  const items = [
    { id: "first", name: "第一份修复", desc: "首次完成任意梗词修复" },
    { id: "flawless", name: "不染尘", desc: "任意一关零失误完成" },
    { id: "veteran", name: "考古者", desc: "累计通关 10 次" },
    { id: "set1", name: "主题集齐", desc: "集齐任意一个主题组" },
    { id: "setAll", name: "四组归一", desc: "集齐全部主题组" },
  ];

  const grid = mk("div", "gridLevels");
  card.appendChild(grid);
  for (const it of items) {
    const ok = !!store.achievements?.[it.id];
    const cell = mk("div", `lv ${ok ? "done" : "locked"}`.trim());
    cell.innerHTML = `${ok ? "✓" : "—"}<small>${it.name}</small>`;
    cell.onclick = () => toast(it.desc);
    grid.appendChild(cell);
  }

  const row = mk("div", "row");
  card.appendChild(row);
  const back = mk("button", "btn ghost");
  back.textContent = "返回";
  back.onclick = () => setMode(Mode.HOME);
  row.appendChild(back);

  app.appendChild(root);
};

const getDifficultyLevel = (level) => {
  const fr = level.difficulty?.fakeRate || 0.35;
  const time = level.difficulty?.timeMs || 25000;
  const particles = level.difficulty?.particles || 40;
  let score = 0;
  if (fr >= 0.44) score += 2; else if (fr >= 0.38) score += 1;
  if (particles >= 48) score += 1; else if (particles >= 44) score += 0.5;
  if (time <= 24000) score += 1; else if (time <= 26000) score += 0.5;
  if (level.hidden) score += 0.5;
  return Math.max(1, Math.min(5, Math.round(score + 1.5)));
};

const showLibraryDetail = (level) => {
  document.getElementById("detailWord").textContent = level.char;
  document.getElementById("detailOrigin").textContent = level.origin || "暂无记录";
  document.getElementById("detailDistorted").textContent = level.distorted || level.polluted || "暂无记录";
  const examplesList = document.getElementById("detailExamples");
  examplesList.innerHTML = "";
  if (level.examples && level.examples.length > 0) {
    level.examples.forEach(example => {
      const li = document.createElement("li");
      li.textContent = example;
      examplesList.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "暂无例句";
    examplesList.appendChild(li);
  }
  const detailModal = document.getElementById("detailModal");
  detailModal.classList.add("show");
  document.body.style.overflow = "hidden";
};

const initLibrary = () => {
  clearBackground();
  setHud("");
  document.title = "字库图鉴 - 汉字考古2126";

  const discovered = store.discovered || {};
  const unlockedLevels = Object.keys(discovered).length;

  const root = mk("div", "library-screen");
  root.innerHTML = `
    <button class="back-button" id="libBackBtn" aria-label="返回首页">\u2190</button>
    <div class="library-container">
      <header class="library-header">
        <h1 class="library-title">字库图鉴</h1>
        <p class="library-subtitle">已解锁 ${unlockedLevels} / ${LEVELS.length}</p>
      </header>
      <div class="cards-grid" id="cardsGrid"></div>
      <footer class="library-footer">
        <p class="footer-text">后续更多关卡小编正在努力制作，请敬请期待~~</p>
      </footer>
    </div>
  `;
  app.appendChild(root);

  root.querySelector("#libBackBtn").onclick = () => setMode(Mode.HOME);

  const cardsGrid = root.querySelector("#cardsGrid");
  LEVELS.forEach((level) => {
    const isUnlocked = discovered[level.id];
    const card = mk("div", `meme-card ${isUnlocked ? "" : "locked"}`);
    const diff = getDifficultyLevel(level);
    const dots = Array.from({length: 5}, (_, i) => `<span class="dot ${i < diff ? "active" : ""}"></span>`).join("");
    const bestScore = store[`best_${level.id}`] || 0;

    if (isUnlocked) {
      card.innerHTML = `
        <div class="card-word">${level.char}</div>
        ${level.hidden ? '<div style="text-align:center"><span class="card-tag hidden-tag">隐藏关卡</span></div>' : ""}
        <div class="card-difficulty">${dots}</div>
        ${bestScore > 0 ? `<div class="card-best">最高分 ${bestScore}</div>` : ""}
        <div class="card-status-wrapper"><div class="card-status">已解锁</div></div>
        <button class="card-play-btn" data-id="${level.id}">再次挑战</button>
      `;
      card.querySelector(".card-play-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        startLevelById(level.id);
      });
      card.addEventListener("click", () => showLibraryDetail(level));
    } else {
      card.innerHTML = `
        <div class="card-word">${level.char}</div>
        ${level.hidden ? '<div style="text-align:center"><span class="card-tag hidden-tag">隐藏关卡</span></div>' : ""}
        <div class="card-difficulty">${dots}</div>
        <div class="card-status-wrapper"><div class="card-status">待解锁</div></div>
      `;
    }
    cardsGrid.appendChild(card);
  });

  // 详情弹窗关闭
  const detailModal = document.getElementById("detailModal");
  const closeDetail = document.getElementById("closeDetail");
  if (closeDetail) closeDetail.onclick = () => { detailModal.classList.remove("show"); document.body.style.overflow = ""; };
  if (detailModal) detailModal.onclick = (e) => { if (e.target === detailModal) { detailModal.classList.remove("show"); document.body.style.overflow = ""; } };
  const detailContent = document.querySelector(".detail-content");
  if (detailContent) detailContent.onclick = (e) => e.stopPropagation();
};

const startTutorial = () => {
  // 随机选择一个简单的梗词作为教程关卡
  const tutorialLevels = LEVELS.filter(lv => lv.char.length <= 3);
  const randomLevel = tutorialLevels[Math.floor(Math.random() * tutorialLevels.length)] || LEVELS[0];
  const rt = buildLevelRuntime(randomLevel);

  state.mode = Mode.TUTORIAL;
  state.levelId = rt.id;
  state.level = rt;
  state.runStartAt = performance.now();
  state.runMistakes = 0;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.tutorial.firstCharCollected = false;

  applyTheme(rt.theme);
  setRandomBackground();
  initTutorialCountdown();
};

const initTutorial = () => {
  // 这个函数保留为空，实际逻辑在 startTutorial 中
};

const initTutorialCountdown = () => {
  setHud("教程演示");

  const root = mk("div", "countdown-screen");
  const container = mk("div", "countdown-container");

  const line1 = mk("div", "countdown-text");
  line1.textContent = "梗词淘金热";
  container.appendChild(line1);

  const line2 = mk("div", "countdown-text");
  line2.textContent = "游戏规则：";
  container.appendChild(line2);

  const line3 = mk("div", "countdown-text");
  line3.textContent = "请在规定时间内根据部分提示将残缺的梗词匹配完整";
  container.appendChild(line3);

  // 每个文本显示3秒
  setTimeout(() => {
    line1.classList.add("fade-in");
    setTimeout(() => line1.classList.add("fade-out"), 3000);
  }, 0);

  setTimeout(() => {
    line2.classList.add("fade-in");
    setTimeout(() => line2.classList.add("fade-out"), 3000);
  }, 3000);

  setTimeout(() => {
    line3.classList.add("fade-in");
    setTimeout(() => line3.classList.add("fade-out"), 3000);
  }, 6000);

  const countdownNum = mk("div", "countdown-number");
  container.appendChild(countdownNum);

  root.appendChild(container);
  app.appendChild(root);

  const showNumber = (num) => {
    countdownNum.textContent = num;
    countdownNum.classList.remove("scale-in");
    void countdownNum.offsetWidth;
    countdownNum.classList.add("scale-in");
  };

  setTimeout(() => showNumber("3"), 9000);
  setTimeout(() => showNumber("2"), 9800);
  setTimeout(() => showNumber("1"), 10600);
  setTimeout(() => {
    countdownNum.textContent = "开始！";
    countdownNum.classList.remove("scale-in");
    void countdownNum.offsetWidth;
    countdownNum.classList.add("scale-in", "start");
  }, 11400);

  setTimeout(() => {
    root.remove();
    initTutorialPhase1();
  }, 12200);
};

const initTutorialPhase1 = () => {
  const lv = state.level;
  setHud(`教程演示：请在规定时间内将残缺的梗词匹配完整 · 剩余 ${Math.ceil(lv.difficulty.timeMs / 1000)}s · 错误次数 0`);

  state.particles = [];
  state.collected = new Set();
  state.freeze = false;
  state.phase = Phase.XRAY;
  state.p1.deadlineAt = performance.now() + lv.difficulty.timeMs;
  state.p1.hintShown = false;
  state.p1.highlightShown = false;

  const tray = mk("div", "tray");

  // 计算显示部分：至少隐藏一个字符，最多显示一半
  const totalChars = lv.radicals.length;
  const hideCount = Math.max(1, Math.floor(totalChars / 2));
  const hideIndices = new Set();

  // 随机选择要隐藏的槽位
  while (hideIndices.size < hideCount) {
    hideIndices.add(Math.floor(Math.random() * totalChars));
  }

  const slots = lv.radicals.map((r, i) => {
    if (hideIndices.has(i)) {
      return `<div id="slot${i}" class="slot empty"></div>`;
    } else {
      return `<div id="slot${i}" class="slot hint">${r.text}</div>`;
    }
  }).join("");

  tray.innerHTML = slots;
  app.appendChild(tray);

  // 显示初始提示
  setTimeout(() => {
    const tutorialHint = mk("div", "tutorial-hint");
    tutorialHint.textContent = "先找找方框中存在的汉字吧~";
    app.appendChild(tutorialHint);
    setTimeout(() => tutorialHint.classList.add("show"), 50);
  }, 500);

  const makeParticle = (i) => {
    const targetCount = lv.radicals.length;
    const isTarget = i < targetCount;
    const isFake = !isTarget && Math.random() < lv.difficulty.fakeRate;
    let type = "slang";
    let text = randPick(lv.slangs);
    let radicalIndex = -1;
    if (isTarget) {
      type = "target";
      radicalIndex = i;
      text = lv.radicals?.[radicalIndex]?.text || "?";
    } else if (isFake) {
      type = "fake";
      text = randPick(lv.fakeRadicals) || randPick(MEME_WORDS) || "误";
    }

    const el = mk("div", "particle visible");
    el.textContent = text;
    app.appendChild(el);
    el.addEventListener("click", () => onTutorialParticleClick(i));

    state.particles.push({
      id: i,
      type,
      text,
      radicalIndex,
      xvw: Math.random() * 80 + 10,
      yvh: Math.random() * -100,
      speed: Math.random() * 0.18 + 0.10,
      wobble: Math.random() * 10,
      el,
    });
  };

  for (let i = 0; i < lv.difficulty.particles; i++) makeParticle(i);

  app.onpointermove = null;
  app.onpointerup = null;
  app.onpointerleave = null;

  state.raf = requestAnimationFrame(tickTutorialPhase1);
};

const onTutorialParticleClick = (id) => {
  if (state.phase !== Phase.XRAY) return;
  if (state.freeze) return;
  const p = state.particles.find((x) => x.id === id);
  if (!p) return;

  const lv = state.level;

  // 检查点击的字符是否属于目标梗词中的任意字符
  if (lv.targetCharsSet.has(p.text)) {
    // 找到对应的 radicalIndex
    let targetIndex = -1;
    for (let i = 0; i < lv.radicals.length; i++) {
      if (lv.radicals[i].text === p.text && !state.collected.has(i)) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex >= 0) {
      state.collected.add(targetIndex);
      p.el.remove();
      state.particles = state.particles.filter((x) => x.id !== id);
      syncTray();

      // 第一次收集字符时显示提示
      if (!state.tutorial.firstCharCollected) {
        state.tutorial.firstCharCollected = true;
        const oldHint = document.querySelector(".tutorial-hint");
        if (oldHint) {
          oldHint.classList.remove("show");
          setTimeout(() => oldHint.remove(), 400);
        }

        setTimeout(() => {
          const tutorialHint = mk("div", "tutorial-hint");
          tutorialHint.textContent = "干得不错喔，现在试试补全这个梗叭！";
          app.appendChild(tutorialHint);
          setTimeout(() => tutorialHint.classList.add("show"), 50);
          setTimeout(() => {
            tutorialHint.classList.remove("show");
            setTimeout(() => tutorialHint.remove(), 400);
          }, 3000);
        }, 500);
      }

      if (state.collected.size >= state.level.radicals.length) {
        state.freeze = true;
        setTimeout(() => {
          showTutorialEnd(true);
        }, 800);
      }
    }
  } else {
    // 不是目标字符，触发错误
    state.runMistakes += 1;
    state.freeze = true;
    toast("关键词错误 · 透镜冻结 5 秒");
    setTimeout(() => (state.freeze = false), state.level.difficulty.freezeMs);
  }
};

const tickTutorialPhase1 = (tRaf) => {
  if (state.phase !== Phase.XRAY) return;
  const t = Number.isFinite(tRaf) ? tRaf : performance.now();
  const dt = state.lastT ? clamp((t - state.lastT) / 16.6667, 0, 2.2) : 1;
  state.lastT = t;

  const remainMs = Math.max(0, Math.round(state.p1.deadlineAt - t));
  const remainSec = Math.ceil(remainMs / 1000);
  setHud(`教程演示：请在规定时间内将残缺的梗词匹配完整 · 剩余 ${remainSec}s · 错误次数 ${state.runMistakes}`);

  if (t > state.p1.deadlineAt) {
    // 教程模式时间到了，显示结束界面
    showTutorialEnd(false);
    return;
  }

  for (const p of state.particles) {
    p.yvh += p.speed * dt;
    p.xvw += Math.sin((p.yvh + p.wobble) * 0.06) * 0.02 * dt;
    if (p.yvh > 110) p.yvh = -10;
    if (p.xvw < 8) p.xvw = 92;
    if (p.xvw > 92) p.xvw = 8;

    p.el.style.left = `${p.xvw}vw`;
    p.el.style.top = `${p.yvh}vh`;

    const clickable = !state.freeze;
    p.el.classList.toggle("clickable", clickable);
  }

  state.raf = requestAnimationFrame(tickTutorialPhase1);
};

const showTutorialEnd = (success) => {
  cancelRaf();
  clearDynamicNodes();

  const root = mk("div", "screen");
  const card = mk("div", "card");
  root.appendChild(card);

  const title = mk("div", "title");
  title.textContent = success ? "教程完成！" : "教程演示结束";
  card.appendChild(title);

  const sub = mk("div", "sub");
  sub.textContent = success ? "恭喜你完成了教程关卡" : "时间到了，不过没关系";
  card.appendChild(sub);

  const row = mk("div", "row");
  card.appendChild(row);

  const backBtn = mk("button", "btn ghost");
  backBtn.textContent = "返回首页";
  backBtn.onclick = () => setMode(Mode.HOME);
  row.appendChild(backBtn);

  const startBtn = mk("button", "btn");
  startBtn.textContent = "开始Solo";
  startBtn.onclick = () => setMode(Mode.TIERSELECT);
  row.appendChild(startBtn);

  app.appendChild(root);
};

const initPhaseCountdown = () => {
  setHud("准备开始...");

  const root = mk("div", "countdown-screen");
  const container = mk("div", "countdown-container");

  const countdownNum = mk("div", "countdown-number");
  container.appendChild(countdownNum);

  root.appendChild(container);
  app.appendChild(root);

  const showNumber = (num) => {
    countdownNum.textContent = num;
    countdownNum.classList.remove("scale-in");
    void countdownNum.offsetWidth;
    countdownNum.classList.add("scale-in");
  };

  setTimeout(() => showNumber("3"), 0);
  setTimeout(() => showNumber("2"), 800);
  setTimeout(() => showNumber("1"), 1600);
  setTimeout(() => {
    countdownNum.textContent = "开始！";
    countdownNum.classList.remove("scale-in");
    void countdownNum.offsetWidth;
    countdownNum.classList.add("scale-in", "start");
  }, 2400);

  setTimeout(() => {
    root.remove();
    initPhase1();
  }, 3200);
};

const initPhase1 = () => {
  const lv = state.level;
  setHud(`梗词淘金热：请在规定时间内将残缺的梗词匹配完整 · 剩余 ${Math.ceil(lv.difficulty.timeMs / 1000)}s · 错误次数 0`);

  state.particles = [];
  state.collected = new Set();
  state.freeze = false;
  state.p1.deadlineAt = performance.now() + lv.difficulty.timeMs;
  state.p1.hintShown = false;
  state.p1.highlightShown = false;

  const tray = mk("div", "tray");

  // 计算显示部分：至少隐藏一个字符，最多显示一半
  const totalChars = lv.radicals.length;
  const hideCount = Math.max(1, Math.floor(totalChars / 2));
  const hideIndices = new Set();

  // 随机选择要隐藏的槽位
  while (hideIndices.size < hideCount) {
    hideIndices.add(Math.floor(Math.random() * totalChars));
  }

  const slots = lv.radicals.map((r, i) => {
    if (hideIndices.has(i)) {
      return `<div id="slot${i}" class="slot empty"></div>`;
    } else {
      return `<div id="slot${i}" class="slot hint">${r.text}</div>`;
    }
  }).join("");

  tray.innerHTML = slots;
  app.appendChild(tray);
  updateProgressBar();
  updateScoreHud();

  const makeParticle = (i) => {
    const targetCount = lv.radicals.length;
    const isTarget = i < targetCount;
    const isFake = !isTarget && Math.random() < lv.difficulty.fakeRate;
    let type = "slang";
    let text = randPick(lv.slangs);
    let radicalIndex = -1;
    if (isTarget) {
      type = "target";
      radicalIndex = i;
      text = lv.radicals?.[radicalIndex]?.text || "?";
    } else if (isFake) {
      type = "fake";
      text = randPick(lv.fakeRadicals) || randPick(MEME_WORDS) || "误";
    }

    const el = mk("div", "particle visible");
    el.textContent = text;
    app.appendChild(el);
    el.addEventListener("click", () => onParticleClick(i));

    state.particles.push({
      id: i,
      type,
      text,
      radicalIndex,
      xvw: Math.random() * 80 + 10,
      yvh: Math.random() * -100,
      speed: Math.random() * 0.18 + 0.10,
      wobble: Math.random() * 10,
      el,
    });
  };

  for (let i = 0; i < lv.difficulty.particles; i++) makeParticle(i);

  app.onpointermove = null;
  app.onpointerup = null;
  app.onpointerleave = null;

  state.raf = requestAnimationFrame(tickPhase1);
};

const syncTray = () => {
  const lv = state.level;
  for (let i = 0; i < lv.radicals.length; i++) {
    const slot = document.getElementById(`slot${i}`);
    if (!slot) continue;
    if (state.collected.has(i)) {
      slot.classList.add("ok");
      slot.classList.remove("hint");
      slot.textContent = lv.radicals[i].text;
      slot.style.fontSize = lv.radicals[i].text.length > 1 ? "28px" : "";
    } else {
      slot.classList.remove("ok");
      slot.style.fontSize = "";
    }
  }
};

const onParticleClick = (id) => {
  if (state.phase !== Phase.XRAY) return;
  if (state.freeze) return;
  const p = state.particles.find((x) => x.id === id);
  if (!p) return;

  const lv = state.level;
  const clickX = parseFloat(p.el.style.left);
  const clickY = parseFloat(p.el.style.top);

  // 检查点击的字符是否属于目标梗词中的任意字符
  if (lv.targetCharsSet.has(p.text)) {
    // 找到对应的 radicalIndex
    let targetIndex = -1;
    for (let i = 0; i < lv.radicals.length; i++) {
      if (lv.radicals[i].text === p.text && !state.collected.has(i)) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex >= 0) {
      state.collected.add(targetIndex);
      const pts = addScore(BASE_SCORE);
      spawnClickFx(clickX, clickY, p.text, true);
      updateScoreHud();
      p.el.remove();
      state.particles = state.particles.filter((x) => x.id !== id);
      syncTray();
      updateProgressBar();
      if (state.collected.size >= state.level.radicals.length) {
        // 完成奖励分
        addScore(500);
        updateScoreHud();
        state.freeze = true;
        setTimeout(() => setPhase(Phase.ASSEMBLY), 800);
      }
    }
  } else {
    // 不是目标字符，触发错误
    state.runMistakes += 1;
    resetCombo();
    updateScoreHud();
    spawnClickFx(clickX, clickY, p.text, false);
    state.freeze = true;
    toast("关键词错误 · 冻结 3 秒");
    setTimeout(() => (state.freeze = false), 3000);
  }
};

const showFailPopup = (reason) => {
  cancelRaf();
  state.freeze = true;
  if (state.characterManager) state.characterManager.stop();

  const overlay = mk("div", "fail-overlay");
  const popup = mk("div", "fail-popup");
  popup.innerHTML = `
    <div class="fail-icon">!</div>
    <div class="fail-title">挑战失败</div>
    <div class="fail-reason">${escapeHtml(reason)}</div>
    <div class="fail-actions">
      <button class="fail-btn fail-retry">重新挑战</button>
      <button class="fail-btn fail-quit">回到首页</button>
    </div>
  `;
  overlay.appendChild(popup);
  app.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  popup.querySelector(".fail-retry").onclick = () => {
    overlay.remove();
    startLevelById(state.levelId);
  };
  popup.querySelector(".fail-quit").onclick = () => {
    overlay.remove();
    clearBackground();
    setMode(Mode.HOME);
  };
};

const failPhase1 = () => {
  showFailPopup("时间耗尽，未能完成梗词匹配");
};

const failPhase2 = () => {
  showFailPopup("拼铸超时，未能完成词元拼接");
};

const tickPhase1 = (tRaf) => {
  if (state.phase !== Phase.XRAY) return;
  const t = Number.isFinite(tRaf) ? tRaf : performance.now();
  const dt = state.lastT ? clamp((t - state.lastT) / 16.6667, 0, 2.2) : 1;
  state.lastT = t;

  const remainMs = Math.max(0, Math.round(state.p1.deadlineAt - t));
  const remainSec = Math.ceil(remainMs / 1000);
  setHud(`梗词淘金热：请在规定时间内将残缺的梗词匹配完整 · 剩余 ${remainSec}s · 错误次数 ${state.runMistakes}`);

  // 剩余时间不足10s或错误次数达到3次，显示完整梗词提示
  if ((remainSec <= 10 || state.runMistakes >= 3) && !state.p1.hintShown) {
    state.p1.hintShown = true;

    // 在屏幕中央显示提示
    const hintOverlay = mk("div", "hint-overlay");
    const hintCard = mk("div", "hint-card");
    hintCard.innerHTML = `
      <div class="hint-title">时间已不足10秒</div>
      <div class="hint-word">目标梗词为：<span class="hint-target">${escapeHtml(state.level.char)}</span></div>
      <div class="hint-subtitle">请尽快完善梗词噢~</div>
    `;
    hintOverlay.appendChild(hintCard);
    app.appendChild(hintOverlay);

    setTimeout(() => hintCard.classList.add("show"), 50);
    setTimeout(() => {
      hintCard.classList.remove("show");
      setTimeout(() => hintOverlay.remove(), 400);
    }, 3000);

    // 显示所有槽位的完整字符
    for (let i = 0; i < state.level.radicals.length; i++) {
      const slot = document.getElementById(`slot${i}`);
      if (slot && !state.collected.has(i)) {
        slot.classList.remove("hint", "empty");
        slot.classList.add("hint");
        slot.textContent = state.level.radicals[i].text;
      }
    }
  }

  // 剩余时间不足3s，高亮显示目标汉字
  if (remainSec <= 3 && !state.p1.highlightShown) {
    state.p1.highlightShown = true;
    for (const p of state.particles) {
      if (state.level.targetCharsSet.has(p.text)) {
        p.el.classList.add("highlight");
      }
    }
  }

  if (t > state.p1.deadlineAt) {
    failPhase1();
    return;
  }

  for (const p of state.particles) {
    p.yvh += p.speed * dt;
    p.xvw += Math.sin((p.yvh + p.wobble) * 0.06) * 0.02 * dt;
    if (p.yvh > 110) p.yvh = -10;
    if (p.xvw < 8) p.xvw = 92;
    if (p.xvw > 92) p.xvw = 8;

    p.el.style.left = `${p.xvw}vw`;
    p.el.style.top = `${p.yvh}vh`;

    const clickable = !state.freeze;
    p.el.classList.toggle("clickable", clickable);
  }

  state.raf = requestAnimationFrame(tickPhase1);
};

const tickPhase2 = (tRaf) => {
  if (state.phase !== Phase.ASSEMBLY) return;
  const t = Number.isFinite(tRaf) ? tRaf : performance.now();
  const remainMs = Math.max(0, Math.round(state.p2.deadlineAt - t));
  const remainSec = Math.ceil(remainMs / 1000);
  setHud(`[ 阶段二 ] 词元拼接：拖拽字元贴合目标槽位 · 剩余 ${remainSec}s · 误触 ${state.runMistakes}`);

  if (t > state.p2.deadlineAt && !state.p2.snapped) {
    failPhase2();
    return;
  }
  state.raf = requestAnimationFrame(tickPhase2);
};

const initPhase2 = () => {
  const lv = state.level;
  setHud(
    `[ 阶段二 ] 词元拼接：拖拽字元贴合目标槽位 · 剩余 ${Math.ceil(lv.difficulty.assemblyTimeMs / 1000)}s · 误触 ${
      state.runMistakes
    }`
  );

  state.p2.dragging = -1;
  state.p2.snapped = false;
  state.p2.distance = 999;
  state.p2.pos = [];
  state.p2.deadlineAt = performance.now() + lv.difficulty.assemblyTimeMs;

  const root = mk("div", "phase2");
  const fx = mk("div", "phase2Fx");
  applyPhase2Fx(fx, lv.theme);
  root.appendChild(fx);

  const ghost = mk("div", "ghost");
  ghost.textContent = lv.char;
  root.appendChild(ghost);

  const frags = lv.radicals.map((r) => {
    const f = mk("div", "frag");
    f.textContent = r.text;
    if (r.text.length > 1) f.style.fontSize = "54px";
    root.appendChild(f);
    return f;
  });

  const slotEls = lv.radicals.map((r) => {
    const s = mk("div", "asmSlot");
    s.textContent = r.text;
    root.appendChild(s);
    return s;
  });

  app.appendChild(root);

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const gap = clamp(150 - lv.radicals.length * 10, 72, 112);
  const slotY = cy;
  const slotPos = lv.radicals.map((_, i) => ({ x: cx + (i - (lv.radicals.length - 1) / 2) * gap, y: slotY }));
  const fragToSlot = Array(lv.radicals.length).fill(-1);
  const slotFilledBy = Array(lv.radicals.length).fill(-1);

  for (let i = 0; i < frags.length; i++) {
    state.p2.pos.push({
      x: cx + (i - (frags.length - 1) / 2) * (gap + 8) + (Math.random() * 50 - 25),
      y: cy + 190 + (Math.random() * 44 - 22),
    });
  }

  const setFragPos = () => {
    for (let i = 0; i < frags.length; i++) {
      frags[i].style.left = `${state.p2.pos[i].x}px`;
      frags[i].style.top = `${state.p2.pos[i].y}px`;
    }
    for (let i = 0; i < slotEls.length; i++) {
      slotEls[i].style.left = `${slotPos[i].x}px`;
      slotEls[i].style.top = `${slotPos[i].y}px`;
      slotEls[i].classList.toggle("filled", slotFilledBy[i] >= 0);
    }
  };
  setFragPos();

  const pickNearestValidSlot = (fragIndex) => {
    const ch = lv.radicals[fragIndex]?.text;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < slotPos.length; i++) {
      if (slotFilledBy[i] >= 0) continue;
      if (lv.radicals[i]?.text !== ch) continue;
      const d = Math.hypot(state.p2.pos[fragIndex].x - slotPos[i].x, state.p2.pos[fragIndex].y - slotPos[i].y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return { slotIndex: bestIdx, distance: bestDist };
  };

  const settleIfComplete = () => {
    const doneCount = slotFilledBy.filter((x) => x >= 0).length;
    if (doneCount < lv.radicals.length) return false;
    state.p2.snapped = true;
    for (let i = 0; i < frags.length; i++) {
      frags[i].style.transition = "all 400ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      frags[i].style.left = `${slotPos[fragToSlot[i]].x}px`;
      frags[i].style.top = `${slotPos[fragToSlot[i]].y}px`;
    }
    const ping = mk("div", "ping");
    root.appendChild(ping);
    setTimeout(() => setPhase(Phase.AWAKEN), 900);
    return true;
  };

  const placeFragToSlot = (fragIndex, slotIndex) => {
    if (fragIndex < 0 || slotIndex < 0) return false;
    if (fragToSlot[fragIndex] >= 0 || slotFilledBy[slotIndex] >= 0) return false;
    fragToSlot[fragIndex] = slotIndex;
    slotFilledBy[slotIndex] = fragIndex;
    state.p2.pos[fragIndex] = { x: slotPos[slotIndex].x, y: slotPos[slotIndex].y };
    frags[fragIndex].classList.add("snapped");
    frags[fragIndex].style.pointerEvents = "none";
    frags[fragIndex].classList.remove("active");
    setFragPos();
    settleIfComplete();
    return true;
  };

  const down = (i) => {
    if (state.p2.snapped || fragToSlot[i] >= 0) return;
    state.p2.dragging = i;
    frags[i].classList.add("active");
  };
  frags.forEach((f, i) => (f.onpointerdown = () => down(i)));

  const move = (e) => {
    if (state.phase !== Phase.ASSEMBLY) return;
    if (state.p2.dragging < 0 || state.p2.snapped) return;
    const rect = app.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const i = state.p2.dragging;
    state.p2.pos[i] = { x, y };

    if (!lv.special) {
      const near = pickNearestValidSlot(i);
      if (near.slotIndex >= 0 && near.distance < 200) {
        const t = clamp((200 - near.distance) / 200, 0, 1) * 0.5;
        state.p2.pos[i].x += (slotPos[near.slotIndex].x - state.p2.pos[i].x) * t;
        state.p2.pos[i].y += (slotPos[near.slotIndex].y - state.p2.pos[i].y) * t;
      }
      const autoSnapDist = 50;
      if (near.slotIndex >= 0 && near.distance <= autoSnapDist) {
        placeFragToSlot(i, near.slotIndex);
        state.p2.dragging = -1;
      }
    }

    setFragPos();
  };

  const up = () => {
    if (state.phase !== Phase.ASSEMBLY) return;
    if (state.p2.dragging >= 0) frags[state.p2.dragging].classList.remove("active");
    const i = state.p2.dragging;
    state.p2.dragging = -1;
    if (state.p2.snapped || i < 0) return;

    const near = pickNearestValidSlot(i);
    const threshold = lv.special ? 60 : 100;
    if (near.slotIndex >= 0 && near.distance <= threshold) {
      placeFragToSlot(i, near.slotIndex);
    }
  };

  app.onpointermove = move;
  app.onpointerup = up;
  app.onpointerleave = up;
  state.raf = requestAnimationFrame(tickPhase2);
};

const initPhase3 = () => {
  const lv = state.level;
  setHud("");
  for (const t of state.p3.timers) clearTimeout(t);
  state.p3.timers = [];

  // 结果页停止角色干扰
  if (state.characterManager) {
    state.characterManager.stop();
  }

  const runTimeMs = Math.max(0, Math.round(performance.now() - state.runStartAt));
  const stars = calcStars();
  const timeSec = (runTimeMs / 1000).toFixed(1);
  const starStr = "★".repeat(stars) + "☆".repeat(3 - stars);

  const root = mk("div", "phase3 memeReport");
  const card = mk("div", "memeCard");
  card.innerHTML = `
    <div class="memeWord">${escapeHtml(lv.char)}</div>
    <div class="result-stars">${starStr}</div>
    <div class="result-stats-grid">
      <div class="stat-item"><div class="stat-val">${state.score}</div><div class="stat-label">得分</div></div>
      <div class="stat-item"><div class="stat-val">${state.maxCombo}x</div><div class="stat-label">最大连击</div></div>
      <div class="stat-item"><div class="stat-val">${timeSec}s</div><div class="stat-label">用时</div></div>
      <div class="stat-item"><div class="stat-val">${state.runMistakes}</div><div class="stat-label">失误</div></div>
    </div>
    <div id="meaningCompare" class="meaningCompare">
      <div class="meaningBlock">
        <h4>本意溯源</h4>
        <p>${escapeHtml(lv.origin || "暂无记录")}</p>
      </div>
      <div class="meaningBlock">
        <h4>扭曲含义</h4>
        <p>${escapeHtml(lv.distorted || lv.polluted || "暂无记录")}</p>
      </div>
    </div>
    <div id="examplesPanel" class="examplesPanel">
      <h4>烂梗泛滥后，厚重底蕴被消解，出现在如下场合：</h4>
      <ul>${(lv.examples || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("") || "<li>暂无例句</li>"}</ul>
    </div>
    <div class="result-actions">
      <button id="btnNext" class="btn btn-primary">下一梗词</button>
      <button id="btnMenu" class="btn btn-secondary">回到首页</button>
    </div>
  `;
  root.appendChild(card);
  app.appendChild(root);

  const meaningCompare = card.querySelector("#meaningCompare");
  const examplesPanel = card.querySelector("#examplesPanel");
  if (meaningCompare) state.p3.timers.push(setTimeout(() => meaningCompare.classList.add("on"), 350));
  if (examplesPanel) state.p3.timers.push(setTimeout(() => examplesPanel.classList.add("on"), 1900));

  const btnNext = card.querySelector("#btnNext");
  const btnMenu = card.querySelector("#btnMenu");
  const finish = (go) => {
    const flawless = state.runMistakes <= 0;
    applyProgress(lv.id, { flawless, runTimeMs });
    // 保存最高分
    const bestKey = `best_${lv.id}`;
    const prev = store[bestKey] || 0;
    if (state.score > prev) {
      store[bestKey] = state.score;
      saveStore(store);
    }
    if (go === "next") {
      const nextId = findNextPlayableId(lv.id);
      if (nextId === lv.id) {
        toast("当前难度已全部通关");
        setMode(Mode.TIERSELECT);
      } else {
        startLevelById(nextId);
      }
    } else {
      setMode(Mode.HOME);
    }
  };
  if (btnNext) btnNext.onclick = () => finish("next");
  if (btnMenu) btnMenu.onclick = () => finish("menu");
};

// 启动
setMode(Mode.HOME);
