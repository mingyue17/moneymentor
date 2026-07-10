/* ============================================================
   MoneyMentor shared application script
   Modules: storage, profile, xp + streak (Mento), navigation,
   dashboard, glossary, quiz, news decoder, chat.
   Each module activates only when its elements exist on the page.
   ============================================================ */

"use strict";

/* ---------- storage keys ---------- */
const PROFILE_KEY = "mm_learning_profile";
const SESSION_KEY = "mm_session_id";
const PROGRESS_KEY = "mm_original_split_progress";
const PENDING_QUESTION_KEY = "mm_pending_question";
const BEGINNER_MODE_KEY = "mm_beginner_mode";
const STORAGE_STAMP_KEY = "mm_storage_last_seen";
const PRACTICE_KEY = "mm_practice_lab_state";
const XP_KEY = "mm_xp_state";
const MARKET_RUN_STATE_KEY = "mm_marketrun_state";
const MARKET_RUN_BEST_KEY = "mm_marketrun_best";
const PULSE_OPENED_KEY = "mm_market_pulse_opened";
const STORAGE_EXPIRY_DAYS = 180;

// n8n profile-save webhook (production URL; workflow must be active in n8n).
const PROFILE_WEBHOOK_URL = "https://n8ngc.codeblazar.org/webhook/5bd93b7b-6804-4958-9626-abc1c84ad60d";
const CHAT_WEBHOOK_URL = "https://n8ngc.codeblazar.org/webhook/6b73ce01-53e9-4041-83e0-56e91e41b0ea/chat";

const MANAGED_STORAGE_KEYS = [
  SESSION_KEY, PROFILE_KEY, PROGRESS_KEY, PENDING_QUESTION_KEY,
  BEGINNER_MODE_KEY, STORAGE_STAMP_KEY, PRACTICE_KEY, XP_KEY,
  MARKET_RUN_STATE_KEY, MARKET_RUN_BEST_KEY,
  PULSE_OPENED_KEY, "mm_market_pulse_popups", "mm_lessons_done"
];

