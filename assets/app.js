const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
const PROFILE_KEY = "mm_learning_profile";
const SESSION_KEY = "mm_session_id";

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
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    if (stored && stored.sessionId) {
      return { ...defaultProfile(), ...stored, sessionId: stored.sessionId };
    }
  } catch {}
  const profile = defaultProfile();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

function saveProfile(profile) {
  const existing = getProfile();
  const next = {
    ...existing,
    ...profile,
    sessionId: existing.sessionId || getSessionId(),
    updatedAt: new Date().toISOString()
  };
  if (!next.createdAt) next.createdAt = next.updatedAt;
  localStorage.setItem(SESSION_KEY, next.sessionId);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  updateProfileUI(next);
  return next;
}

function shortSessionId(sessionId) {
  return sessionId ? `${sessionId.slice(0, 8)}...${sessionId.slice(-6)}` : "Not created";
}

function updateProfileUI(profile = getProfile()) {
  const displayName = profile.nickname?.trim() || "Guest";
  const pageName = document.getElementById("profileStatusName");
  const pageSession = document.getElementById("profileSessionId");
  const pageLevel = document.getElementById("profileStatusLevel");
  const pageBudget = document.getElementById("profileStatusBudget");
  const pageRisk = document.getElementById("profileStatusRisk");
  const pageHorizon = document.getElementById("profileStatusHorizon");
  const pageGoal = document.getElementById("profileStatusGoal");
  if (pageName) pageName.textContent = displayName;
  if (pageSession) pageSession.textContent = profile.sessionId;
  if (pageLevel) pageLevel.textContent = profile.beginnerLevel;
  if (pageBudget) pageBudget.textContent = profile.budget;
  if (pageRisk) pageRisk.textContent = profile.riskComfort;
  if (pageHorizon) pageHorizon.textContent = profile.timeHorizon;
  if (pageGoal) pageGoal.textContent = profile.goal;

  const sideName = document.getElementById("sideProfileName");
  const sideSession = document.getElementById("sideSessionId");
  const sideBeginner = document.getElementById("sideBeginnerLevel");
  const sideBudget = document.getElementById("sideBudget");
  const sideRisk = document.getElementById("sideRiskComfort");
  const sideGoal = document.getElementById("sideGoal");
  if (sideName) sideName.textContent = displayName;
  if (sideSession) sideSession.textContent = shortSessionId(profile.sessionId);
  if (sideBeginner) sideBeginner.textContent = profile.beginnerLevel;
  if (sideBudget) sideBudget.textContent = profile.budget;
  if (sideRisk) sideRisk.textContent = profile.riskComfort;
  if (sideGoal) sideGoal.textContent = profile.goal;

  document.querySelectorAll("[data-profile-name]").forEach((el) => {
    el.textContent = displayName;
  });
}

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
}

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

const profileForm = document.getElementById("profileForm");
if (profileForm) {
  fillProfileForm();
  updateProfileUI();
  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveProfile(profileFromForm("profile"));
    showProfileSuccess("Profile saved. Your session ID is ready for n8n and Google Sheets logging.");
  });
}

const startGuest = document.getElementById("startGuest");
if (startGuest) {
  startGuest.addEventListener("click", () => {
    const profile = saveProfile({ ...profileFromForm("guest"), nickname: "Guest", profileMode: "guest" });
    fillProfileForm(profile);
    showProfileSuccess("Guest profile started. You still have a stable session ID for memory and logging.");
  });
}

updateProfileUI();

const revealEls = document.querySelectorAll(".reveal");
if (revealEls.length) {
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }
}

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

function openChatWithQuestion(question = "") {
  if (question) {
    localStorage.setItem("mm_pending_question", question);
    navigator.clipboard?.writeText(question).catch(() => {});
  }
  const toggle = document.querySelector(".chat-window-toggle, [class*='chat-window-toggle']");
  if (toggle) toggle.click();
  setTimeout(() => {
    const input = document.querySelector(".chat-input textarea, .chat-input input, textarea[placeholder], input[placeholder]");
    if (input && question) {
      input.value = question;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }
  }, 450);
}

