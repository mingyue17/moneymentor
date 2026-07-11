/* ============================================================
   MoneyMentor shared application script
   Modules: storage, profile, navigation, lessons, dashboard,
   glossary, quiz, market news, chat.
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
const LESSONS_KEY = "mm_lessons_done";
const MARKET_RUN_STATE_KEY = "mm_marketrun_state";
const MARKET_RUN_BEST_KEY = "mm_marketrun_best";
const PULSE_OPENED_KEY = "mm_market_pulse_opened";
const MARKET_DECODER_KEY = "mm_market_decoder_decoded";
const STORAGE_EXPIRY_DAYS = 180;

// n8n profile-save webhook (production URL; workflow must be active in n8n).
const PROFILE_WEBHOOK_URL = "https://n8ngc.codeblazar.org/webhook/5bd93b7b-6804-4958-9626-abc1c84ad60d";
const CHAT_WEBHOOK_URL = "https://n8ngc.codeblazar.org/webhook/6b73ce01-53e9-4041-83e0-56e91e41b0ea/chat";

const MANAGED_STORAGE_KEYS = [
  SESSION_KEY, PROFILE_KEY, PROGRESS_KEY, PENDING_QUESTION_KEY,
  BEGINNER_MODE_KEY, STORAGE_STAMP_KEY, PRACTICE_KEY, LESSONS_KEY,
  MARKET_RUN_STATE_KEY, MARKET_RUN_BEST_KEY,
  PULSE_OPENED_KEY, MARKET_DECODER_KEY, "mm_market_pulse_popups",
  "mm_chats_v1", "mm_quiz_history", "mm_run_history",
  "mm_wizard_result", "mm_where_quiz_result", "mm_buy_quiz_result",
  "mm_watchlist", "mm_run_best_v2", "mm_pulse_toast_seen", "mm_market_run_v2"
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
    emergencyFund: "Not yet",
    setAside: "S$100 monthly",
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
    emergency_fund: profile.emergencyFund,
    set_aside: profile.setAside,
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
  setText("profileStatusEmergency", profile.emergencyFund);
  setText("profileStatusSetAside", profile.setAside);

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

  const learnLink = document.querySelector('.site-nav a[data-nav="learn"]');
  if (learnLink && !learnLink.closest(".learn-nav-menu")) {
    const menu = document.createElement("div");
    menu.className = "learn-nav-menu";
    learnLink.parentNode.insertBefore(menu, learnLink);
    menu.appendChild(learnLink);
    learnLink.setAttribute("aria-haspopup", "true");
    const panel = document.createElement("div");
    panel.className = "learn-nav-panel";
    panel.innerHTML = `
      <a href="learn.html"><b>Extra Info</b><span>Basics, risk, scams</span></a>
      <a href="where.html#whereQuiz"><b>Where to invest</b><span>Route quiz</span></a>
      <a href="invest.html#buyQuiz"><b>What to buy</b><span>Clear first pick</span></a>
      <a href="smart-picks.html"><b>Build a portfolio</b><span>From your profile</span></a>
      <a href="learning-room.html"><b>Quiz &amp; reference</b><span>Quiz, videos, terms, guides</span></a>`;
    menu.appendChild(panel);
  }

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

  if (currentPage !== "chat" && !document.querySelector(".bottom-nav")) {
    const bottomNav = document.createElement("nav");
    bottomNav.className = "bottom-nav";
    bottomNav.setAttribute("aria-label", "Primary");
    bottomNav.innerHTML = BOTTOM_NAV_ITEMS.map((item) => `
      <a href="${item.href}" ${item.page === currentPage ? 'aria-current="page"' : ""}>${item.icon}<span>${item.label}</span></a>
    `).join("");
    document.body.appendChild(bottomNav);
  }
}

/* ---------- learning path ---------- */
/* Optional, repeatable self-tests on lesson pages.
   No gating, no storage, retry any time - purely for the reader. */
const SELF_TESTS = {
  basics: { q: "Which matters more for a beginner's long-term result?", options: ["Picking the perfect day to buy", "Time in the market and compounding", "Checking prices every hour"], answer: 1, why: "Starting early and staying invested usually beats trying to time entries." },
  risk: { q: "An offer promises high returns with zero risk. What is it?", options: ["A great beginner deal", "Normal for bonds", "A scam red flag - that combination does not exist"], answer: 2, why: "Every real investment sits on the risk-return line. 'High return, no risk' only exists in scams." },
  where: { q: "Which route is the most hands-off for a nervous beginner?", options: ["Direct SGX stock picking", "A robo-advisor portfolio", "A Telegram signal group"], answer: 1, why: "Robo-advisors build and rebalance a diversified portfolio for you from low minimums." },
  buy: { q: "Money you need back in 6 months best fits which option?", options: ["Singapore Savings Bonds / T-bills", "A single hot stock", "MoonCoin-style crypto"], answer: 0, why: "A short horizon means staying low on the risk ladder - capital protection first." },
  portfolio: { q: "Why is an STI ETF usually safer than one bank stock?", options: ["It is government guaranteed", "It spreads money across ~30 companies", "It never falls in price"], answer: 1, why: "Diversification - one company's bad year hurts less when you own thirty." },
  scams: { q: "Before sending money to any investment firm, you should first...", options: ["Check the MAS Investor Alert List and licence", "Check how nice their website looks", "Ask the person promoting it"], answer: 0, why: "Official verification on MAS beats any promise or polished website." }
};

function renderSelfTest(id, mountEl) {
  const test = SELF_TESTS[id];
  if (!test || !mountEl) return;
  mountEl.innerHTML = `
    <details class="selftest">
      <summary>Quick self-test - try it as many times as you like</summary>
      <div class="quiz-shell" style="margin:12px 0 4px">
        <div class="quiz-question">${test.q}</div>
        <div class="quiz-options"></div>
        <div class="quiz-explain" role="status" aria-live="polite"></div>
      </div>
    </details>`;
  const optionsBox = mountEl.querySelector(".quiz-options");
  const explain = mountEl.querySelector(".quiz-explain");
  test.options.forEach((opt, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "quiz-option";
    b.textContent = opt;
    b.addEventListener("click", () => {
      optionsBox.querySelectorAll(".quiz-option").forEach((btn) => btn.classList.remove("correct", "wrong"));
      if (i === test.answer) {
        b.classList.add("correct");
        explain.textContent = "Correct. " + test.why;
      } else {
        b.classList.add("wrong");
        explain.textContent = "Not quite - try again. " + test.why;
      }
    });
    optionsBox.appendChild(b);
  });
}

function setupSelfTests() {
  const lessonId = document.body.dataset.lesson;
  if (lessonId && SELF_TESTS[lessonId]) {
    const footer = document.querySelector(".step-footer");
    const mount = document.createElement("div");
    if (footer) footer.parentNode.insertBefore(mount, footer);
    else document.querySelector("main .wrap")?.appendChild(mount);
    renderSelfTest(lessonId, mount);
  }
  document.querySelectorAll("[data-selftest]").forEach((el) => renderSelfTest(el.dataset.selftest, el));
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
  const state = readJson("mm_market_run_v2", null);
  const bests = readJson("mm_run_best_v2", {});
  const bestKeys = Object.keys(bests);

  if (state && !state.finished) {
    const pv = state.cash + (state.assets || []).reduce((s, a) => s + a.units * a.price, 0);
    const pl = state.startCash ? ((pv / state.startCash - 1) * 100) : 0;
    box.innerHTML = `
      <div class="stat-row">
        <div class="stat-tile"><b>Month ${state.month}/${state.months}</b><span>Run in progress</span></div>
        <div class="stat-tile"><b>${money(pv)}</b><span>Virtual portfolio</span></div>
        <div class="stat-tile"><b class="${pl < 0 ? "loss" : "gain"}">${pl >= 0 ? "+" : ""}${pl.toFixed(1)}%</b><span>Total P/L</span></div>
      </div>
      <div class="hero-cta" style="margin-top:16px"><a class="btn btn-primary btn-sm" href="practice.html">Resume Market Run</a></div>`;
  } else if (bestKeys.length) {
    const top = bestKeys.map((k) => bests[k]).sort((a, b) => b.ratio - a.ratio)[0];
    box.innerHTML = `
      <p class="dash-empty">Your best Market Run finished at <b>${money(top.finalValue)}</b> from ${money(top.startCash)} of virtual cash. Beat it on a harder level?</p>
      <a class="btn btn-primary btn-sm" href="practice.html">Play again</a>`;
  } else {
    box.innerHTML = `
      <p class="dash-empty">You have not tried the Practice Lab yet. Survive a simulated market year with virtual money &mdash; five difficulty levels, no real money involved.</p>
      <a class="btn btn-primary btn-sm" href="practice.html">Start practising</a>`;
  }
}