function applyStorageExpiry() {
  try {
    const now = Date.now();
    const lastSeen = Number(localStorage.getItem(STORAGE_STAMP_KEY) || 0);
    const maxAge = STORAGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (lastSeen && now - lastSeen > maxAge) {
      MANAGED_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    }
    localStorage.setItem(STORAGE_STAMP_KEY, String(now));
  } catch {}
}
applyStorageExpiry();

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function money(value) {
  return `S$${Number(value || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ---------- toast ---------- */
let toastTimer = null;
function showToast(message) {
  let toast = document.getElementById("mmToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "mmToast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

/* ---------- profile ---------- */
function makeSessionId() {
  if (globalThis.crypto?.randomUUID) return `mm-${globalThis.crypto.randomUUID()}`;
  return `mm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSessionId() {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = makeSessionId();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function defaultProfile() {
  const now = new Date().toISOString();
  return {
    sessionId: getSessionId(),
    nickname: "Guest",
    beginnerLevel: "Noob",
    budget: "S$500",
    riskComfort: "Low",
    timeHorizon: "6 months",
    goal: "Safety first",
    profileMode: "guest",
    createdAt: now,
    updatedAt: now
  };
}

function getProfile() {
  const stored = readJson(PROFILE_KEY, null);
  if (stored && stored.sessionId) {
    return { ...defaultProfile(), ...stored, sessionId: stored.sessionId };
  }
  const profile = defaultProfile();
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
  return profile;
}

function saveProfile(partial) {
  const existing = getProfile();
  const next = {
    ...existing,
    ...partial,
    sessionId: existing.sessionId || getSessionId(),
    updatedAt: new Date().toISOString()
  };
  if (!next.createdAt) next.createdAt = next.updatedAt;
  localStorage.setItem(SESSION_KEY, next.sessionId);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  updateProfileUi(next);
  syncProfileToN8n(next);
  return next;
}

// Fire-and-forget sync; the site keeps working from localStorage if n8n is down.
function syncProfileToN8n(profile) {
  if (!PROFILE_WEBHOOK_URL) return;
  const payload = {
    session_id: profile.sessionId,
    nickname: profile.nickname,
    beginner_level: profile.beginnerLevel,
    budget_range: profile.budget,
    risk_comfort: profile.riskComfort,
    time_horizon: profile.timeHorizon,
    main_goal: profile.goal,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt
  };
  fetch(PROFILE_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch((err) => {
    console.warn("MoneyMentor: profile sync failed (site still works locally).", err);
  });
}

function updateProfileUi(profile = getProfile()) {
  const displayName = profile.nickname?.trim() || "Guest";
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText("profileStatusName", displayName);
  setText("profileStatusLevel", profile.beginnerLevel);
  setText("profileStatusBudget", profile.budget);
  setText("profileStatusRisk", profile.riskComfort);
  setText("profileStatusHorizon", profile.timeHorizon);
  setText("profileStatusGoal", profile.goal);

  document.querySelectorAll("[data-profile-name]").forEach((el) => {
    el.textContent = displayName;
  });
  document.querySelectorAll("[data-profile-initial]").forEach((el) => {
    el.textContent = displayName.slice(0, 1).toUpperCase() || "G";
  });
}

/* ---------- beginner mode ---------- */
function isBeginnerMode() {
  return localStorage.getItem(BEGINNER_MODE_KEY) !== "off";
}

function setBeginnerMode(enabled) {
  localStorage.setItem(BEGINNER_MODE_KEY, enabled ? "on" : "off");
  applyBeginnerMode();
}

function applyBeginnerMode() {
  const enabled = isBeginnerMode();
  document.body.classList.toggle("beginner-mode-on", enabled);
  document.body.classList.toggle("beginner-mode-off", !enabled);
  document.querySelectorAll("[data-beginner-mode-status]").forEach((el) => {
    el.textContent = enabled ? "On" : "Off";
  });
}

/* ---------- XP, levels, streak (Mento the coach) ---------- */
const LEVEL_TITLES = [
  "Total Newbie", "Kopi-Money Saver", "Steady Starter", "Habit Builder",
  "Diversifier", "Blue-Chip Brain", "Market Navigator", "Compound Captain",
  "Zen Investor", "Mentor Material"
];

const MENTO_TIPS = [
  "Time in the market beats timing the market. Boring, but true.",
  "Before any investment: can you explain what could go wrong with it?",
  "S$100 a month from age 20 usually beats S$300 a month from age 30. Compounding is patient.",
  "A high dividend yield can be a warning sign, not a gift. Check why it's high.",
  "Guaranteed returns plus high returns equals scam. Every single time.",
  "Diversification is the only free lunch in investing. One stock is a bet; thirty is a portfolio.",
  "Red days are the entry fee for long-term returns. Panic-selling turns them into real losses.",
  "Fees look tiny but compound just like returns do - against you.",
  "Check the MAS Investor Alert List before trusting anyone with your money. Takes 30 seconds.",
  "Emergency fund first. Invest only money you won't need for 5 years.",
  "Nobody on TikTok knows next month's prices. Including the confident ones.",
  "The STI ETF holds 30 companies in one buy. Diversification for one kopi-decision's effort."
];

function getXpState() {
  const state = readJson(XP_KEY, null);
  if (state && typeof state.xp === "number") {
    return { xp: 0, streak: 0, lastVisit: "", awards: {}, ...state };
  }
  return { xp: 0, streak: 0, lastVisit: "", awards: {} };
}

function saveXpState(state) {
  try { localStorage.setItem(XP_KEY, JSON.stringify(state)); } catch {}
}

function levelInfo(xp) {
  let level = 1;
  let base = 0;
  let need = 100;
  while (xp >= base + need && level < LEVEL_TITLES.length) {
    base += need;
    level += 1;
    need = 100 + (level - 1) * 75;
  }
  const into = Math.max(0, xp - base);
  return {
    level,
    title: LEVEL_TITLES[level - 1],
    into,
    need,
    pct: level >= LEVEL_TITLES.length ? 100 : Math.min(100, Math.round((into / need) * 100))
  };
}

function addXp(amount, onceKey = null, reason = "") {
  const state = getXpState();
  if (onceKey) {
    if (state.awards[onceKey]) return state;
    state.awards[onceKey] = true;
  }
  const before = levelInfo(state.xp).level;
  state.xp += Math.round(amount);
  saveXpState(state);
  const after = levelInfo(state.xp);
  if (after.level > before) {
    showToast(`Level up! You're now Level ${after.level}: ${after.title}`);
  } else if (reason) {
    showToast(`+${Math.round(amount)} XP - ${reason}`);
  }
  renderXp();
  return state;
}
// Exposed for the Practice Lab game script.
window.mmAddXp = addXp;

function trackDailyVisit() {
  const state = getXpState();
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastVisit === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak = state.lastVisit === yesterday ? (state.streak || 0) + 1 : 1;
  state.lastVisit = today;
  saveXpState(state);
  addXp(10, null, state.streak > 1 ? `Day ${state.streak} streak` : "Welcome back");
}

function mentoTipForToday() {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return MENTO_TIPS[dayIndex % MENTO_TIPS.length];
}

function renderXp() {
  const state = getXpState();
  const info = levelInfo(state.xp);
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText("xpLevelNum", `Level ${info.level}`);
  setText("xpLevelTitle", info.title);
  setText("xpCount", info.level >= LEVEL_TITLES.length ? `${state.xp} XP - max level reached` : `${info.into} / ${info.need} XP to Level ${info.level + 1}`);
  setText("xpTotal", `${state.xp} XP`);
  setText("xpStreak", state.streak > 1 ? `${state.streak}-day streak` : "1-day streak");
  const fill = document.getElementById("xpBarFill");
  if (fill) fill.style.width = `${info.pct}%`;
  const tip = document.getElementById("mentoTip");
  if (tip && !tip.dataset.filled) {
    tip.textContent = mentoTipForToday();
    tip.dataset.filled = "yes";
  }
}

/* ---------- navigation ---------- */
const BOTTOM_NAV_ITEMS = [
  { page: "home", label: "Home", href: "index.html", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>' },
  { page: "learn", label: "Learn", href: "learn.html", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
  { page: "practice", label: "Practice", href: "practice.html", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17h18"/><path d="M7 13l3-3 3 2 4-6"/><path d="M7 21V9"/><path d="M17 21V6"/></svg>' },
  { page: "market", label: "Market", href: "market.html", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-4 4"/></svg>' },
  { page: "profile", label: "Profile", href: "profile.html", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' }
];

function setupNavigation() {
  const currentPage = document.body.dataset.page || "";

  document.querySelectorAll(".site-nav a[data-nav]").forEach((link) => {
    if (link.dataset.nav === currentPage) link.setAttribute("aria-current", "page");
  });

  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
    navLinks.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navLinks.classList.contains("open")) {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.focus();
      }
    });
  }

  if (!document.querySelector(".bottom-nav")) {
    const bottomNav = document.createElement("nav");
    bottomNav.className = "bottom-nav";
    bottomNav.setAttribute("aria-label", "Primary");
    bottomNav.innerHTML = BOTTOM_NAV_ITEMS.map((item) => `
      <a href="${item.href}" ${item.page === currentPage ? 'aria-current="page"' : ""}>${item.icon}<span>${item.label}</span></a>
    `).join("");
    document.body.appendChild(bottomNav);
  }
}

/* ---------- home dashboard ---------- */
function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function renderDashboardStats() {
  const levelEl = document.getElementById("dashLevel");
  if (!levelEl) return;
  const progress = getProgress();
  levelEl.textContent = levelFor(progress.best).name;
  const bestEl = document.getElementById("dashBest");
  if (bestEl) bestEl.textContent = `${progress.best}%`;
  const attemptsEl = document.getElementById("dashAttempts");
  if (attemptsEl) attemptsEl.textContent = progress.attempts;
}

function renderPracticeSummary() {
  const box = document.getElementById("dashPractice");
  if (!box) return;
  const state = readJson(MARKET_RUN_STATE_KEY, null);
  const best = Number(localStorage.getItem(MARKET_RUN_BEST_KEY) || 0);

  if (state && state.inProgress) {
    const pl = state.startCash ? ((state.portfolioValue / state.startCash - 1) * 100) : 0;
    box.innerHTML = `
      <div class="stat-row">
        <div class="stat-tile"><b>Month ${state.month}/12</b><span>Simulation progress</span></div>
        <div class="stat-tile"><b>${money(state.portfolioValue)}</b><span>Virtual portfolio</span></div>
        <div class="stat-tile"><b class="${pl < 0 ? "loss" : "gain"}">${pl >= 0 ? "+" : ""}${pl.toFixed(1)}%</b><span>Total P/L</span></div>
      </div>
      <div class="hero-cta" style="margin-top:16px"><a class="btn btn-primary btn-sm" href="practice.html">Resume Market Run</a></div>`;
  } else if (best > 0) {
    box.innerHTML = `
      <p class="dash-empty">Your best Market Run finished at <b>S$${best.toLocaleString("en-SG")}</b> from S$1,000 of virtual cash. Beat it and earn XP on the way.</p>
      <a class="btn btn-primary btn-sm" href="practice.html">Play again</a>`;
  } else {
    box.innerHTML = `
      <p class="dash-empty">You have not tried the Practice Lab yet. Survive one simulated year of the Singapore market with S$1,000 of pretend money &mdash; dividends, crashes, hype and all. No real money involved.</p>
      <a class="btn btn-primary btn-sm" href="practice.html">Start practising</a>`;
  }
}

function renderDashboardMarket() {
  const box = document.getElementById("dashMarket");
  if (!box) return;
  const opened = getOpenedAlerts();
  const alert = MARKET_ALERTS.find((item) => !opened.includes(item.id)) || MARKET_ALERTS[0];
  box.innerHTML = `
    <p class="dash-empty">Real headlines with sources and timestamps live on the Market page. Confused by one? The decoder explains why that kind of news moves prices.</p>
    <span class="news-tag" style="font-family:var(--mono);font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--amber)">Decoder pattern</span>
    <h3>${alert.title}</h3>
    <p>${alert.short}</p>
    <div class="hero-cta" style="margin-top:14px">
      <a class="btn btn-primary btn-sm" href="market.html#news">Today's real news</a>
      <a class="btn btn-ghost btn-sm" href="market.html#decoder">Open the decoder</a>
    </div>`;
}

function setupHomeDashboard() {
  const greetEl = document.getElementById("dashGreeting");
  if (!greetEl) return;
  const profile = getProfile();
  const name = profile.nickname && profile.nickname !== "Guest" ? `, ${profile.nickname}` : "";
  greetEl.textContent = `${greetingForNow()}${name}.`;
  renderDashboardStats();
  renderPracticeSummary();
  renderDashboardMarket();
}

/* ---------- profile page ---------- */
function setCheckedValue(name, value) {
  const input = [...document.querySelectorAll(`input[name="${name}"]`)].find((item) => item.value === value);
  if (input) input.checked = true;
}

function fillProfileForm(profile = getProfile()) {
  const form = document.getElementById("profileForm");
  if (!form) return;
  const nickname = document.getElementById("profileNickname");
  const budget = document.getElementById("profileBudget");
  const goal = document.getElementById("profileGoal");
  if (nickname) nickname.value = profile.profileMode === "guest" ? "" : profile.nickname || "";
  if (budget) budget.value = profile.budget || "S$500";
  if (goal) goal.value = profile.goal || "Safety first";
  setCheckedValue("beginnerLevel", profile.beginnerLevel || "Noob");
  setCheckedValue("riskComfort", profile.riskComfort || "Low");
  setCheckedValue("timeHorizon", profile.timeHorizon || "6 months");
}

function profileFromForm(mode = "profile") {
  const form = document.getElementById("profileForm");
  const data = new FormData(form);
  const nickname = String(data.get("nickname") || "").trim();
  return {
    nickname: mode === "guest" ? "Guest" : nickname || "Guest",
    beginnerLevel: String(data.get("beginnerLevel") || "Noob"),
    budget: String(data.get("budget") || "S$500"),
    riskComfort: String(data.get("riskComfort") || "Low"),
    timeHorizon: String(data.get("timeHorizon") || "6 months"),
    goal: String(data.get("goal") || "Safety first"),
    profileMode: mode
  };
}

function showProfileSuccess(message = "Profile saved.") {
  const box = document.getElementById("profileSuccess");
  if (!box) return;
  box.textContent = message;
  box.classList.add("show");
}

function renderProfileProgress() {
  const box = document.getElementById("profileLearning");
  if (!box) return;
  const progress = getProgress();
  const xpState = getXpState();
  const info = levelInfo(xpState.xp);
  box.innerHTML = `
    <div class="summary-row"><span>Mentor level</span><b>Lv ${info.level} - ${info.title}</b></div>
    <div class="summary-row"><span>Total XP</span><b>${xpState.xp} XP</b></div>
    <div class="summary-row"><span>Visit streak</span><b>${xpState.streak > 1 ? `${xpState.streak} days` : "1 day"}</b></div>
    <div class="summary-row"><span>Quiz level</span><b>${levelFor(progress.best).name}</b></div>
    <div class="summary-row"><span>Best quiz score</span><b>${progress.best}%</b></div>
    <div class="summary-row"><span>Quiz attempts</span><b>${progress.attempts}</b></div>`;
}

function setupProfilePage() {
  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    fillProfileForm();
    profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveProfile(profileFromForm("profile"));
      showProfileSuccess("Profile saved. Your recommendations and chat answers now use these preferences.");
      addXp(20, "profile-saved", "Profile set up");
      renderProfileProgress();
    });
    const startGuest = document.getElementById("startGuest");
    if (startGuest) {
      startGuest.addEventListener("click", () => {
        const profile = saveProfile({ ...profileFromForm("guest"), nickname: "Guest", profileMode: "guest" });
        fillProfileForm(profile);
        showProfileSuccess("Continuing as Guest. Your progress is still saved in this browser.");
        renderProfileProgress();
      });
    }
  }

  const beginnerToggle = document.getElementById("beginnerModeToggle");
  if (beginnerToggle) {
    beginnerToggle.checked = isBeginnerMode();
    beginnerToggle.addEventListener("change", () => setBeginnerMode(beginnerToggle.checked));
  }

  const resetLearning = document.getElementById("resetLearning");
  if (resetLearning) {
    resetLearning.addEventListener("click", () => {
      if (!window.confirm("Reset your XP, streak, quiz scores, and Practice Lab history? Your profile details are kept.")) return;
      [PROGRESS_KEY, XP_KEY, MARKET_RUN_STATE_KEY, MARKET_RUN_BEST_KEY, PULSE_OPENED_KEY, PRACTICE_KEY].forEach((key) => localStorage.removeItem(key));
      showToast("Progress reset.");
      renderXp();
      renderProfileProgress();
    });
  }

  renderProfileProgress();
}

/* ---------- glossary ---------- */
const TERMS = [
  ["Stock / Share", "A small piece of ownership in a company. Own a share and you own a tiny slice of that business."],
  ["ETF", "A single fund you buy like a share that holds many companies at once, so one purchase spreads your money across lots of them."],
  ["Index fund", "A fund that simply tracks a market list, like the STI, instead of paying managers to pick stocks."],
  ["Blue chip", "A share in a large, well-established, financially strong company with a long track record, such as DBS or Singtel."],
  ["Market cap", "A company's total market value: its share price times how many shares exist. Bigger usually means more stable."],
  ["Dividend", "A slice of a company's profit paid out in cash to shareholders, just for holding the stock."],
  ["Diversification", "Spreading money across different investments so one bad performer does not sink everything."],
  ["Liquidity", "How quickly you can turn an investment back into cash. Shares are liquid; property is not."],
  ["P/E ratio", "Price divided by earnings, a rough gauge of whether a stock looks cheap or expensive versus its profits."],
  ["Volatility", "How much and how fast a price swings up and down. Higher volatility means a bumpier ride."],
  ["Bull market", "A stretch when prices are generally rising and optimism is high."],
  ["Bear market", "A stretch when prices are falling, usually 20% or more from recent highs."],
  ["Bubble", "When hype pushes prices far above what a business is really worth, until it eventually pops."],
  ["Compounding", "Earning returns on your past returns, so your money snowballs the longer it stays invested."],
  ["Dollar-cost averaging", "Investing a fixed amount on a regular schedule, so you buy more units when prices are low and fewer when high."],
  ["Asset allocation", "How you split money between riskier assets and safer ones based on your goals and age."],
  ["Bond", "A loan you give to a government or company that pays you interest and returns your money at the end of the term."],
  ["REIT", "A listed company that owns income-producing property and pays out most of the rent as dividends."],
  ["Expense ratio", "The yearly fee a fund charges, shown as a percentage. Small differences add up a lot over decades."],
  ["Risk vs return", "The core trade-off: higher potential returns almost always come with a higher chance of loss."],
  ["Brokerage account", "The account you open with a broker to actually buy and sell shares on an exchange."],
  ["CDP account", "A Central Depository account that holds your SGX shares in your own name."]
];

function renderTerms(list) {
  const libGrid = document.getElementById("libGrid");
  const libEmpty = document.getElementById("libEmpty");
  if (!libGrid || !libEmpty) return;
  libGrid.innerHTML = "";
  list.forEach(([term, desc]) => {
    const el = document.createElement("div");
    el.className = "term";
    const h = document.createElement("h4");
    h.textContent = term;
    const p = document.createElement("p");
    p.textContent = desc;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-quiet btn-sm";
    b.style.marginTop = "14px";
    b.textContent = "Ask MoneyMentor";
    b.addEventListener("click", () => openChatWithQuestion(`Explain ${term} in simple beginner language with a Singapore investing example.`));
    el.append(h, p, b);
    libGrid.appendChild(el);
  });
  libEmpty.style.display = list.length ? "none" : "block";
}

function setupGlossary() {
  const libGrid = document.getElementById("libGrid");
  const libSearch = document.getElementById("libSearch");
  if (!libGrid || !libSearch) return;
  renderTerms(TERMS);
  libSearch.addEventListener("input", (event) => {
    const q = event.target.value.trim().toLowerCase();
    renderTerms(q ? TERMS.filter(([term, desc]) => `${term} ${desc}`.toLowerCase().includes(q)) : TERMS);
  });
}

/* ---------- quiz ---------- */
const QUIZ = [
  { level: "Noob", type: "Meaning", q: "What is an ETF?", options: ["A single company share", "A fund traded like a share that can hold many investments", "A guaranteed government savings account", "A bank loan"], answer: 1, why: "An ETF is a fund that trades like a share. It can hold many stocks, bonds, or other assets." },
  { level: "Noob", type: "Scenario", q: "A beginner has S$500 and is afraid of losing money. Which first route is usually the most safety-focused?", options: ["One trending stock", "Singapore Savings Bonds", "Borrowing money to invest", "A Telegram group promising returns"], answer: 1, why: "For safety-first beginners, SSBs are a sensible starting route because they are backed by the Singapore Government and start from S$500." },
  { level: "Starter", type: "Meaning", q: "What does diversification mean?", options: ["Buying only one stock", "Spreading money across different investments", "Checking prices every hour", "Selling whenever markets fall"], answer: 1, why: "Diversification spreads risk so one bad performer does not damage the whole portfolio." },
  { level: "Starter", type: "Scenario", q: "You can add S$100 every month. Which route best matches a steady beginner habit?", options: ["Regular savings plan or monthly ETF investing", "One random stock every month", "Only investing when social media is excited", "Switching platforms weekly"], answer: 0, why: "A regular savings plan or monthly ETF route supports dollar-cost averaging and builds the habit gradually." },
  { level: "Builder", type: "Meaning", q: "What is a REIT?", options: ["A crypto token", "A listed vehicle that owns income-producing property", "A bank savings account", "A tax form"], answer: 1, why: "A REIT owns income-producing property such as malls, offices, or logistics assets, and often pays distributions." },
  { level: "Builder", type: "Scenario", q: "A REIT gives a high yield. What should a beginner check before getting excited?", options: ["Only the yield number", "Occupancy, gearing, interest-rate sensitivity, and distribution history", "Whether influencers like it", "Whether the logo looks professional"], answer: 1, why: "High yield can hide risk. Check occupancy, gearing, debt costs, and whether distributions are sustainable." },
  { level: "Confident", type: "Meaning", q: "What is dollar-cost averaging?", options: ["Investing a fixed amount regularly", "Buying only at the yearly low", "Selling after every gain", "Choosing the cheapest stock"], answer: 0, why: "Dollar-cost averaging means investing a fixed amount regularly instead of trying to time the market." },
  { level: "Confident", type: "Scenario", q: "The market drops sharply after bad news. What is the most beginner-safe response?", options: ["Panic sell immediately", "Borrow money to buy more instantly", "Review time horizon, diversification, and original reason", "Ignore all risk"], answer: 2, why: "A market drop should trigger calm review, not panic." },
  { level: "Advanced", type: "Meaning", q: "What does liquidity mean?", options: ["How quickly an investment can be turned into cash", "How famous a company is", "How high the dividend is", "How often news mentions it"], answer: 0, why: "Liquidity is how easily and quickly you can turn an investment into cash." },
  { level: "Advanced", type: "Scenario", q: "A Telegram group promises 20% monthly returns with no risk. What should MoneyMentor advise?", options: ["Invest quickly", "Treat it as a scam red flag and verify with official sources such as MAS alerts", "Ask friends to join", "Invest a small amount"], answer: 1, why: "Guaranteed high returns with no risk are a major scam warning." }
];

const LEVELS = [
  { name: "Noob", min: 0 },
  { name: "Starter", min: 20 },
  { name: "Builder", min: 40 },
  { name: "Confident", min: 70 },
  { name: "Advanced", min: 90 }
];

let quizIndex = 0;
let selectedOption = null;
let quizAnswers = [];

function getProgress() {
  return readJson(PROGRESS_KEY, { best: 0, attempts: 0 });
}

function saveProgress(score) {
  const progress = getProgress();
  progress.attempts += 1;
  progress.best = Math.max(progress.best, score);
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  addXp(Math.max(10, Math.round(score / 2)), null, "Quiz completed");
  updateProgress(score);
}

function levelFor(score) {
  return [...LEVELS].reverse().find((level) => score >= level.min) || LEVELS[0];
}

function updateProgress(latest = null) {
  const progress = getProgress();
  const score = latest ?? progress.best;
  const level = levelFor(score);
  const next = LEVELS.find((candidate) => candidate.min > score);
  const fill = next ? Math.min(100, (score / next.min) * 100) : 100;
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText("levelName", level.name);
  setText("nextLevel", next ? `Next: ${next.name}` : "Top level");
  setText("bestScore", `${progress.best}%`);
  setText("attempts", progress.attempts);
  const progressFill = document.getElementById("progressFill");
  if (progressFill) progressFill.style.width = `${fill}%`;
}

function renderQuestion() {
  const item = QUIZ[quizIndex];
  selectedOption = null;
  document.getElementById("quizCount").textContent = `Question ${quizIndex + 1} of ${QUIZ.length}`;
  document.getElementById("quizLevel").textContent = `${item.level} - ${item.type}`;
  document.getElementById("quizQuestion").textContent = item.q;
  document.getElementById("quizExplain").textContent = "";
  const options = document.getElementById("quizOptions");
  options.innerHTML = "";
  item.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "quiz-option";
    button.type = "button";
    button.textContent = option;
    button.addEventListener("click", () => {
      selectedOption = index;
      options.querySelectorAll(".quiz-option").forEach((b) => b.classList.remove("selected"));
      button.classList.add("selected");
      document.getElementById("quizExplain").textContent = item.why;
    });
    options.appendChild(button);
  });
  document.getElementById("nextQuestion").textContent = quizIndex === QUIZ.length - 1 ? "Finish quiz" : "Next question";
}

