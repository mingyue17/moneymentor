const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
const PROFILE_KEY = "mm_learning_profile";
const SESSION_KEY = "mm_session_id";
const PROGRESS_KEY = "mm_original_split_progress";
const PENDING_QUESTION_KEY = "mm_pending_question";
const BEGINNER_MODE_KEY = "mm_beginner_mode";
const STORAGE_STAMP_KEY = "mm_storage_last_seen";
const PRACTICE_KEY = "mm_practice_lab_state";
const STORAGE_EXPIRY_DAYS = 180;

// n8n Profile Save webhook.
// IMPORTANT: this is the PRODUCTION url (no "-test" in the path).
// The workflow must be Activated/Published in n8n or this will silently fail.
const PROFILE_WEBHOOK_URL = "https://n8ngc.codeblazar.org/webhook/5bd93b7b-6804-4958-9626-abc1c84ad60d";
const MANAGED_STORAGE_KEYS = [
 SESSION_KEY,
 PROFILE_KEY,
 PROGRESS_KEY,
 PENDING_QUESTION_KEY,
 BEGINNER_MODE_KEY,
 STORAGE_STAMP_KEY,
 "mm_market_pulse_opened",
 "mm_market_pulse_popups",
 PRACTICE_KEY
];

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

function applyStorageExpiry() {
 try {
 const now = Date.now();
 const lastSeen = Number(localStorage.getItem(STORAGE_STAMP_KEY) || 0);
 const maxAge = STORAGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
 if (lastSeen && now - lastSeen > maxAge) {
 MANAGED_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
 sessionStorage.removeItem("mm_pulse_toast_dismissed");
 }
 localStorage.setItem(STORAGE_STAMP_KEY, String(now));
 } catch {}
}

applyStorageExpiry();

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
 syncProfileToN8n(next);
 return next;
}

// Sends the profile to n8n -> Google Sheets (User_Profile tab).
// Fire-and-forget: if n8n is down or unreachable, the site keeps working
// normally off localStorage. We just log a warning to the console.
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
 console.warn("MoneyMentor: profile sync to n8n failed (site still works locally).", err);
 });
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

 document.querySelectorAll("[data-profile-initial]").forEach((el) => {
 el.textContent = displayName.slice(0, 1).toUpperCase() || "G";
 });
}

function setupNavProfileLink() {
 if (!navLinks || navLinks.querySelector(".nav-profile")) return;

 const smartPicksLink = [...navLinks.querySelectorAll("a")].find((link) => link.getAttribute("href") === "smart-picks.html");
 if (smartPicksLink && !navLinks.querySelector('a[href="practice.html"]')) {
 const practiceLink = document.createElement("a");
 practiceLink.href = "practice.html";
 practiceLink.textContent = "Practice Lab";
 if (location.pathname.endsWith("practice.html")) practiceLink.style.color = "var(--ink)";
 smartPicksLink.insertAdjacentElement("afterend", practiceLink);
 }

 ["where.html", "invest.html", "smart-picks.html", "practice.html"].forEach((href) => {
 navLinks.querySelector(`a[href="${href}"]`)?.classList.add("nav-direct");
 });

 const makeDropdown = (className, label, hrefs) => {
 const links = hrefs.map((href) => navLinks.querySelector(`a[href="${href}"]`)).filter(Boolean);
 if (!links.length || links[0].closest(".nav-dropdown")) return;
 const dropdown = document.createElement("div");
 dropdown.className = `nav-dropdown ${className}`;
 const button = document.createElement("button");
 button.className = "nav-dropbtn";
 button.type = "button";
 button.setAttribute("aria-expanded", "false");
 button.innerHTML = `<span>${label}</span><span aria-hidden="true">v</span>`;
 const menu = document.createElement("div");
 menu.className = "nav-menu";
 links[0].insertAdjacentElement("beforebegin", dropdown);
 dropdown.append(button, menu);
 links.forEach((link) => {
 link.classList.add("nav-menu-link");
 menu.appendChild(link);
 });
 if (hrefs.some((href) => location.pathname.endsWith(href))) {
 button.classList.add("active");
 }
 button.addEventListener("click", (event) => {
 event.stopPropagation();
 const open = !dropdown.classList.contains("open");
 navLinks.querySelectorAll(".nav-dropdown.open").forEach((item) => {
 item.classList.remove("open");
 item.querySelector(".nav-dropbtn")?.setAttribute("aria-expanded", "false");
 });
 dropdown.classList.toggle("open", open);
 button.setAttribute("aria-expanded", String(open));
 });
 };

 makeDropdown("nav-market", "Market", ["market.html", "market-pulse.html"]);
 makeDropdown("nav-learn", "Learn", ["library.html", "watch.html", "more.html", "learning-room.html"]);

 document.addEventListener("click", () => {
 navLinks.querySelectorAll(".nav-dropdown.open").forEach((item) => {
 item.classList.remove("open");
 item.querySelector(".nav-dropbtn")?.setAttribute("aria-expanded", "false");
 });
 });

 const profileLink = document.createElement("a");
 profileLink.href = "profile.html";
 profileLink.className = "nav-profile";
 profileLink.setAttribute("aria-label", "Open profile");
 profileLink.innerHTML = `
 <span class="profile-avatar" aria-hidden="true"><span data-profile-initial>G</span></span>
 `;
 navLinks.appendChild(profileLink);
}