document.querySelectorAll(".prompt-ai").forEach((button) => {
  button.addEventListener("click", () => openChatWithQuestion(button.dataset.question || ""));
});

document.querySelectorAll(".open-chat").forEach((button) => {
  button.addEventListener("click", () => openChatWithQuestion(""));
});

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

const libGrid = document.getElementById("libGrid");
const libEmpty = document.getElementById("libEmpty");
const libSearch = document.getElementById("libSearch");

function renderTerms(list) {
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
    b.className = "btn btn-ghost prompt-ai";
    b.style.marginTop = "14px";
    b.textContent = "Ask AI";
    b.dataset.question = `Explain ${term} in simple beginner language with a Singapore investing example.`;
    b.addEventListener("click", () => openChatWithQuestion(b.dataset.question));
    el.append(h, p, b);
    libGrid.appendChild(el);
  });
  libEmpty.style.display = list.length ? "none" : "block";
}

if (libGrid && libSearch) {
  renderTerms(TERMS);
  libSearch.addEventListener("input", (event) => {
    const q = event.target.value.trim().toLowerCase();
    if (!q) {
      renderTerms(TERMS);
      return;
    }
    renderTerms(TERMS.filter(([term, desc]) => `${term} ${desc}`.toLowerCase().includes(q)));
  });
}

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

const quizShell = document.getElementById("quizShell");
const quizResults = document.getElementById("quizResults");
let quizIndex = 0;
let selected = null;
let answers = [];

function getProgress() {
  return JSON.parse(localStorage.getItem("mm_original_split_progress") || '{"best":0,"attempts":0}');
}

function saveProgress(score) {
  const progress = getProgress();
  progress.attempts += 1;
  progress.best = Math.max(progress.best, score);
  localStorage.setItem("mm_original_split_progress", JSON.stringify(progress));
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
  const levelName = document.getElementById("levelName");
  const nextLevel = document.getElementById("nextLevel");
  const progressFill = document.getElementById("progressFill");
  const bestScore = document.getElementById("bestScore");
  const attempts = document.getElementById("attempts");
  if (levelName) levelName.textContent = level.name;
  if (nextLevel) nextLevel.textContent = next ? `Next: ${next.name}` : "Top level";
  if (progressFill) progressFill.style.width = `${fill}%`;
  if (bestScore) bestScore.textContent = `${progress.best}%`;
  if (attempts) attempts.textContent = progress.attempts;
}

function renderQuestion() {
  if (!quizShell) return;
  const item = QUIZ[quizIndex];
  selected = null;
  document.getElementById("quizCount").textContent = `Question ${quizIndex + 1} of ${QUIZ.length}`;
  document.getElementById("quizLevel").textContent = `${item.level} · ${item.type}`;
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
      selected = index;
      options.querySelectorAll(".quiz-option").forEach((b) => b.classList.remove("selected"));
      button.classList.add("selected");
      document.getElementById("quizExplain").textContent = item.why;
    });
    options.appendChild(button);
  });
  document.getElementById("nextQuestion").textContent = quizIndex === QUIZ.length - 1 ? "Finish quiz" : "Next question";
}

function finishQuiz() {
  const correct = answers.filter((answer) => answer.correct).length;
  const score = Math.round((correct / QUIZ.length) * 100);
  saveProgress(score);
  quizShell.style.display = "none";
  quizResults.style.display = "block";
  document.getElementById("resultScore").textContent = `${score}%`;
  document.getElementById("resultLevel").textContent = levelFor(score).name;
  document.getElementById("resultSummary").textContent =
    score >= 80 ? "Strong result. You understand beginner meanings and can handle investing scenarios." :
    score >= 50 ? "Good start. Review the missed scenarios, then retake the quiz." :
    "Start with MoneySense basics and retake the quiz after the lessons.";
  const review = document.getElementById("reviewList");
  review.innerHTML = "";
  answers.forEach((answer, i) => {
    const item = QUIZ[i];
    const div = document.createElement("div");
    div.className = `review-item ${answer.correct ? "" : "wrong"}`;
    div.innerHTML = `<strong>${i + 1}. ${item.level} ${item.type}</strong><br>${item.q}<br><span>${answer.correct ? "Correct" : `Your answer: ${item.options[answer.selected] || "No answer"} · Correct: ${item.options[item.answer]}`}</span><p>${item.why}</p>`;
    review.appendChild(div);
  });
}