function finishQuiz() {
  const quizShell = document.getElementById("quizShell");
  const quizResults = document.getElementById("quizResults");
  const correct = quizAnswers.filter((answer) => answer.correct).length;
  const score = Math.round((correct / QUIZ.length) * 100);
  saveProgress(score);
  quizShell.style.display = "none";
  quizResults.style.display = "block";
  document.getElementById("resultScore").textContent = `${score}%`;
  document.getElementById("resultLevel").textContent = levelFor(score).name;
  document.getElementById("resultSummary").textContent =
    score >= 80 ? "Strong result. You understand beginner meanings and can handle investing scenarios." :
    score >= 50 ? "Good start. Review the missed scenarios, then retake the quiz." :
    "Start with the Investing basics lesson, then retake the quiz.";
  const review = document.getElementById("reviewList");
  review.innerHTML = "";
  quizAnswers.forEach((answer, i) => {
    const item = QUIZ[i];
    const div = document.createElement("div");
    div.className = `review-item ${answer.correct ? "" : "wrong"}`;
    div.innerHTML = `<strong>${i + 1}. ${item.level} ${item.type}</strong><br>${item.q}<br><span>${answer.correct ? "Correct" : `Your answer: ${item.options[answer.selected] || "No answer"} - Correct: ${item.options[item.answer]}`}</span><p>${item.why}</p>`;
    review.appendChild(div);
  });
}