setupNavProfileLink();

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

function getChatMetadata() {
 const profile = getProfile();
 const progress = getProgress();
 return {
 sessionId: profile.sessionId,
 currentPage: location.pathname.split("/").pop() || "index.html",
 profile,
 beginnerMode: isBeginnerMode(),
 quizProgress: progress,
 openedMarketAlerts: getOpenedAlerts(),
 answerPolicy: CHAT_ANSWER_POLICY,
 trustedSourceBasis: TRUSTED_SOURCE_BASIS,
 beginnerRecommendationUniverse: BEGINNER_RECOMMENDATION_UNIVERSE,
 googleSheetsMemoryTargets: [
 "User_Profile",
 "Chat_Log",
 "Recommendation_Log",
 "Quiz_Progress",
 "Practice_Portfolio",
 "Market_Pulse_Content",
 "Market_Pulse_Open_Log",
 "Learning_Progress",
 "Testing_Evidence"
 ]
 };
}

function chatContextPrompt(question = "") {
 const profile = getProfile();
 const mode = isBeginnerMode() ? "Use plain beginner English, define jargon, and give a direct answer first." : "Use clear, concise investing language.";
 return [
 question,
 "",
 "MoneyMentor user context:",
 `- Session ID: ${profile.sessionId}`,
 `- Name: ${profile.nickname || "Guest"}`,
 `- Level: ${profile.beginnerLevel || "Noob"}`,
 `- Budget: ${profile.budget || "S$500"}`,
 `- Risk comfort: ${profile.riskComfort || "Low"}`,
 `- Time horizon: ${profile.timeHorizon || "6 months"}`,
 `- Goal: ${profile.goal || "Safety first"}`,
 `- Beginner mode: ${isBeginnerMode() ? "on" : "off"}`,
 "- Answer policy: direct answer first, then reasons, risks, sources, and disclaimer.",
 "- Recommendation policy: give ranked research suggestions when asked; do not respond with vague homework only.",
 "- Source policy: cite trusted source names and live-data timestamp when available.",
 mode,
 "Always be educational, Singapore-aware, specific, and transparent about risk."
 ].join("\n").trim();
}