if (quizShell) {
  updateProgress();
  renderQuestion();
  document.getElementById("nextQuestion").addEventListener("click", () => {
    if (selected === null) {
      document.getElementById("quizExplain").textContent = "Choose one answer before moving on.";
      return;
    }
    const item = QUIZ[quizIndex];
    answers.push({ selected, correct: selected === item.answer });
    if (quizIndex === QUIZ.length - 1) {
      finishQuiz();
      return;
    }
    quizIndex += 1;
    renderQuestion();
  });
}

const retake = document.getElementById("retakeQuiz");
if (retake) {
  retake.addEventListener("click", () => {
    quizIndex = 0;
    selected = null;
    answers = [];
    quizResults.style.display = "none";
    quizShell.style.display = "block";
    renderQuestion();
  });
}

const MARKET_ALERTS = [
  {
    id: "sti-bank-move",
    label: "Market move",
    title: "Bank stocks move after rate news",
    short: "DBS, OCBC, and UOB can move when interest-rate expectations change.",
    happened: "Interest-rate expectations can affect bank lending margins, deposits, loan demand, and investor appetite for bank dividends.",
    beginner: "If bank shares jump or fall suddenly, do not treat the move as a simple buy signal. First ask whether earnings, dividends, interest rates, and valuation still make sense.",
    affected: ["DBS", "OCBC", "UOB", "STI ETF"],
    sourceName: "The Business Times markets",
    sourceUrl: "https://www.businesstimes.com.sg/markets"
  },
  {
    id: "reits-borrowing-costs",
    label: "Sector alert",
    title: "REITs react to borrowing costs",
    short: "REIT prices can move when investors expect higher or lower interest rates.",
    happened: "Many REITs use debt to own and manage property. Higher borrowing costs can pressure distributions and lower investor demand for high-yield assets.",
    beginner: "High yield is not free money. Check gearing, occupancy, debt maturity, and whether distributions look sustainable.",
    affected: ["REITs", "REIT ETFs", "Income investors"],
    sourceName: "Reuters markets",
    sourceUrl: "https://www.reuters.com/markets/"
  },
  {
    id: "global-volatility",
    label: "Global shock",
    title: "Global market sell-off may spill into Asia",
    short: "US and China headlines can affect Singapore shares even when the company itself did nothing wrong.",
    happened: "Singapore is an open market. Global risk-off moves can affect banks, tech-linked names, REITs, and broad ETFs through sentiment and fund flows.",
    beginner: "When markets fall together, focus on your time horizon and diversification. Broad weakness is different from a company-specific problem.",
    affected: ["STI ETF", "Global ETFs", "Blue chips"],
    sourceName: "CNA Business",
    sourceUrl: "https://www.channelnewsasia.com/business"
  },
  {
    id: "sgx-market-update",
    label: "Official source",
    title: "SGX market update available",
    short: "Use SGX research and market updates to understand local market context.",
    happened: "SGX publishes market information, education, and research resources that can help users understand what is moving locally.",
    beginner: "Before acting on social-media excitement, compare the claim against official market context and trusted reporting.",
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
    affected: ["New investors", "Telegram groups", "High-yield schemes"],
    sourceName: "MAS Investor Alert List",
    sourceUrl: "https://www.mas.gov.sg/investor-alert-list"
  }
];

const PULSE_OPENED_KEY = "mm_market_pulse_opened";
const PULSE_POPUPS_KEY = "mm_market_pulse_popups";