function setupQuiz() {
  const quizShell = document.getElementById("quizShell");
  if (!quizShell) return;
  updateProgress();
  renderQuestion();
  document.getElementById("nextQuestion").addEventListener("click", () => {
    if (selectedOption === null) {
      document.getElementById("quizExplain").textContent = "Choose one answer before moving on.";
      return;
    }
    const item = QUIZ[quizIndex];
    quizAnswers.push({ selected: selectedOption, correct: selectedOption === item.answer });
    if (quizIndex === QUIZ.length - 1) {
      finishQuiz();
      return;
    }
    quizIndex += 1;
    renderQuestion();
  });
  const retake = document.getElementById("retakeQuiz");
  if (retake) {
    retake.addEventListener("click", () => {
      quizIndex = 0;
      selectedOption = null;
      quizAnswers = [];
      document.getElementById("quizResults").style.display = "none";
      quizShell.style.display = "block";
      renderQuestion();
    });
  }
}

/* ---------- news decoder (why news moves prices) ---------- */
const MARKET_ALERTS = [
  {
    id: "sti-bank-move",
    label: "Rate news",
    title: "Bank stocks move after rate news",
    short: "DBS, OCBC, and UOB can move when interest-rate expectations change.",
    happened: "Interest-rate expectations affect bank lending margins, deposits, loan demand, and investor appetite for bank dividends.",
    beginner: "If bank shares jump or fall suddenly, do not treat the move as a simple buy signal. First ask whether earnings, dividends, interest rates, and valuation still make sense.",
    why: "The three local banks make up a large slice of the STI, so if you hold an STI ETF, rate news moves your money too - even if you own no bank shares directly.",
    riskContext: "Bank shares are single-company risk. An ETF spreads that risk but still falls when the whole sector falls.",
    affected: ["DBS", "OCBC", "UOB", "STI ETF"],
    sourceName: "The Business Times markets",
    sourceUrl: "https://www.businesstimes.com.sg/markets"
  },
  {
    id: "reits-borrowing-costs",
    label: "Sector pattern",
    title: "REITs react to borrowing costs",
    short: "REIT prices can move when investors expect higher or lower interest rates.",
    happened: "Many REITs use debt to own and manage property. Higher borrowing costs can pressure distributions and lower investor demand for high-yield assets.",
    beginner: "High yield is not free money. Check gearing, occupancy, debt maturity, and whether distributions look sustainable.",
    why: "REITs are popular with young Singaporean investors for their payouts. Understanding the interest-rate link stops you being surprised when the price drops while the yield still looks high.",
    riskContext: "A high advertised yield can signal higher risk, not a better deal.",
    affected: ["REITs", "REIT ETFs", "Income investors"],
    sourceName: "Reuters markets",
    sourceUrl: "https://www.reuters.com/markets/"
  },
  {
    id: "global-volatility",
    label: "Global shock",
    title: "Global sell-offs spill into Asia",
    short: "US and China headlines can affect Singapore shares even when the company itself did nothing wrong.",
    happened: "Singapore is an open market. Global risk-off moves can affect banks, tech-linked names, REITs, and broad ETFs through sentiment and fund flows.",
    beginner: "When markets fall together, focus on your time horizon and diversification. Broad weakness is different from a company-specific problem.",
    why: "Your first market drop will feel personal. It usually is not. Knowing the difference between a global wobble and a real problem stops panic-selling.",
    riskContext: "Short-term drops are normal. The real risk is selling low out of fear.",
    affected: ["STI ETF", "Global ETFs", "Blue chips"],
    sourceName: "CNA Business",
    sourceUrl: "https://www.channelnewsasia.com/business"
  },
  {
    id: "earnings-season",
    label: "Earnings",
    title: "Earnings reports move single stocks hard",
    short: "A company's quarterly results can move its share price sharply in one day - up or down.",
    happened: "Every quarter, listed companies report profits. If results beat what investors expected, the price often jumps; if they miss, it can fall fast - even when the business is still healthy.",
    beginner: "A stock falling after earnings does not automatically mean the company is dying, and a jump does not mean a sure win. The move is about expectations, not just results.",
    why: "If you ever own a single stock like DBS or Singtel, earnings dates are when your money moves most. ETF holders feel it less because 29 other companies cushion the move.",
    riskContext: "Single stocks carry event risk that diversified funds smooth out.",
    affected: ["Single stocks", "Blue chips"],
    sourceName: "SGX company announcements",
    sourceUrl: "https://www.sgx.com/securities/company-announcements"
  },
  {
    id: "scam-warning",
    label: "Safety",
    title: "\"Guaranteed return\" claims are a red flag",
    short: "Any group promising high returns with no risk should be treated as suspicious.",
    happened: "Scam messages often use urgency, fake testimonials, and guaranteed profits to pressure beginners into transferring money.",
    beginner: "Pause. Verify the firm or person through official sources before giving money, personal details, or account access.",
    why: "Young, new investors are the main target of investment scams in Singapore. Thirty seconds on the MAS Investor Alert List can save your whole starting amount.",
    riskContext: "If returns are guaranteed and high, the risk is the whole amount. Real investments never promise both.",
    affected: ["New investors", "Telegram groups", "High-yield schemes"],
    sourceName: "MAS Investor Alert List",
    sourceUrl: "https://www.mas.gov.sg/investor-alert-list"
  }
];