function showChatFallback(message = "MoneyMentor chat is still loading. Your question has been copied so you can paste it when the chat opens.") {
 if (findChatInput() || document.querySelector(".chat-window-toggle, [class*='chat-window-toggle'], .n8n-chat, [class*='chat-window']")) return;
 let box = document.getElementById("chatFallback");
 if (!box) {
 box = document.createElement("div");
 box.id = "chatFallback";
 box.className = "chat-fallback";
 box.innerHTML = `
 <strong>Chat not ready yet</strong><p></p><button class="btn btn-primary" type="button">Got it</button>
 `;
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
 ".n8n-chat input:not([type='search'])",
 "[class*='chat'] textarea",
 "[class*='chat'] input:not([type='search'])"
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
 return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{"best":0,"attempts":0}');
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
 div.innerHTML = `<strong>${i + 1}. ${item.level} ${item.type}</strong><br>${item.q}<br><span>${answer.correct ? "Correct" : `Your answer: ${item.options[answer.selected] || "No answer"} - Correct: ${item.options[item.answer]}`}</span><p>${item.why}</p>`;
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
 <h4>${alert.title}</h4><p><strong>What happened:</strong> ${alert.happened}</p><p><strong>Beginner translation:</strong> ${alert.beginner}</p><p><strong>Affected:</strong></p><ul>${alert.affected.map((item) => `<li>${item}</li>`).join("")}</ul><div class="source-link"><a class="btn btn-primary" href="${alert.sourceUrl}" target="_blank" rel="noopener">Open trusted source</a></div>
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
 <button class="pulse-item ${opened.includes(alert.id) ? "opened" : ""} ${alert.id === activeId ? "active" : ""}" type="button" data-alert-id="${alert.id}"><span data-alert-status>${opened.includes(alert.id) ? "Opened" : "New"}</span><strong>${alert.title}</strong><small>${alert.short}</small></button>
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
 <article class="pulse-card reveal in"><span class="meta">${alert.label}</span><h3>${alert.title}</h3><p><strong>What happened:</strong> ${alert.short}</p><p><strong>Beginner lesson:</strong> ${alert.beginner}</p><div class="pill-row">${alert.affected.map((item) => `<span class="pulse-chip">Affected: ${item}</span>`).join("")}</div><div class="pulse-actions"><button class="btn btn-primary" type="button" data-pulse-open="${alert.id}">Open details</button><a class="btn btn-ghost" href="${alert.sourceUrl}" target="_blank" rel="noopener">${alert.sourceName}</a></div></article>
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
 Market Pulse <span class="pulse-badge" data-pulse-count>0</span></button><div class="pulse-toast" id="pulseToast" role="status"><strong>Market Pulse alerts are ready</strong><p><span data-pulse-unread>0</span> unread beginner-friendly market notifications.</p><div class="toast-actions"><button class="btn btn-primary" type="button" id="toastOpenPulse">Open Pulse</button><button class="btn btn-ghost" type="button" id="toastDismissPulse">Dismiss</button></div></div><div class="pulse-backdrop" id="pulseBackdrop"></div><aside class="pulse-sidebar" id="pulseSidebar" aria-hidden="true" aria-label="MoneyMentor sidebar"><div class="pulse-side-head"><div><span class="eyebrow">Dashboard</span><h2>Account, settings, and Market Pulse.</h2></div><button class="icon-btn" id="pulseClose" type="button" aria-label="Close sidebar">x</button></div><div class="pulse-side-body"><section class="side-section"><h3>Account</h3><div class="account-mini"><div class="mini-stat"><b id="sideProfileName">Guest</b><span>Current profile</span></div><div class="mini-stat"><b id="sideSessionId">Not created</b><span>Session ID</span></div><div class="mini-stat"><b id="sideBeginnerLevel">Noob</b><span>Beginner level</span></div><div class="mini-stat"><b id="sideBudget">S$500</b><span>Budget</span></div><div class="mini-stat"><b id="sideRiskComfort">Low</b><span>Risk comfort</span></div><div class="mini-stat"><b id="sideGoal">Safety first</b><span>Main goal</span></div><div class="mini-stat"><b id="sideQuizLevel">Noob</b><span>Quiz level</span></div><div class="mini-stat"><b id="sideBestScore">0%</b><span>Best quiz score</span></div><div class="mini-stat"><b data-beginner-mode-status>On</b><span>Beginner mode</span></div><div class="mini-stat"><b><span data-pulse-opened>0</span>/<span data-pulse-total>0</span></b><span>Alerts opened</span></div></div><div class="hero-cta" style="margin-top:14px"><a class="btn btn-ghost" href="profile.html">Manage profile</a></div></section><section class="side-section"><h3>Settings</h3><div class="setting-row"><div><strong>Beginner mode</strong><p>Keep explanations simple and direct.</p></div><label class="switch"><input id="beginnerModeToggle" type="checkbox" checked><span class="slider"></span></label></div><div class="setting-row"><div><strong>Market pop-ups</strong><p>Show a small alert when unread notifications exist.</p></div><label class="switch"><input id="pulsePopupToggle" type="checkbox"><span class="slider"></span></label></div><div class="hero-cta" style="margin-top:12px"><button class="btn btn-ghost" id="resetPulseOpened" type="button">Reset opened alerts</button></div></section><section class="side-section"><div class="pulse-summary"><strong>Market Pulse</strong><span>Opened <span data-pulse-opened>0</span> / <span data-pulse-total>0</span></span></div><div class="pulse-list" id="pulseList"></div><div class="pulse-detail" id="pulseDetail"></div></section></div></aside>
 `;
 document.body.append(...shell.childNodes);

 const popupToggle = document.getElementById("pulsePopupToggle");
 if (popupToggle) {
 popupToggle.checked = localStorage.getItem(PULSE_POPUPS_KEY) === "on";
 popupToggle.addEventListener("change", () => {
 localStorage.setItem(PULSE_POPUPS_KEY, popupToggle.checked ? "on" : "off");
 });
 }

 const beginnerToggle = document.getElementById("beginnerModeToggle");
 if (beginnerToggle) {
 beginnerToggle.checked = isBeginnerMode();
 beginnerToggle.addEventListener("change", () => setBeginnerMode(beginnerToggle.checked));
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
 applyBeginnerMode();
}

function maybeShowPulseToast(force = false) {
 const toast = document.getElementById("pulseToast");
 if (!toast) return;
 if (localStorage.getItem(PULSE_POPUPS_KEY) !== "on" && !force) return;
 if (sessionStorage.getItem("mm_pulse_toast_dismissed") === "yes" && !force) return;
 if (unreadAlertCount() <= 0 && !force) return;
 setTimeout(() => toast.classList.add("show"), force ? 0 : 900);
}

renderPulsePage();
injectPulseSidebar();
maybeShowPulseToast();
updateProgress();
applyBeginnerMode();

const PRACTICE_ASSETS = [
 { symbol: "SSB", name: "Singapore Savings Bonds", type: "Government-backed", price: 500, change: 0.00, risk: "Very low", lesson: "Best for capital safety practice. Real SSBs are applied for through banks, not traded like stocks." },
 { symbol: "ES3", name: "STI ETF", type: "Singapore ETF", price: 3.62, change: 0.22, risk: "Moderate", lesson: "A broad local-market practice pick. It teaches diversification better than one stock." },
 { symbol: "D05", name: "DBS Group", type: "Blue-chip stock", price: 44.80, change: 0.65, risk: "Medium", lesson: "Bank stocks can be understandable, but rates, loans, earnings, and valuation still matter." },
 { symbol: "O39", name: "OCBC", type: "Blue-chip stock", price: 16.10, change: -0.18, risk: "Medium", lesson: "Use it to learn bank-stock movement without putting all real money into one company." },
 { symbol: "U11", name: "UOB", type: "Blue-chip stock", price: 32.40, change: 0.31, risk: "Medium", lesson: "A single bank stock is less diversified than an ETF, even if the company is strong." },
 { symbol: "Z74", name: "Singtel", type: "Defensive stock", price: 3.05, change: 0.08, risk: "Medium", lesson: "Defensive does not mean guaranteed. Growth, competition, and dividends still need checking." },
 { symbol: "M44U", name: "Mapletree Logistics Trust", type: "REIT", price: 1.48, change: -0.27, risk: "Medium", lesson: "REIT practice helps beginners understand income, debt, interest rates, and property demand." },
 { symbol: "A35", name: "ABF Singapore Bond ETF", type: "Bond ETF", price: 1.12, change: 0.03, risk: "Low", lesson: "Bond ETFs are usually calmer than stocks, but prices can still move with interest rates." }
];

function money(value) {
 return `S$${Number(value || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function defaultPracticeState() {
 return {
 cash: 10000,
 holdings: {},
 orders: [],
 alerts: [],
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString()
 };
}

function getPracticeState() {
 try {
 const stored = JSON.parse(localStorage.getItem(PRACTICE_KEY) || "null");
 if (stored && typeof stored.cash === "number" && stored.holdings && Array.isArray(stored.orders)) {
 return { ...defaultPracticeState(), ...stored };
 }
 } catch {}
 const state = defaultPracticeState();
 localStorage.setItem(PRACTICE_KEY, JSON.stringify(state));
 return state;
}

function savePracticeState(state) {
 const next = { ...state, updatedAt: new Date().toISOString() };
 localStorage.setItem(PRACTICE_KEY, JSON.stringify(next));
 return next;
}

function assetBySymbol(symbol) {
 return PRACTICE_ASSETS.find((asset) => asset.symbol === symbol) || PRACTICE_ASSETS[0];
}

function practiceTotals(state = getPracticeState()) {
 const holdingsValue = Object.entries(state.holdings).reduce((sum, [symbol, holding]) => sum + ((holding.qty || 0) * assetBySymbol(symbol).price), 0);
 const cost = Object.values(state.holdings).reduce((sum, holding) => sum + ((holding.qty || 0) * (holding.avg || 0)), 0);
 return {
 cash: state.cash,
 holdingsValue,
 equity: state.cash + holdingsValue,
 unrealized: holdingsValue - cost,
 orders: state.orders.length,
 alerts: state.alerts.length
 };
}

function renderPracticeLab(message = "") {
 const shell = document.getElementById("practiceLab");
 if (!shell) return;
 const state = getPracticeState();
 const totals = practiceTotals(state);
 const symbolSelect = document.getElementById("practiceSymbol");
 const alertSymbol = document.getElementById("alertSymbol");
 if (symbolSelect && !symbolSelect.dataset.ready) {
 symbolSelect.innerHTML = PRACTICE_ASSETS.map((asset) => `<option value="${asset.symbol}">${asset.symbol} - ${asset.name}</option>`).join("");
 symbolSelect.dataset.ready = "yes";
 }
 if (alertSymbol && !alertSymbol.dataset.ready) {
 alertSymbol.innerHTML = PRACTICE_ASSETS.map((asset) => `<option value="${asset.symbol}">${asset.symbol} - ${asset.name}</option>`).join("");
 alertSymbol.dataset.ready = "yes";
 }

 const account = document.getElementById("practiceAccount");
 if (account) {
 account.innerHTML = `
 <div class="mini-stat"><b>${money(totals.equity)}</b><span>Practice equity</span></div><div class="mini-stat"><b>${money(totals.cash)}</b><span>Virtual cash</span></div><div class="mini-stat"><b>${money(totals.holdingsValue)}</b><span>Holdings value</span></div><div class="mini-stat"><b class="${totals.unrealized < 0 ? "loss" : "gain"}">${money(totals.unrealized)}</b><span>Unrealized P/L</span></div><div class="mini-stat"><b>${totals.orders}</b><span>Order records</span></div><div class="mini-stat"><b>${totals.alerts}</b><span>Practice alerts</span></div>
 `;
 }

 const watch = document.getElementById("practiceWatchlist");
 if (watch) {
 watch.innerHTML = PRACTICE_ASSETS.map((asset) => `
 <tr><td><strong>${asset.symbol}</strong><span>${asset.name}</span></td><td>${asset.type}</td><td>${money(asset.price)}</td><td class="${asset.change < 0 ? "loss" : "gain"}">${asset.change > 0 ? "+" : ""}${asset.change.toFixed(2)}%</td><td>${asset.risk}</td><td><button class="mini-btn" type="button" data-practice-pick="${asset.symbol}">Use</button></td></tr>
 `).join("");
 watch.querySelectorAll("[data-practice-pick]").forEach((button) => {
 button.addEventListener("click", () => {
 if (symbolSelect) symbolSelect.value = button.dataset.practicePick;
 renderPracticeLab();
 document.getElementById("orderTicket")?.scrollIntoView({ behavior: "smooth", block: "start" });
 });
 });
 }

 const holdings = document.getElementById("practiceHoldings");
 if (holdings) {
 const rows = Object.entries(state.holdings).filter(([, holding]) => holding.qty > 0);
 holdings.innerHTML = rows.length ? rows.map(([symbol, holding]) => {
 const asset = assetBySymbol(symbol);
 const value = holding.qty * asset.price;
 const pl = value - holding.qty * holding.avg;
 return `
 <tr><td><strong>${symbol}</strong><span>${asset.name}</span></td><td>${holding.qty}</td><td>${money(holding.avg)}</td><td>${money(asset.price)}</td><td>${money(value)}</td><td class="${pl < 0 ? "loss" : "gain"}">${money(pl)}</td></tr>
 `;
 }).join("") : `<tr><td colspan="6">No practice holdings yet. Place a simulated buy order to start.</td></tr>`;
 }

 const orders = document.getElementById("practiceOrders");
 if (orders) {
 orders.innerHTML = state.orders.length ? state.orders.slice(0, 12).map((order) => `
 <tr><td>${new Date(order.time).toLocaleString("en-SG", { dateStyle: "short", timeStyle: "short" })}</td><td><strong>${order.side}</strong> ${order.symbol}</td><td>${order.type}</td><td>${order.qty}</td><td>${money(order.price)}</td><td><span class="status ${order.status.toLowerCase()}">${order.status}</span></td></tr>
 `).join("") : `<tr><td colspan="6">No records yet. Every simulated order appears here.</td></tr>`;
 }

 const alerts = document.getElementById("practiceAlerts");
 if (alerts) {
 alerts.innerHTML = state.alerts.length ? state.alerts.map((alert, index) => `
 <li><strong>${alert.symbol}</strong> ${alert.direction} ${money(alert.target)}
 <span class="status ${alert.status.toLowerCase()}">${alert.status}</span><button class="mini-btn" type="button" data-remove-alert="${index}">Remove</button></li>
 `).join("") : "<li>No practice alerts yet.</li>";
 alerts.querySelectorAll("[data-remove-alert]").forEach((button) => {
 button.addEventListener("click", () => {
 const next = getPracticeState();
 next.alerts.splice(Number(button.dataset.removeAlert), 1);
 savePracticeState(next);
 renderPracticeLab("Practice alert removed.");
 });
 });
 }

 const lesson = document.getElementById("practiceLesson");
 if (lesson) {
 const chosen = assetBySymbol(symbolSelect?.value || PRACTICE_ASSETS[0].symbol);
 lesson.innerHTML = `<strong>Beginner lesson:</strong> ${message || chosen.lesson}`;
 }
}

function orderWouldFill(asset, side, type, trigger) {
 if (type === "Market") return true;
 if (!Number.isFinite(trigger)) return false;
 if (type === "Limit") return side === "Buy" ? trigger >= asset.price : trigger <= asset.price;
 if (type === "Stop") return side === "Buy" ? asset.price >= trigger : asset.price <= trigger;
 return true;
}

function submitPracticeOrder() {
 const symbol = document.getElementById("practiceSymbol")?.value || PRACTICE_ASSETS[0].symbol;
 const side = document.getElementById("practiceSide")?.value || "Buy";
 const type = document.getElementById("practiceOrderType")?.value || "Market";
 const qty = Math.max(0, Math.floor(Number(document.getElementById("practiceQty")?.value || 0)));
 const trigger = Number(type === "Stop" ? document.getElementById("practiceStop")?.value : document.getElementById("practiceLimit")?.value);
 const asset = assetBySymbol(symbol);
 const state = getPracticeState();
 let status = "Filled";
 let message = asset.lesson;

 if (!qty) {
 renderPracticeLab("Enter a whole-number quantity before placing a practice order.");
 return;
 }

 if (type !== "Market" && (!Number.isFinite(trigger) || trigger <= 0)) {
 renderPracticeLab(`Enter a valid ${type.toLowerCase()} trigger price before placing this practice order.`);
 return;
 }

 if (!orderWouldFill(asset, side, type, trigger)) {
 status = "Pending";
 message = `${type} order saved as pending because the simulated price is ${money(asset.price)}.`;
 } else if (side === "Buy") {
 const cost = qty * asset.price;
 if (state.cash < cost) {
 status = "Rejected";
 message = `Rejected: this practice account only has ${money(state.cash)} virtual cash.`;
 } else {
 const current = state.holdings[symbol] || { qty: 0, avg: 0 };
 const nextQty = current.qty + qty;
 state.holdings[symbol] = {
 qty: nextQty,
 avg: ((current.qty * current.avg) + cost) / nextQty
 };
 state.cash -= cost;
 message = `Filled: you used ${money(cost)} of virtual cash. ${asset.lesson}`;
 }
 } else {
 const current = state.holdings[symbol] || { qty: 0, avg: 0 };
 if (current.qty < qty) {
 status = "Rejected";
 message = `Rejected: you only hold ${current.qty || 0} simulated units of ${symbol}.`;
 } else {
 current.qty -= qty;
 state.cash += qty * asset.price;
 if (current.qty <= 0) delete state.holdings[symbol];
 else state.holdings[symbol] = current;
 message = "Filled: sale proceeds were added to virtual cash. Review whether the trade matched your goal.";
 }
 }

 state.orders.unshift({ time: new Date().toISOString(), symbol, side, type, qty, price: asset.price, status });
 savePracticeState(state);
 renderPracticeLab(message);
}

function addPracticeAlert() {
 const symbol = document.getElementById("alertSymbol")?.value || PRACTICE_ASSETS[0].symbol;
 const direction = document.getElementById("alertDirection")?.value || "above";
 const target = Number(document.getElementById("alertTarget")?.value || 0);
 if (!target) {
 renderPracticeLab("Enter a target price for the practice alert.");
 return;
 }
 const asset = assetBySymbol(symbol);
 const triggered = direction === "above" ? asset.price >= target : asset.price <= target;
 const state = getPracticeState();
 state.alerts.unshift({ symbol, direction, target, status: triggered ? "Triggered" : "Watching", createdAt: new Date().toISOString() });
 savePracticeState(state);
 renderPracticeLab(triggered ? "Practice alert triggered immediately based on the simulated price." : "Practice alert saved. It teaches the idea of price-trigger notifications.");
}

function resetPracticeLab() {
 localStorage.setItem(PRACTICE_KEY, JSON.stringify(defaultPracticeState()));
 renderPracticeLab("Practice account reset to S$10,000 virtual cash.");
}

function exportPracticeOrders() {
 const state = getPracticeState();
 const rows = [["time", "symbol", "side", "type", "qty", "price", "status"], ...state.orders.map((order) => [order.time, order.symbol, order.side, order.type, order.qty, order.price, order.status])];
 const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
 const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
 const link = document.createElement("a");
 const url = URL.createObjectURL(blob);
 link.href = url;
 link.download = "moneymentor-practice-orders.csv";
 link.click();
 setTimeout(() => URL.revokeObjectURL(url), 250);
}

if (document.getElementById("practiceLab")) {
 renderPracticeLab();
 document.getElementById("practiceSymbol")?.addEventListener("change", () => renderPracticeLab());
 document.getElementById("placePracticeOrder")?.addEventListener("click", submitPracticeOrder);
 document.getElementById("addPracticeAlert")?.addEventListener("click", addPracticeAlert);
 document.getElementById("resetPracticeLab")?.addEventListener("click", resetPracticeLab);
 document.getElementById("exportPracticeOrders")?.addEventListener("click", exportPracticeOrders);
 document.getElementById("askPracticeCoach")?.addEventListener("click", () => {
 const totals = practiceTotals();
 openChatWithQuestion(`Review my MoneyMentor Practice Lab account. Equity: ${money(totals.equity)}, cash: ${money(totals.cash)}, holdings value: ${money(totals.holdingsValue)}, unrealized P/L: ${money(totals.unrealized)}. Explain what I should learn, not what I must trade.`);
 });
}

import("https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js")
 .then(({ createChat }) => {
 createChat({
 webhookUrl: "https://n8ngc.codeblazar.org/webhook/6b73ce01-53e9-4041-83e0-56e91e41b0ea/chat",
 mode: "window",
 showWelcomeScreen: false,
 sessionId: getProfile().sessionId,
 metadata: getChatMetadata(),
 initialMessages: [
 "Hi! I'm MoneyMentor ",
 "Ask me to explain investing terms, compare beginner options, or build a ranked research shortlist.",
 "I use your saved beginner profile context and should answer directly with reasons, risks, and source basis."
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
 })
 .catch(() => {
 console.warn("Chat widget could not load.");
 showChatFallback("MoneyMentor chat could not load. Check the n8n webhook or CDN connection, then refresh this page.");
 });