function getOpenedAlerts() {
  try {
    const ids = JSON.parse(localStorage.getItem(PULSE_OPENED_KEY) || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function saveOpenedAlerts(ids) {
  localStorage.setItem(PULSE_OPENED_KEY, JSON.stringify([...new Set(ids)]));
}

function getAlert(id) {
  return MARKET_ALERTS.find((alert) => alert.id === id) || MARKET_ALERTS[0];
}

function openedAlertCount() {
  const opened = getOpenedAlerts();
  return MARKET_ALERTS.filter((alert) => opened.includes(alert.id)).length;
}

function unreadAlertCount() {
  return MARKET_ALERTS.length - openedAlertCount();
}

function markAlertOpened(id) {
  const opened = getOpenedAlerts();
  if (!opened.includes(id)) {
    opened.push(id);
    saveOpenedAlerts(opened);
  }
}

function renderPulseDetail(id) {
  const detail = document.getElementById("pulseDetail");
  if (!detail) return;
  const alert = getAlert(id);
  detail.innerHTML = `
    <h4>${alert.title}</h4>
    <p><strong>What happened:</strong> ${alert.happened}</p>
    <p><strong>Beginner translation:</strong> ${alert.beginner}</p>
    <p><strong>Affected:</strong></p>
    <ul>${alert.affected.map((item) => `<li>${item}</li>`).join("")}</ul>
    <div class="source-link">
      <a class="btn btn-primary" href="${alert.sourceUrl}" target="_blank" rel="noopener">Open trusted source</a>
    </div>
  `;
}

function updatePulseNumbers(activeId = null) {
  const opened = getOpenedAlerts();
  const openedCount = openedAlertCount();
  const unread = unreadAlertCount();
  document.querySelectorAll("[data-pulse-count]").forEach((el) => {
    el.textContent = unread;
    el.style.display = unread ? "inline-grid" : "none";
  });
  document.querySelectorAll("[data-pulse-opened]").forEach((el) => {
    el.textContent = openedCount;
  });
  document.querySelectorAll("[data-pulse-total]").forEach((el) => {
    el.textContent = MARKET_ALERTS.length;
  });
  document.querySelectorAll("[data-pulse-unread]").forEach((el) => {
    el.textContent = unread;
  });
  document.querySelectorAll(".pulse-item").forEach((item) => {
    const id = item.dataset.alertId;
    item.classList.toggle("opened", opened.includes(id));
    item.classList.toggle("active", id === activeId);
    const status = item.querySelector("[data-alert-status]");
    if (status) status.textContent = opened.includes(id) ? "Opened" : "New";
  });
}

function renderPulseList(activeId = MARKET_ALERTS[0].id) {
  const list = document.getElementById("pulseList");
  if (!list) return;
  const opened = getOpenedAlerts();
  list.innerHTML = MARKET_ALERTS.map((alert) => `
    <button class="pulse-item ${opened.includes(alert.id) ? "opened" : ""} ${alert.id === activeId ? "active" : ""}" type="button" data-alert-id="${alert.id}">
      <span data-alert-status>${opened.includes(alert.id) ? "Opened" : "New"}</span>
      <strong>${alert.title}</strong>
      <small>${alert.short}</small>
    </button>
  `).join("");
  list.querySelectorAll(".pulse-item").forEach((button) => {
    button.addEventListener("click", () => openPulseSidebar(button.dataset.alertId));
  });
  updatePulseNumbers(activeId);
}

function refreshAccountPanel() {
  const progress = getProgress();
  const profile = getProfile();
  const best = progress.best || 0;
  const level = levelFor(best).name;
  const quizLevel = document.getElementById("sideQuizLevel");
  const bestScore = document.getElementById("sideBestScore");
  if (quizLevel) quizLevel.textContent = level;
  if (bestScore) bestScore.textContent = `${best}%`;
  updateProfileUI(profile);
}

function openPulseSidebar(id = null) {
  const activeId = id || MARKET_ALERTS[0].id;
  if (id) markAlertOpened(id);
  document.body.classList.add("pulse-open");
  const sidebar = document.getElementById("pulseSidebar");
  if (sidebar) sidebar.setAttribute("aria-hidden", "false");
  renderPulseList(activeId);
  renderPulseDetail(activeId);
  refreshAccountPanel();
  const toast = document.getElementById("pulseToast");
  if (toast) toast.classList.remove("show");
  if (id) {
    setTimeout(() => {
      document.getElementById("pulseDetail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }
}

function closePulseSidebar() {
  document.body.classList.remove("pulse-open");
  const sidebar = document.getElementById("pulseSidebar");
  if (sidebar) sidebar.setAttribute("aria-hidden", "true");
}

function renderPulsePage() {
  const grid = document.getElementById("pulsePageGrid");
  if (!grid) return;
  grid.innerHTML = MARKET_ALERTS.map((alert) => `
    <article class="pulse-card reveal in">
      <span class="meta">${alert.label}</span>
      <h3>${alert.title}</h3>
      <p><strong>What happened:</strong> ${alert.short}</p>
      <p><strong>Beginner lesson:</strong> ${alert.beginner}</p>
      <div class="pill-row">${alert.affected.map((item) => `<span class="pulse-chip">Affected: ${item}</span>`).join("")}</div>
      <div class="pulse-actions">
        <button class="btn btn-primary" type="button" data-pulse-open="${alert.id}">Open details</button>
        <a class="btn btn-ghost" href="${alert.sourceUrl}" target="_blank" rel="noopener">${alert.sourceName}</a>
      </div>
    </article>
  `).join("");
  grid.querySelectorAll("[data-pulse-open]").forEach((button) => {
    button.addEventListener("click", () => openPulseSidebar(button.dataset.pulseOpen));
  });
}

function injectPulseSidebar() {
  if (document.getElementById("pulseSidebar")) return;
  const shell = document.createElement("div");
  shell.innerHTML = `
    <button class="pulse-fab" id="pulseFab" type="button" aria-label="Open Market Pulse notifications">
      Market Pulse <span class="pulse-badge" data-pulse-count>0</span>
    </button>
    <div class="pulse-toast" id="pulseToast" role="status">
      <strong>Market Pulse alerts are ready</strong>
      <p><span data-pulse-unread>0</span> unread beginner-friendly market notifications.</p>
      <div class="toast-actions">
        <button class="btn btn-primary" type="button" id="toastOpenPulse">Open Pulse</button>
        <button class="btn btn-ghost" type="button" id="toastDismissPulse">Dismiss</button>
      </div>
    </div>
    <div class="pulse-backdrop" id="pulseBackdrop"></div>
    <aside class="pulse-sidebar" id="pulseSidebar" aria-hidden="true" aria-label="MoneyMentor sidebar">
      <div class="pulse-side-head">
        <div>
          <span class="eyebrow">Dashboard</span>
          <h2>Account, settings, and Market Pulse.</h2>
        </div>
        <button class="icon-btn" id="pulseClose" type="button" aria-label="Close sidebar">x</button>
      </div>
      <div class="pulse-side-body">
        <section class="side-section">
          <h3>Account</h3>
          <div class="account-mini">
            <div class="mini-stat"><b id="sideProfileName">Guest</b><span>Current profile</span></div>
            <div class="mini-stat"><b id="sideSessionId">Not created</b><span>Session ID</span></div>
            <div class="mini-stat"><b id="sideBeginnerLevel">Noob</b><span>Beginner level</span></div>
            <div class="mini-stat"><b id="sideBudget">S$500</b><span>Budget</span></div>
            <div class="mini-stat"><b id="sideRiskComfort">Low</b><span>Risk comfort</span></div>
            <div class="mini-stat"><b id="sideGoal">Safety first</b><span>Main goal</span></div>
            <div class="mini-stat"><b id="sideQuizLevel">Noob</b><span>Quiz level</span></div>
            <div class="mini-stat"><b id="sideBestScore">0%</b><span>Best quiz score</span></div>
            <div class="mini-stat"><b><span data-pulse-opened>0</span>/<span data-pulse-total>0</span></b><span>Alerts opened</span></div>
          </div>
          <div class="hero-cta" style="margin-top:14px">
            <a class="btn btn-ghost" href="profile.html">Manage profile</a>
          </div>
        </section>
        <section class="side-section">
          <h3>Settings</h3>
          <div class="setting-row">
            <div><strong>Beginner mode</strong><p>Keep explanations simple and direct.</p></div>
            <label class="switch"><input id="beginnerModeToggle" type="checkbox" checked><span class="slider"></span></label>
          </div>
          <div class="setting-row">
            <div><strong>Market pop-ups</strong><p>Show a small alert when unread notifications exist.</p></div>
            <label class="switch"><input id="pulsePopupToggle" type="checkbox"><span class="slider"></span></label>
          </div>
          <div class="hero-cta" style="margin-top:12px">
            <button class="btn btn-ghost" id="resetPulseOpened" type="button">Reset opened alerts</button>
          </div>
        </section>
        <section class="side-section">
          <div class="pulse-summary">
            <strong>Market Pulse</strong>
            <span>Opened <span data-pulse-opened>0</span> / <span data-pulse-total>0</span></span>
          </div>
          <div class="pulse-list" id="pulseList"></div>
          <div class="pulse-detail" id="pulseDetail"></div>
        </section>
      </div>
    </aside>
  `;
  document.body.append(...shell.childNodes);

  const popupToggle = document.getElementById("pulsePopupToggle");
  if (popupToggle) {
    popupToggle.checked = localStorage.getItem(PULSE_POPUPS_KEY) !== "off";
    popupToggle.addEventListener("change", () => {
      localStorage.setItem(PULSE_POPUPS_KEY, popupToggle.checked ? "on" : "off");
    });
  }

  document.getElementById("pulseFab")?.addEventListener("click", () => openPulseSidebar());
  document.getElementById("toastOpenPulse")?.addEventListener("click", () => openPulseSidebar());
  document.getElementById("toastDismissPulse")?.addEventListener("click", () => {
    sessionStorage.setItem("mm_pulse_toast_dismissed", "yes");
    document.getElementById("pulseToast")?.classList.remove("show");
  });
  document.getElementById("pulseClose")?.addEventListener("click", closePulseSidebar);
  document.getElementById("pulseBackdrop")?.addEventListener("click", closePulseSidebar);
  document.getElementById("resetPulseOpened")?.addEventListener("click", () => {
    saveOpenedAlerts([]);
    renderPulseList();
    renderPulseDetail(MARKET_ALERTS[0].id);
    refreshAccountPanel();
    maybeShowPulseToast(true);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePulseSidebar();
  });

  renderPulseList();
  renderPulseDetail(MARKET_ALERTS[0].id);
  refreshAccountPanel();
  updatePulseNumbers();
}

function maybeShowPulseToast(force = false) {
  const toast = document.getElementById("pulseToast");
  if (!toast) return;
  if (localStorage.getItem(PULSE_POPUPS_KEY) === "off" && !force) return;
  if (sessionStorage.getItem("mm_pulse_toast_dismissed") === "yes" && !force) return;
  if (unreadAlertCount() <= 0 && !force) return;
  setTimeout(() => toast.classList.add("show"), force ? 0 : 900);
}

renderPulsePage();
injectPulseSidebar();
maybeShowPulseToast();
updateProgress();

import("https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js")
  .then(({ createChat }) => {
    createChat({
      webhookUrl: "https://n8ngc.codeblazar.org/webhook/6b73ce01-53e9-4041-83e0-56e91e41b0ea/chat",
      mode: "window",
      showWelcomeScreen: false,
      initialMessages: [
        "Hi! I'm MoneyMentor 👋",
        "Ask me anything about investing in Singapore."
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
  })
  .catch(() => {
    console.warn("Chat widget could not load.");
  });