function renderDashboardMarket() {
  const box = document.getElementById("dashMarket");
  if (!box) return;
  const opened = getOpenedAlerts();
  const alert = MARKET_ALERTS.find((item) => !opened.includes(item.id)) || MARKET_ALERTS[0];
  box.innerHTML = `
    <span class="news-tag" style="font-family:var(--mono);font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--amber)">${alert.label}</span>
    <h3>${alert.title}</h3>
    <p>${alert.short}</p>
    <div class="hero-cta" style="margin-top:14px"><a class="btn btn-ghost btn-sm" href="market.html#news">Read the plain-English version</a></div>`;
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function exportLearningEvidence() {
  const profile = getProfile();
  const progress = getProgress();
  const whereQuiz = readJson("mm_where_quiz_result", null);
  const buyQuiz = readJson("mm_buy_quiz_result", null);
  const watchlist = readJson("mm_watchlist", []);
  const quizHistory = readJson("mm_quiz_history", []);
  const runHistory = readJson("mm_run_history", []);
  const rows = [["record_type", "timestamp", "detail_1", "detail_2", "detail_3"]];
  rows.push(["profile", profile.updatedAt || "", "risk=" + profile.riskComfort + " horizon=" + profile.timeHorizon, "budget=" + profile.budget, "emergency=" + profile.emergencyFund + " set_aside=" + profile.setAside]);
  rows.push(["where_quiz", whereQuiz ? whereQuiz.ts : "", whereQuiz ? "lane=" + whereQuiz.laneName : "not_taken", whereQuiz ? "route=" + whereQuiz.route : "", ""]);
  rows.push(["what_quiz", buyQuiz ? buyQuiz.ts : "", buyQuiz ? "pick=" + buyQuiz.name : "not_taken", buyQuiz ? "risk=" + buyQuiz.risk : "", ""]);
  rows.push(["quiz_best", new Date().toISOString(), progress.best + "%", "attempts=" + progress.attempts, "level=" + levelFor(progress.best).name]);
  rows.push(["watchlist", new Date().toISOString(), watchlist.join("|"), "", ""]);
  quizHistory.forEach((h) => rows.push(["quiz_attempt", h.ts, "score=" + h.score + "%", "weak=" + (h.weakTopics || []).join("|"), ""]));
  runHistory.forEach((r) => rows.push(["market_run", r.ts, "difficulty=" + r.difficulty + " months=" + r.months, "final=S$" + r.finalValue + " (" + r.stars + "star)", "badges=" + (r.badges || []).join("|")]));
  const csv = rows.map((row) => row.map((c) => '"' + String(c).replaceAll('"', '""') + '"').join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "moneymentor-learning-evidence.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 250);
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
  const emergencyFund = document.getElementById("profileEmergencyFund");
  const setAside = document.getElementById("profileSetAside");
  if (nickname) nickname.value = profile.profileMode === "guest" ? "" : profile.nickname || "";
  if (budget) budget.value = profile.budget || "S$500";
  if (goal) goal.value = profile.goal || "Safety first";
  if (emergencyFund) emergencyFund.value = profile.emergencyFund || "Not yet";
  if (setAside) setAside.value = profile.setAside || "S$100 monthly";
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
    emergencyFund: String(data.get("emergencyFund") || "Not yet"),
    setAside: String(data.get("setAside") || "S$100 monthly"),
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
  const where = readJson("mm_where_quiz_result", null);
  const buy = readJson("mm_buy_quiz_result", null);
  const bests = readJson("mm_run_best_v2", {});
  const bestEntries = Object.keys(bests).length;
  box.innerHTML = `
    <div class="summary-row"><span>Learning level</span><b>${levelFor(progress.best).name}</b></div>
    <div class="summary-row"><span>Best quiz score</span><b>${progress.best}%</b></div>
    <div class="summary-row"><span>Quiz attempts</span><b>${progress.attempts}</b></div>
    <div class="summary-row"><span>Where quiz</span><b>${where ? where.laneName : "Not taken yet"}</b></div>
    <div class="summary-row"><span>What quiz</span><b>${buy ? buy.name : "Not taken yet"}</b></div>
    <div class="summary-row"><span>Market Run personal bests</span><b>${bestEntries ? bestEntries + " difficulty level" + (bestEntries > 1 ? "s" : "") : "No runs yet"}</b></div>`;
  const nextLink = document.getElementById("profileNextStep");
  if (nextLink) {
    nextLink.href = where ? "smart-picks.html" : "where.html#whereQuiz";
    nextLink.textContent = where ? "Build your profile portfolio" : "Take the Where quiz";
  }
}

function setupProfilePage() {
  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    fillProfileForm();
    profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveProfile(profileFromForm("profile"));
      showProfileSuccess("Profile saved. Your recommendations and chat answers now use these preferences.");
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
      if (!window.confirm("Reset your quiz scores, lesson progress, and Practice Lab history? Your profile details are kept.")) return;
      [PROGRESS_KEY, LESSONS_KEY, MARKET_RUN_STATE_KEY, MARKET_RUN_BEST_KEY, PULSE_OPENED_KEY, PRACTICE_KEY, "mm_market_run_v2", "mm_run_best_v2", "mm_run_history", "mm_wizard_result", "mm_where_quiz_result", "mm_buy_quiz_result", "mm_watchlist", "mm_quiz_history", "mm_pulse_toast_seen"].forEach((key) => localStorage.removeItem(key));
      showToast("Learning progress reset.");
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
  { level: "Noob", topic: "ETFs & funds", lesson: "learn.html#basics", type: "Meaning", q: "What is an ETF?", options: ["A single company share", "A fund traded like a share that can hold many investments", "A guaranteed government savings account", "A bank loan"], answer: 1, why: "An ETF is a fund that trades like a share. It can hold many stocks, bonds, or other assets." },
  { level: "Noob", topic: "Safe first steps", lesson: "invest.html", type: "Scenario", q: "A beginner has S$500 and is afraid of losing money. Which first route is usually the most safety-focused?", options: ["One trending stock", "Singapore Savings Bonds", "Borrowing money to invest", "A Telegram group promising returns"], answer: 1, why: "For safety-first beginners, SSBs are a sensible starting route because they are backed by the Singapore Government and start from S$500." },
  { level: "Starter", topic: "Diversification", lesson: "smart-picks.html", type: "Meaning", q: "What does diversification mean?", options: ["Buying only one stock", "Spreading money across different investments", "Checking prices every hour", "Selling whenever markets fall"], answer: 1, why: "Diversification spreads risk so one bad performer does not damage the whole portfolio." },
  { level: "Starter", topic: "Investing habits", lesson: "where.html", type: "Scenario", q: "You can add S$100 every month. Which route best matches a steady beginner habit?", options: ["Regular savings plan or monthly ETF investing", "One random stock every month", "Only investing when social media is excited", "Switching platforms weekly"], answer: 0, why: "A regular savings plan or monthly ETF route supports dollar-cost averaging and builds the habit gradually." },
  { level: "Builder", topic: "REITs", lesson: "invest.html", type: "Meaning", q: "What is a REIT?", options: ["A crypto token", "A listed vehicle that owns income-producing property", "A bank savings account", "A tax form"], answer: 1, why: "A REIT owns income-producing property such as malls, offices, or logistics assets, and often pays distributions." },
  { level: "Builder", topic: "REITs", lesson: "invest.html", type: "Scenario", q: "A REIT gives a high yield. What should a beginner check before getting excited?", options: ["Only the yield number", "Occupancy, gearing, interest-rate sensitivity, and distribution history", "Whether influencers like it", "Whether the logo looks professional"], answer: 1, why: "High yield can hide risk. Check occupancy, gearing, debt costs, and whether distributions are sustainable." },
  { level: "Confident", topic: "Investing habits", lesson: "learn.html#basics", type: "Meaning", q: "What is dollar-cost averaging?", options: ["Investing a fixed amount regularly", "Buying only at the yearly low", "Selling after every gain", "Choosing the cheapest stock"], answer: 0, why: "Dollar-cost averaging means investing a fixed amount regularly instead of trying to time the market." },
  { level: "Confident", topic: "Investor behaviour", lesson: "learn.html#risk", type: "Scenario", q: "The market drops sharply after bad news. What is the most beginner-safe response?", options: ["Panic sell immediately", "Borrow money to buy more instantly", "Review time horizon, diversification, and original reason", "Ignore all risk"], answer: 2, why: "A market drop should trigger calm review, not panic." },
  { level: "Advanced", topic: "Liquidity & risk", lesson: "learn.html#risk", type: "Meaning", q: "What does liquidity mean?", options: ["How quickly an investment can be turned into cash", "How famous a company is", "How high the dividend is", "How often news mentions it"], answer: 0, why: "Liquidity is how easily and quickly you can turn an investment into cash." },
  { level: "Advanced", topic: "Scam awareness", lesson: "sources-safety.html", type: "Scenario", q: "A Telegram group promises 20% monthly returns with no risk. What should MoneyMentor advise?", options: ["Invest quickly", "Treat it as a scam red flag and verify with official sources such as MAS alerts", "Ask friends to join", "Invest a small amount"], answer: 1, why: "Guaranteed high returns with no risk are a major scam warning." }
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

  // Topic diagnosis: what went wrong, and which lesson fixes it.
  const topicMap = {};
  quizAnswers.forEach((answer, i) => {
    const item = QUIZ[i];
    const topic = item.topic || item.level;
    if (!topicMap[topic]) topicMap[topic] = { right: 0, wrong: 0, lesson: item.lesson || "learn.html" };
    topicMap[topic][answer.correct ? "right" : "wrong"]++;
  });
  const weakTopics = Object.entries(topicMap).filter(([, v]) => v.wrong > 0);
  let diagBox = document.getElementById("quizDiagnosis");
  if (!diagBox) {
    diagBox = document.createElement("div");
    diagBox.id = "quizDiagnosis";
    document.getElementById("resultSummary").after(diagBox);
  }
  if (weakTopics.length) {
    diagBox.innerHTML = `
      <div class="callout callout-warn" style="margin:16px 0;text-align:left">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>
        <span><b>Your weak topics:</b> ${weakTopics.map(([t, v]) => `${t} <a href="${v.lesson}">(revise this lesson)</a>`).join(" &middot; ")}.
        Revise them, then retake the quiz to raise your level.</span>
      </div>
      <div class="hero-cta" style="justify-content:center;margin-bottom:8px">
        <button class="btn btn-ghost btn-sm" id="quizEvidenceBtn" type="button">Download quiz evidence (CSV)</button>
        <a class="btn btn-ghost btn-sm" href="chat.html?q=${encodeURIComponent("I got " + score + "% on the MoneyMentor quiz. My weak topics were: " + weakTopics.map(([t]) => t).join(", ") + ". Teach me these topics with simple Singapore examples, then quiz me again.")}">Ask AI to teach my weak topics</a>
      </div>`;
  } else {
    diagBox.innerHTML = `
      <div class="callout callout-info" style="margin:16px 0;text-align:left">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
        <span><b>No weak topics this round.</b> Every topic answered correctly - try the Practice Lab next.</span>
      </div>
      <div class="hero-cta" style="justify-content:center;margin-bottom:8px">
        <button class="btn btn-ghost btn-sm" id="quizEvidenceBtn" type="button">Download quiz evidence (CSV)</button>
      </div>`;
  }
  document.getElementById("quizEvidenceBtn")?.addEventListener("click", () => exportQuizEvidence(score));

  // attempt history (evidence)
  try {
    const history = readJson("mm_quiz_history", []);
    history.push({ ts: new Date().toISOString(), score, weakTopics: weakTopics.map(([t]) => t) });
    localStorage.setItem("mm_quiz_history", JSON.stringify(history.slice(-20)));
  } catch {}

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

function exportQuizEvidence(score) {
  const rows = [["question_no", "topic", "question", "your_answer", "correct_answer", "result", "explanation"]];
  quizAnswers.forEach((answer, i) => {
    const item = QUIZ[i];
    rows.push([i + 1, item.topic || item.level, item.q, item.options[answer.selected] || "No answer", item.options[item.answer], answer.correct ? "Correct" : "Wrong", item.why]);
  });
  rows.push(["", "", "FINAL SCORE", score + "%", "", "", new Date().toLocaleString("en-SG")]);
  const csv = rows.map((row) => row.map((c) => '"' + String(c).replaceAll('"', '""') + '"').join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "moneymentor-quiz-evidence.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 250);
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

/* ---------- market news ---------- */
const MARKET_ALERTS = [
  {
    id: "reits-borrowing-costs",
    label: "Sector alert",
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
    id: "sti-bank-move",
    label: "Market move",
    title: "Bank stocks move after rate news",
    short: "DBS, OCBC, and UOB can move when interest-rate expectations change.",
    happened: "Interest-rate expectations affect bank lending margins, deposits, loan demand, and investor appetite for bank dividends.",
    beginner: "Do not treat a bank-price jump as a simple buy signal. Check earnings, dividends, rates, and valuation first.",
    why: "The three local banks make up a large slice of the STI, so rate news can move an STI ETF too.",
    riskContext: "Bank shares are single-company risk. An ETF spreads risk but still moves when a large sector moves.",
    affected: ["DBS", "OCBC", "UOB", "STI ETF"],
    sourceName: "The Business Times markets",
    sourceUrl: "https://www.businesstimes.com.sg/markets"
  },
  {
    id: "global-volatility",
    label: "Global shock",
    title: "Global market sell-off may spill into Asia",
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
    id: "sgx-market-update",
    label: "Official source",
    title: "SGX market updates are free to read",
    short: "Use SGX research and market updates to understand what is moving locally.",
    happened: "SGX publishes market information, education, and research resources that explain what is moving in the local market.",
    beginner: "Before acting on social-media excitement, compare the claim against official market context and trusted reporting.",
    why: "Free, official context beats paid 'signal groups' every time - and it cannot be faked by someone trying to sell you something.",
    riskContext: "Information risk is real: acting on rumours is one of the fastest ways beginners lose money.",
    affected: ["SGX stocks", "ETFs", "REITs"],
    sourceName: "SGX market updates",
    sourceUrl: "https://www.sgx.com/research-education/market-updates"
  },
  {
    id: "scam-warning",
    label: "Safety alert",
    title: "Guaranteed-return claims are a red flag",
    short: "Any group promising high returns with no risk should be treated as suspicious.",
    happened: "Scam messages often use urgency, fake testimonials, and guaranteed profits to pressure beginners into transferring money.",
    beginner: "Pause. Verify the firm or person through official sources before giving money, personal details, or account access.",
    why: "Young, new investors are the main target of investment scams in Singapore. Thirty seconds on the MAS Investor Alert List can save your whole starting amount.",
    riskContext: "If returns are guaranteed and high, the risk is the whole amount. Real investments never promise both.",
    affected: ["New investors", "Telegram groups", "High-yield schemes"],
    sourceName: "MAS Investor Alert List",
    sourceUrl: "https://www.mas.gov.sg/investor-alert-list"
  },
  {
    id: "rate-cuts-bonds",
    label: "Teaching example",
    title: "Interest rates fall - bonds and REITs breathe",
    short: "Rate cuts usually lift bond prices and ease pressure on REITs.",
    happened: "When central banks cut rates, existing bonds with higher coupons become more attractive, and REITs pay less on their borrowings.",
    beginner: "Understand the seesaw: rates up usually means bond prices down (and vice versa). You don't need to predict rates - just know why your bond ETF or REIT moved.",
    why: "This is the single most common 'why did my safe thing move?' question beginners ask.",
    riskContext: "Even 'safe' bond funds move in price before maturity. SSBs are the exception - you can always exit at par.",
    source: { name: "MoneySense - bond basics", href: "https://www.moneysense.gov.sg/understanding-bonds/" }
  },
  {
    id: "dividend-season",
    label: "Teaching example",
    title: "Dividend season - money lands in accounts",
    short: "SG banks, REITs, and Singtel-type stocks pay out cash to shareholders.",
    happened: "Many Singapore blue chips pay dividends once or twice a year. On the ex-dividend date the share price typically drops by roughly the dividend amount.",
    beginner: "Dividends are not free money appearing from nowhere - the price adjusts. The real lesson: total return = price change + dividends, so don't judge an investment by price alone.",
    why: "Singapore is a dividend-heavy market; understanding ex-dates stops rookie confusion.",
    riskContext: "A very high dividend yield can be a warning sign (price fell for a reason), not a gift.",
    source: { name: "SGX - dividend information", href: "https://www.sgx.com/securities/company-announcements" }
  },
  {
    id: "stronger-sgd",
    label: "Teaching example",
    title: "The Singapore dollar strengthens",
    short: "A stronger SGD quietly changes what your overseas investments are worth.",
    happened: "MAS manages the SGD against a basket of currencies. When SGD strengthens, overseas assets (like a US ETF) are worth fewer SGD even if their USD price didn't move.",
    beginner: "If you buy global funds, currency is a hidden second bet. It can help or hurt - over long periods it tends to matter less than staying invested.",
    why: "Beginners often panic when a global fund falls in SGD terms while US markets were flat.",
    riskContext: "Currency swings add volatility to overseas holdings; SG-listed, SGD-denominated options avoid it.",
    source: { name: "MAS - monetary policy explained", href: "https://www.mas.gov.sg/monetary-policy" }
  },
  {
    id: "ipo-hype",
    label: "Teaching example",
    title: "A hot IPO everyone is talking about",
    short: "New listings get hype; most beginners should watch, not chase.",
    happened: "A company lists on an exchange and early trading is volatile. FOMO peaks exactly when information is thinnest.",
    beginner: "You lose nothing by waiting. Let a new stock report a few quarters of real results before deciding. Hype is not analysis.",
    why: "IPO chasing is one of the most common expensive first mistakes.",
    riskContext: "Many IPOs trade below their listing price within a year - patience is protection.",
    source: { name: "MoneySense - before you invest", href: "https://www.moneysense.gov.sg/starting-to-invest/" }
  },
  {
    id: "tbill-yield",
    label: "Teaching example",
    title: "T-bill yields catch headlines",
    short: "When 6-month T-bill yields look attractive, queues form.",
    happened: "Singapore T-bills are auctioned regularly. When yields rise, they become a genuine competitor to fixed deposits and even to riskier assets for short-horizon money.",
    beginner: "For money you need within a year, compare: bank deposit vs T-bill vs SSB. That comparison - not stock picking - is the real first investing decision for most people.",
    why: "It teaches the risk-free benchmark: every risky investment must beat this to be worth the stress.",
    riskContext: "T-bills held to maturity are as safe as it gets in SGD; selling early can vary.",
    source: { name: "MAS - Singapore Government Securities", href: "https://www.mas.gov.sg/bonds-and-bills" }
  },
  {
    id: "crypto-swings",
    label: "Teaching example",
    title: "Crypto swings 20% in a week - again",
    short: "Huge moves both ways; not a beginner foundation.",
    happened: "Crypto assets regularly move in a week what stock markets move in a year, driven by sentiment, leverage, and thin regulation.",
    beginner: "MAS repeatedly warns that cryptocurrency is highly risky and not suitable for retail investors' core savings. If you must explore, treat it like money you can fully lose - after your foundation exists.",
    why: "Beginners see the up-moves on social media and rarely the liquidations.",
    riskContext: "No principal protection, extreme volatility, and scams cluster around it.",
    source: { name: "MAS - consumer advisories on crypto", href: "https://www.mas.gov.sg/investor-alert-list" }
  },
  {
    id: "panic-headlines",
    label: "Teaching example",
    title: "'Billions wiped off markets' headlines",
    short: "Scary wording, normal event - markets fall regularly.",
    happened: "A 2-3% index drop gets dramatic headlines. Historically, 10% dips happen most years and markets have recovered from every one so far - over time, not overnight.",
    beginner: "Your plan should already assume drops will happen. If a headline makes you want to sell everything, the problem is usually the portfolio's risk level, not the news.",
    why: "This is the emotional test every investor faces - Market Run lets you practise it safely.",
    riskContext: "Past recoveries are not a guarantee; that is exactly why diversification and horizon matter.",
    source: { name: "MoneySense - managing investment risk", href: "https://www.moneysense.gov.sg/managing-investment-risks/" }
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
  }
}

function renderNewsDetail(id) {
  const detail = document.getElementById("newsDetail");
  if (!detail) return;
  const alert = MARKET_ALERTS.find((item) => item.id === id) || MARKET_ALERTS[0];
  const affected = alert.affected || ["Beginner investors"];
  const sourceHref = alert.sourceUrl || alert.source?.href || "market.html";
  const sourceName = alert.sourceName || alert.source?.name || "Educational source";
  detail.innerHTML = `
    <h3>${alert.title}</h3>
    <div class="pill-row">${affected.map((item) => `<span class="pill">${item}</span>`).join("")}</div>
    <div class="news-takeaway">
      <p><b>Plain English:</b> ${alert.beginner}</p>
      <p><b>Why it matters:</b> ${alert.why}</p>
    </div>
    <details class="market-explainer" open>
      <summary>What happened</summary>
      <p>${alert.happened}</p>
    </details>
    <details class="market-explainer">
      <summary>Risk context</summary>
      <p>${alert.riskContext}</p>
    </details>
    <div class="news-foot">
      <span class="source-label">Source: <a href="${sourceHref}" target="_blank" rel="noopener">${sourceName}</a></span>
      <span class="source-label">Educational example &middot; reviewed Jul 2026</span>
      <button class="btn btn-ghost btn-sm prompt-ai" type="button" data-question="Explain this Market School event for a beginner in Singapore: ${alert.title}. ${alert.short} What should I understand, what risks matter, and what mistake should I avoid?">Ask Bot</button>
    </div>`;
  detail.querySelector(".prompt-ai")?.addEventListener("click", (e) => openChatWithQuestion(e.currentTarget.dataset.question, { mode: "widget" }));
}

function renderNewsList(activeId) {
  const list = document.getElementById("newsList");
  if (!list) return;
  const opened = getOpenedAlerts();
  list.innerHTML = MARKET_ALERTS.map((alert) => `
    <button class="news-item ${opened.includes(alert.id) ? "opened" : ""} ${alert.id === activeId ? "active" : ""}" type="button" data-alert-id="${alert.id}" ${alert.id === activeId ? 'aria-current="true"' : ""}>
      <span class="news-status">${opened.includes(alert.id) ? "Read" : "New"}</span>
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

/* ---------- live market news + decoder ---------- */
const MARKET_DECODER_PATTERNS = [
  {
    id: "rate-news",
    label: "Rate news",
    title: "Bank stocks move after rate news",
    short: "DBS, OCBC, and UOB can move when interest-rate expectations change.",
    chips: ["Banks", "STI ETF"],
    happened: "Interest-rate expectations affect bank lending margins, deposit costs, loan demand, and investor appetite for dividends.",
    plain: "A rate headline does not automatically mean bank shares should jump or fall. It changes what investors expect banks to earn next.",
    why: "The three local banks are a large slice of the STI, so rate news can move an STI ETF even if you never buy a bank stock directly.",
    risk: "Single bank shares carry company risk. A broad ETF spreads risk, but it still moves when a large sector moves.",
    sourceName: "The Business Times markets",
    sourceUrl: "https://www.businesstimes.com.sg/markets"
  },
  {
    id: "reits-borrowing-costs",
    label: "Sector pattern",
    title: "REITs react to borrowing costs",
    short: "REIT prices can move when investors expect higher or lower interest rates.",
    chips: ["REITs", "Income"],
    happened: "Many REITs use debt to own and manage property. Higher borrowing costs can pressure distributions and make high-yield assets less attractive.",
    plain: "A REIT price fall is not always a broken business. Sometimes investors are repricing the cost of debt and the income they require.",
    why: "REITs are popular with young Singapore investors for payouts. Understanding the rate link stops you treating yield as free money.",
    risk: "A high yield can signal higher risk. Check gearing, occupancy, debt maturity, and whether distributions look sustainable.",
    sourceName: "Reuters markets",
    sourceUrl: "https://www.reuters.com/markets/"
  },
  {
    id: "global-shock",
    label: "Global shock",
    title: "Global sell-offs spill into Asia",
    short: "US and China headlines can affect Singapore shares even when the company itself did nothing wrong.",
    chips: ["STI ETF", "Global ETFs"],
    happened: "Singapore is an open market. Global risk-off moves can affect banks, tech-linked names, REITs, and broad ETFs through sentiment and fund flows.",
    plain: "When markets fall together, focus on your time horizon and diversification. Broad weakness is different from a company-specific problem.",
    why: "Your first market drop can feel personal. Knowing the difference between a global wobble and a real problem helps prevent panic-selling.",
    risk: "Short-term drops are normal. The real mistake is selling low only because a scary headline appeared.",
    sourceName: "CNA Business",
    sourceUrl: "https://www.channelnewsasia.com/business"
  },
  {
    id: "earnings",
    label: "Earnings",
    title: "Earnings reports move single stocks hard",
    short: "A company's quarterly results can move its share price sharply in one day - up or down.",
    chips: ["Single stocks", "Blue chips"],
    happened: "Every quarter, listed companies report profits. If results beat what investors expected, the price can jump; if they miss, it can fall fast.",
    plain: "A stock falling after earnings does not automatically mean the company is dying, and a jump does not mean a sure win. The move is about expectations.",
    why: "If you own a single stock like DBS or Singtel, earnings dates are when your money moves most. ETF holders feel it less because many other companies cushion the move.",
    risk: "Single stocks carry event risk that diversified funds smooth out.",
    sourceName: "SGX company announcements",
    sourceUrl: "https://www.sgx.com/securities/company-announcements"
  },
  {
    id: "scam-safety",
    label: "Safety",
    title: "Guaranteed return claims are a red flag",
    short: "Any group promising high returns with no risk should be treated as suspicious.",
    chips: ["Scams", "Safety"],
    happened: "Scam messages often use urgency, fake testimonials, and guaranteed profits to pressure beginners into transferring money.",
    plain: "Real investments have risk. If someone promises both high returns and no risk, pause and verify before giving money or personal details.",
    why: "New investors are attractive targets. A quick check against official sources can protect your whole starting amount.",
    risk: "If returns are guaranteed and high, the risk may be the whole amount. Real investments never promise both.",
    sourceName: "MAS Investor Alert List",
    sourceUrl: "https://www.mas.gov.sg/investor-alert-list"
  }
];

function getDecodedMarketPatterns() {
  const decoded = readJson(MARKET_DECODER_KEY, []);
  return Array.isArray(decoded) ? decoded : [];
}

function saveDecodedMarketPatterns(ids) {
  try { localStorage.setItem(MARKET_DECODER_KEY, JSON.stringify([...new Set(ids)])); } catch {}
}

function setupLiveMarketNews() {
  const askButton = document.getElementById("liveNewsAskBot");
  if (!askButton) return;
  askButton.addEventListener("click", () => {
    openChatWithQuestion(askButton.dataset.question || "", { mode: "widget" });
  });
}

function setupMarketDecoder() {
  const list = document.getElementById("marketDecoderList");
  const detail = document.getElementById("marketDecoderDetail");
  if (!list || !detail) return;

  let activeId = MARKET_DECODER_PATTERNS[0].id;
  let awardedId = "";

  function render() {
    const decoded = getDecodedMarketPatterns();
    const active = MARKET_DECODER_PATTERNS.find((item) => item.id === activeId) || MARKET_DECODER_PATTERNS[0];
    const total = document.getElementById("decoderXpTotal");
    if (total) total.textContent = `${decoded.length * 15} XP decoded`;

    list.innerHTML = MARKET_DECODER_PATTERNS.map((item) => {
      const isActive = item.id === active.id;
      const isDecoded = decoded.includes(item.id);
      const status = awardedId === item.id ? "+15 XP" : (isDecoded ? "Decoded" : "Decode");
      return `
        <button class="decoder-card ${isActive ? "active" : ""} ${isDecoded ? "decoded" : ""}" type="button" data-decoder-id="${item.id}" ${isActive ? 'aria-current="true"' : ""}>
          <span class="decoder-card-status">${status}</span>
          <span class="decoder-card-label">${item.label}</span>
          <strong>${item.title}</strong>
          <small>${item.short}</small>
        </button>`;
    }).join("");

    const decodedState = decoded.includes(active.id);
    const statusLabel = awardedId === active.id ? "+15 XP" : (decodedState ? "Decoded" : "Decode this pattern");
    detail.innerHTML = `
      <div class="decoder-detail-top">
        <h3>${active.title}</h3>
        <span class="decoder-earned ${awardedId === active.id ? "fresh" : ""}">${statusLabel}</span>
      </div>
      <div class="pill-row">${active.chips.map((chip) => `<span class="pill">${chip}</span>`).join("")}</div>
      <div class="news-block">
        <h4>What happens</h4>
        <p>${active.happened}</p>
      </div>
      <div class="news-block">
        <h4>In plain English</h4>
        <p>${active.plain}</p>
      </div>
      <div class="news-block">
        <h4>Why this matters to you</h4>
        <p>${active.why}</p>
      </div>
      <div class="news-block">
        <h4>Risk context</h4>
        <p>${active.risk}</p>
      </div>
      <div class="news-foot">
        <span class="source-label">Where to watch this: <a href="${active.sourceUrl}" target="_blank" rel="noopener">${active.sourceName}</a></span>
        <button class="btn btn-ghost btn-sm decoder-ask" type="button" data-question="Explain this market news pattern for a beginner in Singapore: ${active.title}. What happened, why prices may move, what risk matters, and what mistake should I avoid?">Ask Bot</button>
      </div>`;

    list.querySelectorAll(".decoder-card").forEach((button) => {
      button.addEventListener("click", () => {
        activeId = button.dataset.decoderId;
        const currentDecoded = getDecodedMarketPatterns();
        if (!currentDecoded.includes(activeId)) {
          saveDecodedMarketPatterns([...currentDecoded, activeId]);
          awardedId = activeId;
          const item = MARKET_DECODER_PATTERNS.find((pattern) => pattern.id === activeId);
          showToast(`+15 XP earned: ${item?.label || "pattern"} decoded.`);
        } else {
          awardedId = "";
        }
        render();
      });
    });

    detail.querySelector(".decoder-ask")?.addEventListener("click", (event) => {
      openChatWithQuestion(event.currentTarget.dataset.question || "", { mode: "widget" });
    });
  }

  render();
}

/* ---------- chat (n8n) ---------- */
const MONEYMENTOR_AI_SYSTEM_PROMPT = `You are MoneyMentor, a beginner-friendly investing education chatbot for young adults in Singapore.

Mission:
Teach investing in plain English, help users think clearly, reduce fear and jargon, and guide them toward responsible next steps using trusted Singapore sources.

You are not a licensed financial adviser. Do not provide personalised financial advice, exact buy/sell/hold instructions, guaranteed returns, or claims that one investment/platform is best for the user.

Answer style:
- Warm, clear, patient, practical, and direct.
- Answer the user's actual question first.
- Use Singapore context where relevant.
- Prefer short sections and bullets.
- Give examples, but label them as examples, not recommendations.
- Always explain risks and common mistakes.
- End with a safe next step.
- Avoid emojis and decorative punctuation so every browser renders the answer cleanly.

Source grounding:
Use MoneySense, MAS, CPF Board, SGX, and trusted market news sources first. If live/current market tools are unavailable, say that clearly and do not pretend to know today's market.

Core safety rules:
1. Never tell the user exactly which stock to buy.
2. Never tell the user exactly which platform is best for them.
3. Never promise returns.
4. Never encourage investing money they may need soon.
5. If the user has a small amount, explain fees, diversification, emergency fund, and learning-first options.
6. If the user asks about personal investment choices, ask clarifying questions: goal, time horizon, risk comfort, emergency savings, whether they need the money soon.
7. If the user mentions guaranteed returns, Telegram groups, crypto schemes, pressure to act fast, or unusually high profits, switch to scam-safety mode.
8. Remind users to check whether firms are regulated by MAS and to use the MAS Investor Alert List concept.
9. For Singapore Savings Bonds, note that the minimum investment is S$500 if relevant.
10. For CPF investing, explain only at a high level unless source context provides details; encourage checking CPF Board.

Scenario mode:
When the user gives a scenario such as "I saved S$200, what should I invest in?", use headings:
- Quick answer
- First, check these
- Beginner routes to compare
- Platform checklist
- My safest next step for you
- Source basis

Response contract:
Return one final clean answer only. Do not return raw streaming events, JSON lines, node metadata, begin/item/end records, or internal tool logs.`;

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
  return {
    sessionId: profile.sessionId,
    currentPage: location.pathname.split("/").pop() || "index.html",
    profile,
    beginnerMode: isBeginnerMode(),
    quizProgress: getProgress(),
    watchlist: readJson("mm_watchlist", []),
    whereQuiz: readJson("mm_where_quiz_result", null),
    buyQuiz: readJson("mm_buy_quiz_result", null),
    openedMarketAlerts: getOpenedAlerts(),
    systemPrompt: MONEYMENTOR_AI_SYSTEM_PROMPT,
    expectedResponseFormat: {
      accepted: ["plain text answer", "{ \"output\": \"final answer\" }", "{ \"text\": \"final answer\" }"],
      rejected: ["raw streaming JSON events", "begin/item/end metadata", "tool logs", "multiple answer objects"]
    },
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

function isUsableChatInput(input) {
  if (!input || input.disabled || input.readOnly || input.closest?.(".lib-search")) return false;
  const label = `${input.id || ""} ${input.name || ""} ${input.className || ""} ${input.placeholder || ""} ${input.getAttribute?.("aria-label") || ""}`.toLowerCase();
  if (label.includes("search")) return false;
  const rect = input.getBoundingClientRect?.();
  return (!rect || (rect.width > 0 && rect.height > 0)) &&
    (input.isContentEditable || input.tagName === "TEXTAREA" || label.includes("chat") || label.includes("message") || label.includes("ask"));
}

function deepQueryInputs(root = document, found = []) {
  if (!root) return found;
  root.querySelectorAll?.("textarea, input:not([type='search']), [contenteditable='true']").forEach((node) => found.push(node));
  root.querySelectorAll?.("*").forEach((node) => {
    if (node.shadowRoot) deepQueryInputs(node.shadowRoot, found);
  });
  return found;
}

function findChatInput() {
  const scopedSelectors = [
    '[data-test-id="chat-input"]',
    ".chat-input textarea",
    ".chat-inputs textarea",
    ".chat-window textarea",
    ".chat-window input:not([type='search'])",
    "[class*='chat-window'] textarea",
    "[class*='chat-window'] input:not([type='search'])",
    ".n8n-chat textarea",
    ".n8n-chat input:not([type='search'])"
  ];
  const scopedInput = scopedSelectors
    .map((selector) => document.querySelector(selector))
    .find((input) => isUsableChatInput(input));
  if (scopedInput) return scopedInput;

  return deepQueryInputs().find((input) => isUsableChatInput(input));
}

function setInputValue(input, value) {
  input.focus();
  if (input.isContentEditable) {
    input.textContent = value;
  } else {
    const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
  }
  input.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: value }));
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Unidentified" }));
}

function stabilizeChatInput(input, question) {
  setInputValue(input, question);
  setTimeout(() => setInputValue(input, question), 80);
  setTimeout(() => setInputValue(input, question), 240);
}

function hideChatFallback() {
  document.querySelectorAll(".chat-fallback").forEach((fallback) => fallback.classList.remove("show"));
}

function showChatFallback(message = "Chat is open. If the question was not pasted, use the copy button and paste it into the chat box.") {
  let fallback = document.getElementById("chatFallback");
  if (!fallback) {
    fallback = document.createElement("div");
    fallback.id = "chatFallback";
    fallback.className = "chat-fallback";
    fallback.innerHTML = `
      <strong>Chat is open</strong>
      <p></p>
      <button class="btn btn-primary btn-sm" type="button">Copy question</button>`;
    document.body.appendChild(fallback);
  }
  const pendingQuestion = localStorage.getItem(PENDING_QUESTION_KEY) || "";
  fallback.querySelector("p").textContent = message;
  fallback.querySelector("button").onclick = () => navigator.clipboard?.writeText(pendingQuestion).catch(() => {});
  fallback.classList.add("show");
}

function tryParseChatJson(value) {
  try { return JSON.parse(value); } catch { return null; }
}

function extractChatText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractChatText).filter(Boolean).join("");
  if (typeof value !== "object") return "";
  const directKeys = ["output", "text", "answer", "message", "content", "response", "result"];
  for (const key of directKeys) {
    if (typeof value[key] === "string") return value[key];
    if (value[key] && typeof value[key] === "object") {
      const nested = extractChatText(value[key]);
      if (nested) return nested;
    }
  }
  if (value.type === "item" && typeof value.content === "string") return value.content;
  return "";
}

function extractStreamedChatText(rawText) {
  let text = String(rawText || "").trim();
  if (!text) return "";
  const parsedWhole = tryParseChatJson(text);
  if (typeof parsedWhole === "string") text = parsedWhole.trim();
  else if (parsedWhole) {
    const wholeText = extractChatText(parsedWhole);
    if (wholeText && wholeText !== text) return extractStreamedChatText(wholeText);
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const chunks = [];
  for (const line of lines) {
    const cleanLine = line.replace(/^data:\s*/, "");
    if (cleanLine === "[DONE]") continue;
    const event = tryParseChatJson(cleanLine);
    if (!event) continue;
    if (event.type === "item" && typeof event.content === "string") chunks.push(event.content);
    else {
      const content = extractChatText(event);
      if (content && event.type !== "begin" && event.type !== "end") chunks.push(content);
    }
  }
  return chunks.length ? chunks.join("") : text;
}

function normalizeChatResponse(rawText) {
  let text = extractStreamedChatText(rawText);
  for (let i = 0; i < 3; i++) {
    const parsed = tryParseChatJson(text);
    if (typeof parsed === "string") text = parsed;
    else if (parsed) {
      const extracted = extractChatText(parsed);
      if (extracted && extracted !== text) text = extractStreamedChatText(extracted);
      else break;
    } else break;
  }
  return String(text || "")
    .replace(/ðŸ‘‹|ðŸ˜Š|ðŸŒ±/g, "")
    .replace(/â€”|â€“/g, "-")
    .replace(/â€¦/g, "...")
    .replace(/â€˜|â€™/g, "'")
    .replace(/â€œ|â€�/g, '"')
    .replace(/Â·/g, "-")
    .replace(/\uFFFD/g, "")
    .replace(/^\s*["']|["']\s*$/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function prefillChatInput(question, attempts = 0) {
  const input = findChatInput();
  if (input && question) {
    hideChatFallback();
    stabilizeChatInput(input, question);
    input.focus();
    try { localStorage.removeItem(PENDING_QUESTION_KEY); } catch {}
    return true;
  }
  if (attempts < 40) {
    setTimeout(() => prefillChatInput(question, attempts + 1), 250);
    return false;
  }
  if (question) showChatFallback();
  return false;
}

function openChatWithQuestion(question = "", options = {}) {
  const preset = String(question || "").trim();
  const forceWidget = options.mode === "widget" || document.body.dataset.page === "market";
  if (preset && !forceWidget) {
    try { localStorage.setItem(PENDING_QUESTION_KEY, preset); } catch {}
    location.href = `chat.html?q=${encodeURIComponent(preset)}`;
    return;
  }
  if (preset) {
    try { localStorage.setItem(PENDING_QUESTION_KEY, preset); } catch {}
    navigator.clipboard?.writeText(preset).catch(() => {});
  } else {
    try { localStorage.removeItem(PENDING_QUESTION_KEY); } catch {}
  }
  const inputAlreadyOpen = findChatInput();
  const toggle = document.querySelector(".mm-chat-toggle, .chat-window-toggle, [class*='chat-window-toggle']");
  if (!inputAlreadyOpen && toggle) toggle.click();
  setTimeout(() => prefillChatInput(preset), 150);
  setTimeout(() => prefillChatInput(preset), 650);
  setTimeout(() => prefillChatInput(preset), 1400);
}

function setupChatTriggers() {
  if (document.body.dataset.page === "market") {
    document.querySelectorAll(".open-chat").forEach((button) => {
      if (button.tagName === "BUTTON") button.textContent = "Ask Bot";
    });
  }
  document.querySelectorAll(".prompt-ai").forEach((button) => {
    if (document.body.dataset.page === "market") button.textContent = "Ask Bot";
    button.addEventListener("click", () => openChatWithQuestion(button.dataset.question || "", document.body.dataset.page === "market" ? { mode: "widget" } : {}));
  });
  document.querySelectorAll(".open-chat").forEach((button) => {
    button.addEventListener("click", () => openChatWithQuestion("", { mode: "widget" }));
  });
}

function loadChatWidget() {
  if (document.body.dataset.page === "chat") return; // full AI workspace page has its own UI
  if (document.getElementById("mmChatWidget")) return;

  const widget = document.createElement("div");
  widget.id = "mmChatWidget";
  widget.className = "mm-chat-widget";
  widget.innerHTML = `
    <button class="mm-chat-toggle" type="button" aria-label="Open MoneyMentor chat" aria-expanded="false">AI</button>
    <section class="mm-chat-panel" aria-label="MoneyMentor chatbot" hidden>
      <div class="mm-chat-head">
        <div><strong>MoneyMentor</strong><span>Investing, minus the jargon.</span></div>
        <button class="mm-chat-close" type="button" aria-label="Close chat">&times;</button>
      </div>
      <div class="mm-chat-messages" aria-live="polite">
        <div class="mm-chat-msg bot">Hi! I'm MoneyMentor. Ask me to explain investing terms, compare beginner options, or check risk before you touch real money.</div>
      </div>
      <form class="mm-chat-form">
        <textarea data-test-id="chat-input" rows="1" placeholder="Ask about ETFs, CPF, scams..." aria-label="Message MoneyMentor"></textarea>
        <button type="submit" aria-label="Send message">Send</button>
      </form>
    </section>`;
  document.body.appendChild(widget);

  const toggle = widget.querySelector(".mm-chat-toggle");
  const panel = widget.querySelector(".mm-chat-panel");
  const close = widget.querySelector(".mm-chat-close");
  const form = widget.querySelector(".mm-chat-form");
  const input = widget.querySelector("textarea");
  const messages = widget.querySelector(".mm-chat-messages");
  const sendButton = form.querySelector("button");
  const widgetSessionId = `${getProfile().sessionId || getSessionId()}-widget`;

  function setOpen(open) {
    panel.hidden = !open;
    panel.style.display = open ? "flex" : "none";
    toggle.setAttribute("aria-expanded", String(open));
    widget.classList.toggle("open", open);
    if (open) setTimeout(() => input.focus(), 30);
    else input.blur();
  }

  function appendChatMessage(role, text, isError = false) {
    const msg = document.createElement("div");
    msg.className = `mm-chat-msg ${role}${isError ? " error" : ""}`;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  async function sendWidgetMessage(rawMessage) {
    const message = String(rawMessage || "").trim();
    if (!message || sendButton.disabled) return;
    appendChatMessage("user", message);
    input.value = "";
    input.style.height = "auto";
    sendButton.disabled = true;
    const thinking = appendChatMessage("bot", "Thinking...");
    try {
      const metadata = getChatMetadata();
      const res = await fetch(CHAT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sendMessage",
          sessionId: widgetSessionId,
          chatInput: message,
          systemPrompt: metadata.systemPrompt,
          expectedResponseFormat: metadata.expectedResponseFormat,
          metadata
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      const reply = normalizeChatResponse(raw);
      if (!reply) throw new Error("Empty response");
      thinking.textContent = reply;
    } catch (error) {
      thinking.classList.add("error");
      thinking.textContent = "I could not reach the MoneyMentor AI service just now. Check that the n8n workflow is active, then try again.";
    } finally {
      sendButton.disabled = false;
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }
  }

  setOpen(false);
  toggle.addEventListener("click", () => setOpen(!widget.classList.contains("open")));
  close.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendWidgetMessage(input.value);
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  const pending = localStorage.getItem(PENDING_QUESTION_KEY);
  if (pending && document.body.dataset.page === "market") {
    setOpen(true);
    setTimeout(() => prefillChatInput(pending), 100);
  }
}


/* ---------- profile-based portfolio ----------
   Rule-based personalisation from the saved learning profile.
   Clearly labelled as rules, not AI - the AI chat handles free-form plans. */
function planForProfile(profile) {
  const shortHorizon = profile.timeHorizon === "6 months";
  const midHorizon = profile.timeHorizon === "1-3 years";
  const lowRisk = profile.riskComfort === "Low";
  const highRisk = profile.riskComfort === "High";
  const emergencyReady = profile.emergencyFund === "Ready";

  if (!emergencyReady) {
    return {
      name: "Foundation-first portfolio",
      note: "Finish the emergency fund before taking real market risk.",
      split: [["Emergency savings / cash", "70%"], ["SSB or T-bills", "30%"]],
      why: "Your profile says the emergency fund is not fully ready. That means the first job is protection, not growth.",
      risk: "The main risk is opportunity cost. That is acceptable while the safety base is still being built.",
      next: "Make the emergency fund ready, then revisit the portfolio page."
    };
  }
  if (shortHorizon) {
    return {
      name: "Capital-protection route",
      note: "Your money may be needed soon, so market risk stays out.",
      split: [["Singapore Savings Bonds or T-bills", "100%"]],
      why: "Government-backed, principal protected, and SSBs start from exactly S$500. Low growth is the fair price of certainty over a short horizon.",
      risk: "Returns will be modest. That is the right trade-off for money you need soon.",
      next: "Compare the current SSB and T-bill details on MAS before applying."
    };
  }
  if (midHorizon && lowRisk) {
    return {
      name: "Cautious builder route",
      note: "A small market slice, with most money kept steady.",
      split: [["SSB / T-bills", "60%"], ["STI ETF or regular savings plan", "30%"], ["Learning buffer (cash)", "10%"]],
      why: "Most of the money stays protected while a small slice learns how market movement feels over 1-3 years.",
      risk: "The ETF slice can fall in bad years. Only the government-backed part is principal protected.",
      next: "Use a small monthly amount first, then review after a few months."
    };
  }
  if (midHorizon) {
    return {
      name: "Balanced beginner route",
      note: "A simple mix of growth and safety.",
      split: [["STI ETF or regular savings plan", "50%"], ["SSB / T-bills", "30%"], ["Robo-advisor or one blue-chip study position", "20%"]],
      why: "A real market core with a safety anchor, sized for a 1-3 year horizon and your risk comfort.",
      risk: "Market slices can drop 20%+ in a bad stretch. Your horizon gives some room to recover, but not unlimited.",
      next: "Keep single stocks small until the ETF or robo core is already in place."
    };
  }
  // 5+ years
  if (lowRisk) {
    return {
      name: "Long-term steady route",
      note: "Long horizon, but still gentle risk.",
      split: [["STI ETF via monthly regular savings plan", "50%"], ["SSB / bond ETF", "40%"], ["Learning buffer", "10%"]],
      why: "Five-plus years is where diversified market investing historically works - the monthly plan builds the habit without timing stress.",
      risk: "Even long-term, markets fall along the way. This only works if you keep holding through dips.",
      next: "Automate the monthly amount so you do not keep waiting for the perfect day."
    };
  }
  return {
    name: highRisk ? "Growth-leaning long-term route" : "Long-term growth route",
    note: "A diversified growth core, with a small learning slice.",
    split: [["STI ETF or global ETF via RSP/robo", highRisk ? "70%" : "60%"], ["SSB / bond ETF", highRisk ? "15%" : "25%"], ["One blue-chip or REIT study position", "15%"]],
    why: "With a 5+ year horizon, a diversified ETF core is the sensible engine; the single-stock slice is for learning, not for betting.",
    risk: "Higher growth potential means bigger temporary drops. Never put emergency savings here.",
    next: "Keep the learning slice capped so one stock cannot damage the whole portfolio."
  };
}

function setupPersonalPlan() {
  const mount = document.getElementById("personalPlan");
  if (!mount) return;
  const render = () => {
    const profile = getProfile();
    const plan = planForProfile(profile);
    const bars = plan.split.map(([what, pct]) => {
      const width = Math.min(100, Math.max(8, Number(String(pct).replace(/[^0-9]/g, "")) || 15));
      return `<div class="alloc-row"><div><b>${pct}</b><span>${what}</span></div><i style="width:${width}%"></i></div>`;
    }).join("");
    mount.innerHTML = `
      <article class="recommend-card portfolio-plan" style="margin-bottom:24px;border:2px solid var(--forest)">
        <span class="eyebrow">Profile-based portfolio</span>
        <h2 style="margin-top:6px">${plan.name}</h2>
        <p class="plan-note">${plan.note}</p>
        <div class="pill-row profile-chip-row" style="margin:10px 0 14px">
          <span class="pill">Risk: ${profile.riskComfort}</span>
          <span class="pill">Horizon: ${profile.timeHorizon}</span>
          <span class="pill">Budget: ${profile.budget}</span>
          <span class="pill">Emergency: ${profile.emergencyFund}</span>
          <span class="pill">Set aside: ${profile.setAside}</span>
          <a class="pill" href="profile.html" style="text-decoration:none">Change profile</a>
        </div>
        <div class="alloc-bars">${bars}</div>
        <div class="info-accordion compact" style="margin-top:16px">
          <details open><summary>Why this fits</summary><p>${plan.why}</p></details>
          <details><summary>Honest risk</summary><p>${plan.risk}</p></details>
          <details><summary>Next useful step</summary><p>${plan.next}</p></details>
        </div>
        <div class="hero-cta" style="margin-top:14px">
          <button class="btn btn-primary btn-sm prompt-ai" type="button" data-question="MoneyMentor's profile-based portfolio for me (risk ${profile.riskComfort}, horizon ${profile.timeHorizon}, budget ${profile.budget}, emergency fund ${profile.emergencyFund}, set-aside ${profile.setAside}) is: ${plan.name} - ${plan.split.map(([w, p]) => p + " " + w).join(", ")}. Explain this plan, challenge anything that seems off, and cite the sources you rely on."></button>
          <a class="btn btn-ghost btn-sm" href="profile.html">Edit profile inputs</a>
        </div>
        <p class="disclaimer" style="margin-top:10px">This is generated from your saved profile, not a quiz. Educational example only - not licensed financial advice.</p>
      </article>`;
    mount.querySelector(".prompt-ai").textContent = "Ask AI to review this plan";
    mount.querySelector(".prompt-ai").addEventListener("click", (e) => openChatWithQuestion(e.currentTarget.dataset.question));
  };
  render();
}

function highlightWhereLane(cardIndex) {
  const cards = document.querySelectorAll(".where-card");
  if (!cards.length) return;
  cards.forEach((card, i) => {
    card.style.outline = i === cardIndex ? "3px solid var(--forest)" : "";
    card.style.outlineOffset = i === cardIndex ? "2px" : "";
  });
}

/* ---------- Separate Where / What quizzes ---------- */
const WHERE_RESULTS = {
  government: {
    laneName: "Government-backed route",
    route: "SSBs or T-bills through your bank",
    cardIndex: 3,
    desc: "Best when safety, short horizon, or emergency cash matters most.",
    steps: ["Use MAS pages to compare current SSB and T-bill details.", "Keep market products for money you can leave alone longer."]
  },
  monthly: {
    laneName: "Monthly investing route",
    route: "Regular savings plan into a broad ETF",
    cardIndex: 2,
    desc: "Best when you want a simple habit and can set aside money every month.",
    steps: ["Start small enough that you will not stop during a market dip.", "Use this route only for money that can stay invested for years."]
  },
  robo: {
    laneName: "Robo-advisor route",
    route: "Managed diversified portfolio",
    cardIndex: 1,
    desc: "Best when you want help choosing and rebalancing the portfolio.",
    steps: ["Compare fees, risk level, and withdrawal rules.", "Choose a risk level you can stick with during a bad year."]
  },
  sgx: {
    laneName: "SGX do-it-yourself route",
    route: "Brokerage account and SGX products",
    cardIndex: 0,
    desc: "Best when you want control and are willing to learn before buying.",
    steps: ["Start with broad ETFs before single stocks.", "Keep single-company positions small until you understand the risks."]
  }
};

const WHERE_QUESTIONS = [
  { key: "need", q: "When might you need this money back?", opts: [["soon", "Within about a year"], ["medium", "In 1-3 years"], ["long", "Not for 5+ years"]] },
  { key: "safety", q: "Is your emergency fund ready?", opts: [["no", "Not yet"], ["partial", "Partly"], ["yes", "Yes, ready"]] },
  { key: "style", q: "Which route feels easiest to stick with?", opts: [["safe", "A safe government-backed route"], ["monthly", "A monthly investing habit"], ["handsOff", "An app manages it for me"], ["control", "I choose and buy through a broker"]] },
  { key: "amount", q: "How do you prefer to start?", opts: [["oneoff", "One lump sum"], ["monthly", "A small monthly amount"], ["unsure", "Not sure yet"]] },
  { key: "homework", q: "How much homework do you want?", opts: [["low", "As little as possible"], ["some", "Some, but guided"], ["high", "I want control and details"]] }
];

function scoreWhereQuiz(answers) {
  if (answers.need === "soon" || answers.safety === "no" || answers.style === "safe") return "government";
  if (answers.style === "handsOff" || (answers.homework === "low" && answers.amount !== "monthly")) return "robo";
  if (answers.amount === "monthly" || answers.style === "monthly") return "monthly";
  if (answers.style === "control" || answers.homework === "high") return "sgx";
  return "robo";
}

function setupWhereQuiz() {
  const mount = document.getElementById("whereQuiz");
  if (!mount) return;
  const saved = readJson("mm_where_quiz_result", null);
  const answers = {};
  let index = 0;

  function renderResult(result) {
    const r = WHERE_RESULTS[result.resultKey];
    mount.innerHTML = `
      <div class="wizard-shell tool-quiz">
        <div class="quiz-top"><span>Where quiz result</span><span>${new Date(result.ts).toLocaleDateString("en-SG")}</span></div>
        <h3 class="wizard-lane">${r.laneName}</h3>
        <p><b>Clear route:</b> ${r.route}</p>
        <p>${r.desc}</p>
        <ul class="mini-list">${r.steps.map((step) => `<li>${step}</li>`).join("")}</ul>
        <div class="hero-cta" style="margin-top:14px">
          <a class="btn btn-primary btn-sm" href="invest.html#buyQuiz">Next: What should I buy?</a>
          <button class="btn btn-ghost btn-sm prompt-ai" type="button" data-question="My MoneyMentor Where quiz result is ${r.laneName}: ${r.route}. Explain why this route fits, what risks to check, and what my next step should be in Singapore.">Ask AI to explain</button>
          <button class="btn btn-ghost btn-sm" id="retakeWhereQuiz" type="button">Retake Where quiz</button>
        </div>
      </div>`;
    highlightWhereLane(r.cardIndex);
    mount.querySelector("#retakeWhereQuiz").addEventListener("click", () => { index = 0; Object.keys(answers).forEach((k) => delete answers[k]); renderQuestion(); });
    mount.querySelector(".prompt-ai").addEventListener("click", (e) => openChatWithQuestion(e.currentTarget.dataset.question));
  }

  function renderQuestion() {
    const question = WHERE_QUESTIONS[index];
    mount.innerHTML = `
      <div class="wizard-shell tool-quiz">
        <div class="quiz-top"><span>Where to invest quiz</span><span>Question ${index + 1} of ${WHERE_QUESTIONS.length}</span></div>
        <div class="quiz-bar"><span style="width:${Math.round((index / WHERE_QUESTIONS.length) * 100)}%"></span></div>
        <div class="quiz-question">${question.q}</div>
        <div class="quiz-options"></div>
        ${index > 0 ? '<button class="mini-btn" id="whereBack" type="button" style="margin-top:10px">Back</button>' : ""}
      </div>`;
    const box = mount.querySelector(".quiz-options");
    question.opts.forEach(([value, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "quiz-option";
      b.textContent = label;
      b.addEventListener("click", () => {
        answers[question.key] = value;
        index += 1;
        if (index >= WHERE_QUESTIONS.length) {
          const resultKey = scoreWhereQuiz(answers);
          const result = { resultKey, ...WHERE_RESULTS[resultKey], answers: { ...answers }, ts: new Date().toISOString() };
          try { localStorage.setItem("mm_where_quiz_result", JSON.stringify(result)); } catch {}
          showToast("Where quiz saved.");
          renderResult(result);
        } else renderQuestion();
      });
      box.appendChild(b);
    });
    mount.querySelector("#whereBack")?.addEventListener("click", () => { index = Math.max(0, index - 1); renderQuestion(); });
  }

  if (saved?.resultKey && WHERE_RESULTS[saved.resultKey]) renderResult(saved);
  else renderQuestion();
}

const BUY_RESULTS = {
  ssb: {
    name: "Singapore Savings Bonds",
    rank: "Clear pick for safety",
    cardIndex: 0,
    risk: "Very low",
    why: "Your answers point to capital protection, flexibility, or a short horizon. SSBs are government-backed and can be redeemed monthly.",
    caveat: "Growth is lower than stocks. That is acceptable when safety is the main job."
  },
  tbill: {
    name: "T-bills or fixed deposits",
    rank: "Clear pick for short-term cash",
    cardIndex: 1,
    risk: "Low",
    why: "Your answers point to money with a known short-term job. T-bills and fixed deposits fit cash you do not want exposed to market swings.",
    caveat: "Money is locked until maturity and rates vary. Compare current options before applying."
  },
  sti: {
    name: "STI ETF via a regular savings plan",
    rank: "Clear pick for long-term beginners",
    cardIndex: 2,
    risk: "Moderate",
    why: "Your answers point to long-term growth and a repeatable habit. A broad ETF spreads risk across many companies instead of one stock.",
    caveat: "It can fall sharply in bad years. Only use money you can leave invested for years."
  },
  robo: {
    name: "Robo-advisor portfolio",
    rank: "Clear pick for hands-off beginners",
    cardIndex: 3,
    risk: "Moderate",
    why: "Your answers point to wanting the portfolio built and rebalanced for you. Robo portfolios can provide diversified ETF exposure with less manual work.",
    caveat: "Fees and risk level matter. Check what the app actually holds before funding it."
  }
};

const BUY_QUESTIONS = [
  { key: "horizon", q: "When do you need this money?", opts: [["short", "Within 6-12 months"], ["medium", "In 1-3 years"], ["long", "5+ years"]] },
  { key: "loss", q: "Could you accept a temporary 20% drop?", opts: [["no", "No"], ["maybe", "Maybe, if it is a small amount"], ["yes", "Yes, for long-term money"]] },
  { key: "style", q: "Which buying style do you prefer?", opts: [["safe", "Safe and flexible"], ["locked", "Known short-term return"], ["monthly", "Monthly ETF habit"], ["handsOff", "Managed for me"]] },
  { key: "goal", q: "What is the main job of this purchase?", opts: [["protect", "Protect my first amount"], ["learn", "Learn investing safely"], ["growth", "Grow over years"], ["income", "Understand dividends or income"]] },
  { key: "effort", q: "How much product choice do you want?", opts: [["low", "One simple answer"], ["medium", "A guided shortlist"], ["high", "I want to compare details"]] }
];

function scoreBuyQuiz(answers) {
  if (answers.horizon === "short" || answers.loss === "no" || answers.goal === "protect") {
    return answers.style === "locked" ? "tbill" : "ssb";
  }
  if (answers.style === "handsOff" || answers.effort === "low") return "robo";
  if (answers.style === "locked" && answers.horizon === "medium") return "tbill";
  return "sti";
}

function setupBuyQuiz() {
  const mount = document.getElementById("buyQuiz");
  if (!mount) return;
  const saved = readJson("mm_buy_quiz_result", null);
  const answers = {};
  let index = 0;

  function highlightBuyCard(cardIndex) {
    const cards = document.querySelectorAll(".inv-card");
    cards.forEach((card, i) => {
      card.style.outline = i === cardIndex ? "3px solid var(--forest)" : "";
      card.style.outlineOffset = i === cardIndex ? "2px" : "";
    });
  }

  function renderResult(result) {
    const r = BUY_RESULTS[result.resultKey];
    mount.innerHTML = `
      <div class="wizard-shell tool-quiz buy-result">
        <div class="quiz-top"><span>What-to-buy result</span><span>${new Date(result.ts).toLocaleDateString("en-SG")}</span></div>
        <span class="pill" style="margin-bottom:10px">${r.rank}</span>
        <h3 class="wizard-lane">${r.name}</h3>
        <p><b>Why:</b> ${r.why}</p>
        <p><b>Risk to respect:</b> ${r.caveat}</p>
        <div class="wizard-scores">
          <span class="pill">Risk: ${r.risk}</span>
          <span class="pill">One clear recommendation</span>
          <span class="pill">Analysis below</span>
        </div>
        <div class="hero-cta" style="margin-top:14px">
          <a class="btn btn-primary btn-sm" href="smart-picks.html">Build a portfolio from my profile</a>
          <button class="btn btn-ghost btn-sm prompt-ai" type="button" data-question="My MoneyMentor What-to-buy quiz result is ${r.name}. Explain why this is the clear first pick for me, what risks to check, and what alternatives I should compare in Singapore.">Ask AI to explain</button>
          <button class="btn btn-ghost btn-sm" id="retakeBuyQuiz" type="button">Retake What quiz</button>
        </div>
      </div>`;
    highlightBuyCard(r.cardIndex);
    mount.querySelector("#retakeBuyQuiz").addEventListener("click", () => { index = 0; Object.keys(answers).forEach((k) => delete answers[k]); renderQuestion(); });
    mount.querySelector(".prompt-ai").addEventListener("click", (e) => openChatWithQuestion(e.currentTarget.dataset.question));
  }

  function renderQuestion() {
    const question = BUY_QUESTIONS[index];
    mount.innerHTML = `
      <div class="wizard-shell tool-quiz">
        <div class="quiz-top"><span>What to buy quiz</span><span>Question ${index + 1} of ${BUY_QUESTIONS.length}</span></div>
        <div class="quiz-bar"><span style="width:${Math.round((index / BUY_QUESTIONS.length) * 100)}%"></span></div>
        <div class="quiz-question">${question.q}</div>
        <div class="quiz-options"></div>
        ${index > 0 ? '<button class="mini-btn" id="buyBack" type="button" style="margin-top:10px">Back</button>' : ""}
      </div>`;
    const box = mount.querySelector(".quiz-options");
    question.opts.forEach(([value, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "quiz-option";
      b.textContent = label;
      b.addEventListener("click", () => {
        answers[question.key] = value;
        index += 1;
        if (index >= BUY_QUESTIONS.length) {
          const resultKey = scoreBuyQuiz(answers);
          const result = { resultKey, ...BUY_RESULTS[resultKey], answers: { ...answers }, ts: new Date().toISOString() };
          try { localStorage.setItem("mm_buy_quiz_result", JSON.stringify(result)); } catch {}
          showToast("What-to-buy result saved.");
          renderResult(result);
        } else renderQuestion();
      });
      box.appendChild(b);
    });
    mount.querySelector("#buyBack")?.addEventListener("click", () => { index = Math.max(0, index - 1); renderQuestion(); });
  }

  if (saved?.resultKey && BUY_RESULTS[saved.resultKey]) renderResult(saved);
  else renderQuestion();
}

/* ==========================================================================
   MARKET WIDGETS - chart explainer, STI constituents, DCA calculator,
   good-time teaching, market mood. All educational; only the TradingView
   chart is live data.
   ========================================================================== */
const STI_CONSTITUENTS = [
  ["DBS Group", "Bank", "~20%"], ["OCBC Bank", "Bank", "~11%"], ["UOB", "Bank", "~10%"],
  ["Singtel", "Telecom", "~7%"], ["Jardine Matheson", "Conglomerate", "~5%"],
  ["CapitaLand Int. Commercial Trust", "REIT", "~4%"], ["Keppel", "Industrial", "~4%"],
  ["ST Engineering", "Industrial", "~4%"], ["Sembcorp", "Utilities", "~3%"], ["Genting Singapore", "Leisure", "~2%"]
];

function setupMarketWidgets() {
  // 1. How to read this chart
  const explain = document.getElementById("chartExplainer");
  if (explain) {
    explain.innerHTML = `
      <details class="market-explainer">
        <summary>New to charts? How to read this line</summary>
        <ul class="mini-list">
          <li><b>The line is the STI:</b> Singapore's broad market benchmark.</li>
          <li><b>Daily moves are noise:</b> beginners should think in years, not hours.</li>
          <li><b>Red days are normal:</b> selling in panic can turn a temporary dip into a real loss.</li>
          <li><b>You buy exposure through ETFs:</b> not the index itself.</li>
        </ul>
      </details>`;
  }

  // 2. What's inside the STI
  const consti = document.getElementById("stiConstituents");
  if (consti) {
    consti.innerHTML = `
      <h3 style="margin-bottom:6px">What's actually inside the STI?</h3>
      <p style="color:var(--muted);margin-bottom:10px">An STI ETF gives you one slice of many Singapore names. The weights below are teaching estimates, not a live factsheet.</p>
      <div class="consti-grid">
        ${STI_CONSTITUENTS.map(([name, sector, weight]) => `<div class="consti-item"><b>${name}</b><span>${sector}</span><span class="pill">${weight}</span></div>`).join("")}
      </div>
      <p class="disclaimer" style="margin-top:8px">Notice the banks alone are roughly 40% - when rate news moves banks, it moves the whole index.</p>`;
  }

  // 3. DCA / compound growth calculator
  const calc = document.getElementById("dcaCalc");
  if (calc) {
    calc.innerHTML = `
      <h3 style="margin-bottom:6px">What could S$X a month become?</h3>
      <p style="color:var(--muted);margin-bottom:12px">A compounding illustration only. Real returns are not guaranteed.</p>
      <div class="calc-row">
        <label>Monthly amount (S$)<input type="number" id="calcMonthly" value="100" min="10" max="10000" step="10"></label>
        <label>Years<input type="number" id="calcYears" value="10" min="1" max="40"></label>
        <label>Assumed yearly return<select id="calcRate">
          <option value="0.02">2% (very safe, SSB-like)</option>
          <option value="0.04" selected>4% (balanced)</option>
          <option value="0.06">6% (diversified equities, long-term)</option>
          <option value="0.08">8% (optimistic)</option>
        </select></label>
      </div>
      <div class="calc-out" id="calcOut"></div>
      <div id="calcChart"></div>`;
    const run = () => {
      const monthly = Math.max(0, Number(document.getElementById("calcMonthly").value) || 0);
      const years = Math.min(40, Math.max(1, Number(document.getElementById("calcYears").value) || 1));
      const rate = Number(document.getElementById("calcRate").value) / 12;
      let value = 0; const points = [];
      for (let m = 1; m <= years * 12; m++) { value = (value + monthly) * (1 + rate); if (m % 12 === 0) points.push(value); }
      const contributed = monthly * years * 12;
      document.getElementById("calcOut").innerHTML = `
        <div class="calc-stat"><span>You put in</span><b>S$${Math.round(contributed).toLocaleString("en-SG")}</b></div>
        <div class="calc-stat"><span>Illustrative value</span><b>S$${Math.round(value).toLocaleString("en-SG")}</b></div>
        <div class="calc-stat"><span>Growth doing the work</span><b>S$${Math.round(value - contributed).toLocaleString("en-SG")}</b></div>`;
      const max = Math.max(...points, 1); const w = 320, h = 90;
      const bars = points.map((p, i) => `<rect x="${(i * w / points.length).toFixed(1)}" y="${(h - p / max * h).toFixed(1)}" width="${Math.max(2, w / points.length - 2).toFixed(1)}" height="${(p / max * h).toFixed(1)}" rx="1.5" fill="var(--forest)" opacity="${0.35 + 0.65 * (i / points.length)}"/>`).join("");
      document.getElementById("calcChart").innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:420px;height:auto;margin-top:10px" aria-label="Growth per year">${bars}</svg>`;
    };
    ["calcMonthly", "calcYears", "calcRate"].forEach((id) => document.getElementById(id).addEventListener("input", run));
    run();
  }

  // 4. "Is now a good time?" teaching
  const timing = document.getElementById("goodTime");
  if (timing) {
    timing.innerHTML = `
      <h3 style="margin-bottom:6px">"Is now a good time to invest?"</h3>
      <p style="margin-bottom:8px">Honest answer: <b>nobody reliably knows</b>. Beginners control the habit, not the headlines.</p>
      <ul class="mini-list">
        <li><b>DCA:</b> invest a fixed amount monthly instead of guessing the perfect day.</li>
        <li><b>Horizon first:</b> money needed soon belongs in safer tools like SSBs or T-bills.</li>
        <li><b>Practise first:</b> use Market Run before real money meets a crash.</li>
      </ul>
      <div class="hero-cta"><a class="btn btn-ghost btn-sm" href="practice.html">Practise a market year</a>
      <button class="btn btn-ghost btn-sm prompt-ai" type="button" data-question="Explain dollar-cost averaging with a concrete Singapore example (S$100 a month into an STI ETF), including what happens in a falling market.">Ask Bot about DCA</button></div>`;
    timing.querySelector(".prompt-ai")?.addEventListener("click", (e) => openChatWithQuestion(e.currentTarget.dataset.question, { mode: "widget" }));
  }

  // 5. Market mood - explicitly educational
  const mood = document.getElementById("marketMood");
  if (mood) {
    mood.innerHTML = `
      <h3 style="margin-bottom:6px">Market mood, without overreacting</h3>
      <p style="margin-bottom:8px">"Risk-on" means optimism. "Risk-off" means fear. Useful for context, not prediction.</p>
      <ul class="mini-list">
        <li>Mood explains why things moved. It does not tell you tomorrow.</li>
        <li>If your plan changes with every mood swing, the plan is too fragile.</li>
      </ul>
      <p class="disclaimer">Educational explainer - MoneyMentor does not publish live sentiment signals.</p>`;
  }
}

/* ==========================================================================
   WATCHLIST - personal, local. Save things to learn about; ask AI about them.
   ========================================================================== */
const WATCHABLE = [
  "STI ETF", "S&P 500 / global ETF", "DBS", "OCBC", "UOB", "Singtel",
  "CapitaLand Int. Commercial Trust (REIT)", "Mapletree Logistics Trust (REIT)",
  "ABF SG Bond ETF", "Singapore Savings Bonds", "T-bills", "Robo-advisors", "Gold", "REITs in general"
];

function getWatchlist() { return readJson("mm_watchlist", []); }
function saveWatchlist(list) { try { localStorage.setItem("mm_watchlist", JSON.stringify(list.slice(0, 30))); } catch {} }

function setupWatchlist() {
  const mount = document.getElementById("watchlist");
  if (!mount) return;
  const render = () => {
    const list = getWatchlist();
    mount.innerHTML = `
      <h3 style="margin-bottom:6px">Your watchlist <span class="pill" style="font-size:.6rem;vertical-align:middle">Private to this browser</span></h3>
      <p style="color:var(--muted);margin-bottom:10px">Use this as a learning list, not a buy list. Save names you want to understand, then ask the bot to explain the risk before you touch real money.</p>
      <div class="watch-chips">${WATCHABLE.map((w) => `<button type="button" class="watch-chip ${list.includes(w) ? "on" : ""}" data-w="${w}">${list.includes(w) ? "✓ " : "+ "}${w}</button>`).join("")}</div>
      ${list.length ? `<div class="hero-cta" style="margin-top:12px">
        <button class="btn btn-primary btn-sm prompt-ai" type="button" data-question="My MoneyMentor watchlist: ${list.join(", ")}. For each item, explain in one beginner-friendly paragraph what it is, its risk level, and one thing I should learn before touching it. Use trusted Singapore sources.">Ask Bot about my watchlist</button>
        <button class="btn btn-ghost btn-sm" id="clearWatch" type="button">Clear list</button></div>` : ""}`;
    mount.querySelectorAll(".watch-chip").forEach((chip) => chip.addEventListener("click", () => {
      const w = chip.dataset.w; let l = getWatchlist();
      openChatWithQuestion(`Explain ${w} from my MoneyMentor watchlist for a beginner in Singapore. What is it, what is its risk level, and what should I learn before touching it? Use trusted Singapore sources.`, { mode: "widget" });
      l = l.includes(w) ? l.filter((x) => x !== w) : [...l, w];
      saveWatchlist(l); render();
    }));
    mount.querySelector("#clearWatch")?.addEventListener("click", () => { saveWatchlist([]); render(); });
    mount.querySelectorAll(".prompt-ai").forEach((b) => b.addEventListener("click", () => openChatWithQuestion(b.dataset.question, { mode: "widget" })));
  };
  render();
}

/* ==========================================================================
   MARKET PULSE - restored floating system (from the original build) +
   standalone page. FAB with unread count, slide-in sidebar, one-time toast.
   ========================================================================== */
const PULSE_POPUPS_KEY = "mm_pulse_toast_seen";

function pulseUnreadCount() {
  const opened = readJson(PULSE_OPENED_KEY, []);
  return MARKET_ALERTS.filter((a) => !opened.includes(a.id)).length;
}

function setupPulseSystem() {
  const page = document.body.dataset.page;
  if (page === "chat" || page === "practice" || document.getElementById("pulsePageGrid")) return; // keep the game + chat immersive
  // FAB
  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "pulse-fab";
  fab.setAttribute("aria-label", "Open Market Pulse");
  fab.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><span class="pulse-count" id="pulseCount"></span>`;
  document.body.appendChild(fab);

  // Sidebar
  const backdrop = document.createElement("div");
  backdrop.className = "pulse-backdrop";
  const sidebar = document.createElement("aside");
  sidebar.className = "pulse-sidebar";
  sidebar.setAttribute("aria-label", "Market Pulse");
  sidebar.innerHTML = `
    <div class="pulse-side-head"><b>Market Pulse</b><span class="pill" style="font-size:.6rem">Teaching examples - not live news</span><button type="button" class="pulse-close" aria-label="Close">×</button></div>
    <div class="pulse-side-list" id="pulseSideList"></div>
    <div class="pulse-side-foot"><a href="market-pulse.html">Open the full Market School →</a></div>`;
  document.body.append(backdrop, sidebar);

  const renderList = () => {
    const opened = readJson(PULSE_OPENED_KEY, []);
    document.getElementById("pulseSideList").innerHTML = MARKET_ALERTS.map((a) => `
      <a class="pulse-item ${opened.includes(a.id) ? "read" : ""}" href="market-pulse.html#${a.id}">
        <span class="pulse-dot"></span>
        <span><b>${a.title}</b><span>${a.short}</span></span>
      </a>`).join("");
    const count = pulseUnreadCount();
    const badge = document.getElementById("pulseCount");
    if (badge) { badge.textContent = count || ""; badge.style.display = count ? "grid" : "none"; }
  };

  const open = () => { sidebar.classList.add("open"); backdrop.classList.add("show"); renderList(); };
  const close = () => { sidebar.classList.remove("open"); backdrop.classList.remove("show"); };
  fab.addEventListener("click", open);
  backdrop.addEventListener("click", close);
  sidebar.querySelector(".pulse-close").addEventListener("click", close);
  renderList();

  // One-time toast (never nags twice)
  try {
    if (!localStorage.getItem(PULSE_POPUPS_KEY) && pulseUnreadCount() > 0 && page === "home") {
      const toast = document.createElement("div");
      toast.className = "pulse-toast";
      toast.innerHTML = `<b>Market Pulse:</b> ${MARKET_ALERTS[0].title} <button type="button">Read</button><button type="button" class="ghost">Dismiss</button>`;
      document.body.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add("show"));
      const [read, dismiss] = toast.querySelectorAll("button");
      read.addEventListener("click", () => { location.href = "market-pulse.html#" + MARKET_ALERTS[0].id; });
      dismiss.addEventListener("click", () => toast.remove());
      setTimeout(() => toast.remove(), 12000);
      localStorage.setItem(PULSE_POPUPS_KEY, "1");
    }
  } catch {}
}

/* Standalone Market Pulse page (market-pulse.html) */
function setupPulsePage() {
  const grid = document.getElementById("pulsePageGrid");
  if (!grid) return;
  const opened = readJson(PULSE_OPENED_KEY, []);
  grid.innerHTML = MARKET_ALERTS.map((a) => `
    <article class="pulse-card ${opened.includes(a.id) ? "read" : ""}" id="${a.id}">
      <span class="eyebrow">${a.label} · teaching example</span>
      <h3>${a.title}</h3>
      <p><b>What happened:</b> ${a.happened}</p>
      <p><b>Why it matters:</b> ${a.why}</p>
      <p><b>What a beginner should do:</b> ${a.beginner}</p>
      <p style="color:var(--muted)"><b>Risk context:</b> ${a.riskContext}</p>
      <div class="hero-cta" style="margin-top:10px">
        ${a.source ? `<a class="btn btn-ghost btn-sm" href="${a.source.href}" target="_blank" rel="noopener">Real source: ${a.source.name}</a>` : ""}
        <button class="btn btn-ghost btn-sm prompt-ai" type="button" data-question="Explain this market situation for a beginner in Singapore: ${a.title}. ${a.short} What should I understand and what mistakes should I avoid?">Ask AI about this</button>
        <a class="btn btn-ghost btn-sm" href="practice.html">Practise an event like this</a>
      </div>
    </article>`).join("");
  grid.querySelectorAll(".prompt-ai").forEach((b) => b.addEventListener("click", () => openChatWithQuestion(b.dataset.question)));
  // mark all as opened once viewed
  try { localStorage.setItem(PULSE_OPENED_KEY, JSON.stringify(MARKET_ALERTS.map((a) => a.id))); } catch {}
}

function setupMarketLabels() {
  const list = document.getElementById("newsList");
  if (!list) return;
  const banner = document.createElement("div");
  banner.className = "callout callout-warn";
  banner.style.margin = "0 0 18px";
  banner.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span><b>Sample educational updates, not live news.</b> These explain how common market events work. For today\u2019s actual news, use the linked sources or the live STI chart above.</span>';
  list.parentNode.insertBefore(banner, list);
}

/* ---------- profile evidence export ---------- */
function setupEvidenceExport() {
  document.getElementById("exportEvidenceBtn")?.addEventListener("click", exportLearningEvidence);
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
setupSelfTests();
setupHomeDashboard();
setupProfilePage();
setupGlossary();
setupQuiz();
setupMarketNews();
setupLiveMarketNews();
setupMarketDecoder();
setupChatTriggers();
loadChatWidget();
setupWhereQuiz();
setupBuyQuiz();
setupPersonalPlan();
setupMarketWidgets();
setupWatchlist();
setupMarketLabels();
setupPulseSystem();
setupPulsePage();
setupEvidenceExport();
setupReveal();
setupAnchorScroll();
updateProgress();

/* ---------- shared API for the AI chat workspace (chat.html) ---------- */
window.MM = {
  getProfile,
  getChatMetadata,
  CHAT_WEBHOOK_URL,
  exportLearningEvidence
};
