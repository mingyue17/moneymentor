# MoneyMentor - Definitive Build: what changed and why

This build starts from the AI-platform version and folds in every correction from
the strict audit, restores every feature from the original build, and removes the
one-time "guided journey" - without changing MoneyMentor's purpose, usefulness, or
originality.

## 1. Guided journey removed (fixed the "one-time usable" problem)
- The 7-step "Your guided path" tracker is gone from the homepage AND the Learn tab.
- The per-lesson pass-to-proceed checkpoints are gone.
- Replaced on the homepage by a "What do you want to do today?" ACTION HUB - eight
  always-available tools that never "complete", so the site is useful every visit.
- Learn is now an OPEN LIBRARY (browse any topic in any order), with optional,
  repeatable self-tests on each lesson (retry forever, no gating, no progress lock).

## 2. Every original-build feature restored (nothing missed)
- Floating Market Pulse system: the pulse button + slide-in sidebar + one-time toast,
  reachable on every page (was deleted in the AI-platform version).
- Standalone Market Pulse page rebuilt as a real "market school" page (was a redirect).
- Homepage capability showcase (feat-strip) advertising all 9 capabilities.
- Floating in-page AI chat widget restored (the AI-platform version had wrongly
  replaced it with a redirect). The full-page chat.html AI workspace is ALSO kept,
  linked as "Ask AI" in the nav - both coexist.
- All pages reachable again (footer + Learn library link every page).

## 3. Decision Wizard upgraded to a serious 10-question investor profiler
- Research-backed: risk NEED (goal) + risk CAPACITY (horizon, emergency fund, income
  stability, % of savings, affordable loss) + risk TOLERANCE (drop reaction, volatility
  preference, loss-vs-FOMO) + KNOWLEDGE. Frameworks: CFA Institute, Grable-Lytton,
  Vanguard, Merrill, MoneySense.
- Capacity vs willingness scored separately; the LOWER governs (standard practice).
- MoneySense hard gates: no emergency fund / <1yr horizon / can't-afford-to-lose /
  safety goal => forces the capital-protection route and refuses higher-risk lanes.
- One shared engine personalises every suggesting surface: Where-to-invest lane
  highlight, Smart Picks allocation, AI chat context, and the profile page.

## 4. Practice Lab -> a real game (Market Run), all requirements met
- Looks/feels like a game: setup "new game" screen, HUD (portfolio, cash, month,
  score, difficulty badge, live risk meter), colour-coded event cards, a coach
  character, tap-to-trade with a slider modal, per-asset sparklines, star-rating
  report reveal, badge unlocks.
- 9 realistic assets with correct sector behaviour (rates up help banks, hurt REITs;
  bonds cushion crashes; growth + MoonCoin swing hardest).
- 5 selectable difficulty levels (Intern -> Shark) scaling volatility, fees, event
  brutality, and black-swan chance.
- Selectable run length (6/12/24/36 months) and an editable starting cash (default
  S$1,000).
- Personal best per difficulty level (shown with its settings).
- Keeps the exact teaching purpose: hype/scams lose money, diversification beats single
  bets, holding usually beats over-trading, fees bite, short-term is noisy; benchmarked
  vs held-STI-ETF and vs bank/SSB.
- Fictional scam event clearly labelled; "why did you trade" reflections saved; visible
  trade history; CSV run evidence; "ask AI to review my run" hook. Virtual money only.

## 5. Market page -> a beginner "market school" (fixed thin + static-as-live)
- Live STI chart kept, now wrapped in a "how to read this chart" explainer.
- "What's inside the STI?" constituents (teaches diversification concretely).
- Compound / dollar-cost-averaging calculator (illustrative, not a promise).
- "Is now a good time?" (teaches DCA over timing) + market-mood explainer.
- Personal Watchlist (local; the AI reads it via "explain my watchlist").
- Alerts EXPANDED into 12 market-school explainers, each clearly labelled a teaching
  example (not live news) and linked to the real MAS/MoneySense/SGX source.

## 6. Audit defects addressed
- No "Original / future / later / planned" wording anywhere.
- Every page has a proper H1.
- Smart Picks is dynamic (wizard/profile-driven).
- Quiz keeps topic diagnosis + remediation + weak-topic AI teaching.
- Market Pulse clearly labelled sample/teaching, with real sources.
- Chatbot answers surface sources; full profile/wizard/watchlist metadata is sent to n8n.
- Evidence exports (quiz, run, learning) produce real CSV records with results.
- Brand story sharpened around "make your first safe investing decision in Singapore".

## Purpose preserved
Still a beginner-first, Singapore-specific financial education product that takes a
young Singaporean from "what is an ETF?" to a sensible, scam-aware first decision -
now more useful, more repeatable, and A+-aligned.

## Not part of these static files (your n8n side)
Live n8n -> Google Sheets logging, RAG citations from the source knowledge base, and
the real 12-20 row testing-evidence workbook must be completed in your n8n workflow.
The website now sends everything n8n needs (chat metadata incl. wizard + watchlist,
run/quiz/evidence exports).