function getOpenedAlerts() {
  const ids = readJson(PULSE_OPENED_KEY, []);
  return Array.isArray(ids) ? ids : [];
}

function markAlertOpened(id) {
  const opened = getOpenedAlerts();
  if (!opened.includes(id)) {
    opened.push(id);
    try { localStorage.setItem(PULSE_OPENED_KEY, JSON.stringify([...new Set(opened)])); } catch {}
    addXp(15, `alert-${id}`, "Decoded a market pattern");
  }
}

function renderNewsDetail(id) {
  const detail = document.getElementById("newsDetail");
  if (!detail) return;
  const alert = MARKET_ALERTS.find((item) => item.id === id) || MARKET_ALERTS[0];
  detail.innerHTML = `
    <h3>${alert.title}</h3>
    <div class="pill-row">${alert.affected.map((item) => `<span class="pill">${item}</span>`).join("")}</div>
    <div class="news-block"><h4>What happens</h4><p>${alert.happened}</p></div>
    <div class="news-block"><h4>In plain English</h4><p>${alert.beginner}</p></div>
    <div class="news-block"><h4>Why this matters to you</h4><p>${alert.why}</p></div>
    <div class="news-block"><h4>Risk context</h4><p>${alert.riskContext}</p></div>
    <div class="news-foot">
      <span class="source-label">Where to watch this: <a href="${alert.sourceUrl}" target="_blank" rel="noopener">${alert.sourceName}</a></span>
    </div>`;
}

function renderNewsList(activeId) {
  const list = document.getElementById("newsList");
  if (!list) return;
  const opened = getOpenedAlerts();
  list.innerHTML = MARKET_ALERTS.map((alert) => `
    <button class="news-item ${opened.includes(alert.id) ? "opened" : ""} ${alert.id === activeId ? "active" : ""}" type="button" data-alert-id="${alert.id}" ${alert.id === activeId ? 'aria-current="true"' : ""}>
      <span class="news-status">${opened.includes(alert.id) ? "Decoded" : "+15 XP"}</span>
      <span class="news-tag">${alert.label}</span>
      <strong>${alert.title}</strong>
      <small>${alert.short}</small>
    </button>`).join("");
  list.querySelectorAll(".news-item").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.alertId;
      markAlertOpened(id);
      renderNewsList(id);
      renderNewsDetail(id);
      const detail = document.getElementById("newsDetail");
      if (detail && window.matchMedia("(max-width:1024px)").matches) {
        detail.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function setupMarketNews() {
  if (!document.getElementById("newsList")) return;
  const firstUnread = MARKET_ALERTS.find((alert) => !getOpenedAlerts().includes(alert.id)) || MARKET_ALERTS[0];
  renderNewsList(firstUnread.id);
  renderNewsDetail(firstUnread.id);
}

/* ---------- chat (n8n) ---------- */
const CHAT_ANSWER_POLICY = {
  answerStyle: "direct-first, beginner-friendly, Singapore-aware",
  recommendationMode: "ranked research shortlist, not vague homework",
  mustDo: [
    "Answer the user's actual question first before giving background.",
    "For scenario questions, give a concrete shortlist with reasons, risks, and suitable platform routes.",
    "For beginner term questions, define the term simply, give a Singapore example, and explain why it matters.",
    "For market/news questions, cite the source name, URL, and timestamp if live data tools are available.",
    "If live tools are unavailable, say that clearly and avoid pretending to know today's market."
  ],
  mustAvoid: [
    "Do not dodge with only 'go research this yourself'.",
    "Do not guarantee returns or say an investment will definitely make money.",
    "Do not use command language such as 'buy this now' or 'you must use this platform'.",
    "Do not hide risk warnings before the useful answer; give the useful answer first, then the risk."
  ]
};

const TRUSTED_SOURCE_BASIS = [
  { name: "MoneySense", useFor: "beginner investing concepts, risk, scams, product basics", url: "https://www.moneysense.gov.sg/" },
  { name: "MAS", useFor: "regulated firms, investor alerts, financial safety", url: "https://www.mas.gov.sg/" },
  { name: "CPF Board", useFor: "CPF, CPFIS, MediSave, SRS-related explanations", url: "https://www.cpf.gov.sg/" },
  { name: "SGX", useFor: "Singapore-listed securities, ETFs, REITs, local market context", url: "https://www.sgx.com/" },
  { name: "Reuters / CNA / The Business Times", useFor: "market news context, not final investment instructions", url: "https://www.reuters.com/markets/" }
];

const BEGINNER_RECOMMENDATION_UNIVERSE = [
  { symbol: "SSB", name: "Singapore Savings Bonds", role: "capital-preservation route", beginnerFit: "very high", keyRisk: "lower growth; minimum amount and issue terms matter" },
  { symbol: "T-bills", name: "Singapore Treasury Bills", role: "short-term government-backed route", beginnerFit: "high", keyRisk: "auction yield and reinvestment risk" },
  { symbol: "ES3 / G3B", name: "STI ETF", role: "Singapore broad-market ETF route", beginnerFit: "high for long-term learning", keyRisk: "market can fall; Singapore concentration" },
  { symbol: "A35", name: "ABF Singapore Bond ETF", role: "bond ETF learning route", beginnerFit: "medium-high", keyRisk: "bond prices can move when interest rates change" },
  { symbol: "D05", name: "DBS", role: "blue-chip bank candidate", beginnerFit: "medium", keyRisk: "bank earnings depend on rates, credit quality, and the economy" },
  { symbol: "O39", name: "OCBC", role: "blue-chip bank candidate", beginnerFit: "medium", keyRisk: "same bank-sector risks; not diversified alone" },
  { symbol: "U11", name: "UOB", role: "blue-chip bank candidate", beginnerFit: "medium", keyRisk: "same bank-sector risks; not diversified alone" },
  { symbol: "Z74", name: "Singtel", role: "defensive stock candidate", beginnerFit: "medium", keyRisk: "slower growth and execution risk" },
  { symbol: "REIT ETF / selected REITs", name: "Singapore REIT exposure", role: "income/property learning route", beginnerFit: "medium", keyRisk: "interest rates, debt costs, occupancy, and distribution cuts" }
];

function getChatMetadata() {
  const profile = getProfile();
  const xpState = getXpState();
  return {
    sessionId: profile.sessionId,
    currentPage: location.pathname.split("/").pop() || "index.html",
    profile,
    beginnerMode: isBeginnerMode(),
    quizProgress: getProgress(),
    xp: xpState.xp,
    mentorLevel: levelInfo(xpState.xp).level,
    visitStreak: xpState.streak,
    openedMarketAlerts: getOpenedAlerts(),
    answerPolicy: CHAT_ANSWER_POLICY,
    trustedSourceBasis: TRUSTED_SOURCE_BASIS,
    beginnerRecommendationUniverse: BEGINNER_RECOMMENDATION_UNIVERSE,
    googleSheetsMemoryTargets: [
      "User_Profile", "Chat_Log", "Recommendation_Log", "Quiz_Progress",
      "Practice_Portfolio", "Market_Pulse_Content", "Market_Pulse_Open_Log",
      "Learning_Progress", "Testing_Evidence"
    ]
  };
}

function showChatFallback(message = "MoneyMentor chat is still loading. Your question has been copied so you can paste it when the chat opens.") {
  if (findChatInput() || document.querySelector(".chat-window-toggle, [class*='chat-window-toggle'], .n8n-chat, [class*='chat-window']")) return;
  let box = document.getElementById("chatFallback");
  if (!box) {
    box = document.createElement("div");
    box.id = "chatFallback";
    box.className = "chat-fallback";
    box.setAttribute("role", "status");
    box.innerHTML = `<strong>Chat not ready yet</strong><p></p><button class="btn btn-primary btn-sm" type="button">Got it</button>`;
    document.body.appendChild(box);
    box.querySelector("button")?.addEventListener("click", () => box.classList.remove("show"));
  }
  box.querySelector("p").textContent = message;
  box.classList.add("show");
}

function hideChatFallback() {
  document.getElementById("chatFallback")?.classList.remove("show");
}

function findChatInput() {
  const scopedSelectors = [
    ".chat-window textarea",
    ".chat-window input:not([type='search'])",
    "[class*='chat-window'] textarea",
    "[class*='chat-window'] input:not([type='search'])",
    ".n8n-chat textarea",
    ".n8n-chat input:not([type='search'])"
  ];
  const scopedInput = scopedSelectors
    .map((selector) => document.querySelector(selector))
    .find((input) => input && input.offsetParent !== null && !input.closest(".lib-search"));
  if (scopedInput) return scopedInput;

  return Array.from(document.querySelectorAll("textarea, input:not([type='search'])"))
    .find((input) => {
      const label = `${input.id || ""} ${input.name || ""} ${input.className || ""} ${input.placeholder || ""}`.toLowerCase();
      return input.offsetParent !== null &&
        !input.closest(".lib-search") &&
        !label.includes("search") &&
        (label.includes("chat") || label.includes("message") || input.tagName === "TEXTAREA");
    });
}

function prefillChatInput(question, attempts = 0) {
  const input = findChatInput();
  if (input && question) {
    hideChatFallback();
    input.value = question;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    return true;
  }
  if (attempts < 12) {
    setTimeout(() => prefillChatInput(question, attempts + 1), 250);
    return false;
  }
  if (question) showChatFallback();
  return false;
}

function openChatWithQuestion(question = "") {
  if (question) {
    localStorage.setItem(PENDING_QUESTION_KEY, question);
    navigator.clipboard?.writeText(question).catch(() => {});
  }
  const toggle = document.querySelector(".chat-window-toggle, [class*='chat-window-toggle']");
  if (toggle) toggle.click();
  setTimeout(() => prefillChatInput(question), 250);
}

function setupChatTriggers() {
  document.querySelectorAll(".prompt-ai").forEach((button) => {
    button.addEventListener("click", () => openChatWithQuestion(button.dataset.question || ""));
  });
  document.querySelectorAll(".open-chat").forEach((button) => {
    button.addEventListener("click", () => openChatWithQuestion(""));
  });
}

/* Expand/shrink button so long answers are easier to read */
function addChatExpandButton() {
  const header = document.querySelector(".chat-window .chat-header, [class*='chat-window'] [class*='chat-header']");
  if (!header || header.querySelector(".chat-expand-btn")) return Boolean(header);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chat-expand-btn";
  btn.setAttribute("aria-label", "Expand chat window");
  btn.title = "Expand chat";
  btn.textContent = "⤢";
  btn.addEventListener("click", () => {
    const expanded = document.body.classList.toggle("chat-expanded");
    btn.textContent = expanded ? "⤡" : "⤢";
    btn.title = expanded ? "Shrink chat" : "Expand chat";
  });
  header.appendChild(btn);
  return true;
}

function watchForChatHeader() {
  if (addChatExpandButton()) return;
  const observer = new MutationObserver(() => {
    if (addChatExpandButton()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function loadChatWidget() {
  import("https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js")
    .then(({ createChat }) => {
      createChat({
        webhookUrl: CHAT_WEBHOOK_URL,
        mode: "window",
        enableStreaming: true,
        showWelcomeScreen: false,
        sessionId: getProfile().sessionId,
        metadata: getChatMetadata(),
        initialMessages: [
          "Hi! I'm MoneyMentor.",
          "Ask me to explain investing terms, decode a news headline, or build a ranked research shortlist.",
          "I use your saved learning profile, and I always explain the risk alongside the answer."
        ],
        i18n: {
          en: {
            title: "MoneyMentor",
            subtitle: "Investing, minus the jargon.",
            inputPlaceholder: "Ask about ETFs, CPF, scams...",
            getStarted: "New conversation",
            footer: ""
          }
        }
      });
      const pending = localStorage.getItem(PENDING_QUESTION_KEY);
      if (pending) setTimeout(() => prefillChatInput(pending), 500);
      watchForChatHeader();
    })
    .catch(() => {
      console.warn("Chat widget could not load.");
      showChatFallback("MoneyMentor chat could not load. Check your connection, then refresh this page.");
    });
}

/* ---------- reveal on scroll ---------- */
function setupReveal() {
  const revealEls = document.querySelectorAll(".reveal");
  if (!revealEls.length) return;
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }
}

function setupAnchorScroll() {
  document.querySelectorAll("a[href^='#']").forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id.length <= 1) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ---------- boot ---------- */
setupNavigation();
updateProfileUi();
applyBeginnerMode();
trackDailyVisit();
renderXp();
setupHomeDashboard();
setupProfilePage();
setupGlossary();
setupQuiz();
setupMarketNews();
setupChatTriggers();
setupReveal();
setupAnchorScroll();
updateProgress();
loadChatWidget();
