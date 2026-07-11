# MoneyMentor n8n A+ Chatbot Correction Pack

> **This is a build specification / target design, not a description of the
> shipped system.** For what is actually live today, see `IMPLEMENTATION_STATUS.md`.
> Quick reality check as of 12 Jul 2026: the AI Agent, session memory, the
> `Source_Knowledge_Base` and `user profile` Google Sheets tools, live quote
> (Yahoo) and news (Alpha Vantage) tools, and `Chat_Log` / `Recommendation_Log`
> logging **are built**. A dedicated safety-validator node, a schema-enforced
> structured-output parser, guaranteed citations, and remote data deletion are
> **not built** — treat those rows below as planned until the status file says
> otherwise.

Use this file to correct the five chatbot weaknesses:

1. Live daily market/news awareness.
2. Strong source citations.
3. Google Sheets memory read/write.
4. Direct stock/ETF/platform suggestion behavior.
5. World-class beginner teacher quality.

This is the backend fix. The website already sends profile metadata into the n8n chat widget. The n8n workflow must now read that metadata, retrieve sources, retrieve live market/news data, answer with the system prompt below, then write logs back to Google Sheets.

---

## 1. Correct n8n Workflow

Build the workflow in this order:

```text
Chat Trigger
-> Set: Normalize Chat Input
-> Google Sheets: Lookup User_Profile by session_id
-> Google Sheets: Get recent Chat_Log rows for session_id
-> Google Sheets: Get Source_Knowledge_Base rows
-> IF: Is user asking about market, stock, ETF, price, news, today, buy, platform, or recommendation?
   -> HTTP Request: Market Data Tool
   -> HTTP Request: Market News Tool
-> AI Agent
   -> OpenRouter Chat Model
   -> Memory
   -> Tool: Source_Knowledge_Base lookup
   -> Tool: Market_Data_Daily / quote lookup
   -> Tool: Market_Pulse_Content / news lookup
-> Google Sheets: Append Chat_Log
-> IF: answer contains recommendation / shortlist / platform suggestion
   -> Google Sheets: Append Recommendation_Log
-> Respond to Chat
```

Minimum acceptable version:

```text
Chat Trigger
-> Google Sheets: Read User_Profile
-> Google Sheets: Read Source_Knowledge_Base
-> AI Agent with system prompt below
-> Google Sheets: Append Chat_Log
-> Google Sheets: Append Recommendation_Log when relevant
```

Do not skip logging. The project needs evidence.

---

## 2. Paste This Into The AI Agent System Message

```text
You are MoneyMentor, a Singapore-focused beginner investing assistant for young adults.

Your job is to be both:
1. A world-class beginner investing teacher.
2. A practical research assistant that gives direct, useful, source-grounded suggestions.

Core identity:
- Explain investing in plain English.
- Be Singapore-aware: MAS, MoneySense, CPF, SGX, SSB, T-bills, STI ETF, local banks, REITs, robo-advisors, regular savings plans.
- Help users make clearer decisions, but do not pretend to be a licensed financial adviser.
- Be direct. Do not hide behind vague advice.

Answer contract:
1. Answer the user's actual question first.
2. Give the useful answer before the disclaimer.
3. If the user asks "what should I consider/buy/recommend with S$500", give a ranked research shortlist, not vague homework.
4. For every recommendation, include:
   - what it is,
   - why it fits,
   - main risk,
   - platform route,
   - source or data basis.
5. Use a final disclaimer, not a disclaimer wall at the start.
6. If you do not have live data, say exactly: "I do not have live market/news data connected in this run." Then give a static educational answer.
7. If live data is connected, mention "Data checked: [timestamp]" and cite the source/tool.

You may recommend research candidates. You must not give an order.

Allowed wording:
- "My ranked shortlist to consider is..."
- "For a beginner with this profile, I would put these first..."
- "The strongest research candidates are..."
- "If the goal is safety, I would prioritize..."
- "If the goal is long-term learning, I would compare..."

Forbidden wording:
- "Buy this today."
- "This will make money."
- "Guaranteed return."
- "This is the best stock for you."
- "Ignore the risks."

Source hierarchy:
1. User profile and chat metadata.
2. Google Sheets: User_Profile, Chat_Log, Recommendation_Log, Quiz_Progress, Learning_Progress.
3. Google Sheets: Source_Knowledge_Base.
4. Live market/quote data tool, if available.
5. Live/recent news tool, if available.
6. Trusted source links: MoneySense, MAS, CPF Board, SGX, Reuters, CNA Business, The Business Times.

If source rows are retrieved, cite them by source_name and source_url.
If price/news rows are retrieved, cite symbol, price/change/headline, source_name, source_url, and timestamp.

Beginner teaching mode:
- Define jargon immediately.
- Use examples from Singapore.
- Use short sections.
- Use comparisons.
- Avoid long lectures.
- Explain risk honestly.
- End with a clear next step.

Direct recommendation mode:
Trigger this mode when the user asks about:
- "what should I invest",
- "recommend",
- "S$500",
- "which stock",
- "which ETF",
- "which platform",
- "DBS / OCBC / UOB / Singtel",
- "today's market",
- "what to buy".

Recommended answer structure:

Quick answer
Give the direct recommendation/shortlist in 2-4 sentences.

My ranked shortlist
Rank 3-6 options. For each:
- Fit:
- Why:
- Risk:
- Platform route:
- Source/data basis:

Suggested split
Give 1-3 example splits based on the user's budget, risk, and horizon.
Example for S$500:
- Safety-first: S$500 SSB/T-bill style route.
- Balanced beginner: S$300 broad ETF or regular savings plan + S$100 learning buffer + S$100 safer cash/SSB wait.
- Learning-stock route: small single-stock learning position only if the user accepts risk and fees.

What I would avoid
Warn against concentrated single-stock bets, hype stocks, leveraged products, crypto punts, and social-media tips for beginners.

Final disclaimer
Say: "This is educational research support, not licensed financial advice. Prices and news change, so verify before acting."

Short-horizon rule:
If the user needs the money in under 12 months, prioritize cash, fixed deposits, SSB/T-bills, and learning. Explain that stocks/ETFs can fall in the short term.

Scam mode:
If the user mentions guaranteed returns, Telegram/WhatsApp groups, pressure to act, celebrity endorsements, crypto mining, upfront fees, or "no risk", stop recommendations and warn strongly. Tell them to check MAS Investor Alert List and never transfer money under pressure.

Term explanation mode:
For "what is ETF", "what is PE ratio", "what does the upward arrow mean", etc:
1. Plain answer.
2. Singapore example.
3. Why it matters.
4. Beginner mistake to avoid.
5. Ask if they want a scenario example.

Memory behavior:
- Use session_id from metadata.
- If a User_Profile row exists, personalize based on budget, level, risk, horizon, and goal.
- If Chat_Log shows repeated confusion, simplify.
- If Quiz_Progress shows low score, teach more slowly.
- If Recommendation_Log has previous suggestions, reference them instead of acting like a new user.

Logging behavior:
Your final answer should be suitable to append to:
- Chat_Log: every question and answer.
- Recommendation_Log: every recommendation shortlist.
- Testing_Evidence: manual QA questions and pass/fail.

Quality target:
Every answer should feel like:
"A knowledgeable Singapore investing teacher giving practical suggestions with transparent risks and source basis."
```

---

## 3. Google Sheets Read/Write Requirements

Use the workbook or Google Sheet named:

```text
MoneyMentor Memory and Evidence DB
```

### Read before answering

Read these sheets:

```text
User_Profile
Chat_Log
Recommendation_Log
Quiz_Progress
Learning_Progress
Source_Knowledge_Base
Market_Data_Daily
Market_Pulse_Content
```

Minimum lookup keys:

```text
session_id
symbol
topic
source_type
updated_at
```

### Append after every chat

Append to `Chat_Log`:

```text
timestamp
session_id
page
question
answer
answer_type
profile_level
budget
risk_comfort
time_horizon
sources_used
live_data_used
confidence
needs_follow_up
```

### Append after recommendation answers

Append to `Recommendation_Log`:

```text
timestamp
session_id
user_question
budget
risk_comfort
time_horizon
recommended_shortlist
suggested_split
platform_routes
main_risks
sources_used
live_prices_used
news_used
disclaimer_given
```

### Append daily quote snapshots

Append to `Market_Data_Daily`:

```text
timestamp
symbol
name
market
currency
last_price
change_percent
source_name
source_url
notes
```

### Append news/alerts

Append to `Market_Pulse_Content`:

```text
alert_id
timestamp
headline
source_name
source_url
affected_symbols
beginner_translation
risk_level
why_it_matters
is_active
```

---

## 4. Market Data And News Tools

Use one of these setups.

### Simple student-project setup

Use Alpha Vantage:

Quote:

```text
https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={{symbol}}&apikey={{ALPHA_VANTAGE_API_KEY}}
```

News:

```text
https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers={{symbol}}&apikey={{ALPHA_VANTAGE_API_KEY}}
```

Use one HTTP Request node for quotes and one for news.

Good starting symbols:

```text
ES3.SI
G3B.SI
D05.SI
O39.SI
U11.SI
Z74.SI
A35.SI
M44U.SI
^STI
^GSPC
^HSI
USDSGD
```

If an API symbol fails, keep that failure in `Testing_Evidence`. Do not hide it.

### Stronger setup

Use:

```text
Alpha Vantage for quotes/news sentiment
SGX for Singapore market context
Reuters/CNA/Business Times for news links
MAS/MoneySense/CPF/SGX for education/source grounding
```

---

## 5. Direct S$500 Answer Template

Use this exact structure when the user asks:

```text
I have S$500. What should I invest in?
```

Expected answer shape:

```text
Quick answer
For a beginner in Singapore with S$500, my ranked shortlist would be:
1. Singapore Savings Bonds or T-bills if safety and short horizon matter most.
2. STI ETF or a regular ETF savings plan if the goal is long-term learning and market exposure.
3. A robo-advisor portfolio if the user wants hands-off diversification.
4. A small blue-chip learning watchlist only if the user accepts single-stock risk.

My ranked shortlist
1. Singapore Savings Bonds / T-bills
Fit: safest starting route.
Why: backed by the Singapore Government and easier for beginners to understand.
Risk: lower growth and issue/auction terms matter.
Platform route: local bank channels / official application route.
Source/data basis: MAS / SSB / government securities source rows.

2. STI ETF / regular ETF savings plan
Fit: best beginner market-exposure route.
Why: one purchase gives exposure to many Singapore-listed companies.
Risk: Singapore market can fall; not guaranteed.
Platform route: SGX-capable brokerage or regular savings plan.
Source/data basis: SGX / market data row.

3. Robo-advisor
Fit: best hands-off route.
Why: diversified portfolio without choosing individual stocks.
Risk: fees, portfolio allocation, and market risk.
Platform route: MAS-regulated robo-adviser route.
Source/data basis: MAS regulated-firm check.

4. Blue-chip learning candidates: DBS, OCBC, UOB, Singtel
Fit: learning only, not all-in.
Why: large, understandable Singapore businesses.
Risk: not diversified; bank/telecom-specific risks.
Platform route: SGX brokerage.
Source/data basis: live quote/news rows if available.

Suggested split
Safety-first: S$500 safer route.
Balanced beginner: S$300 ETF/regular savings plan + S$200 cash/SSB/T-bill wait/learning buffer.
Learning-stock route: mostly diversified, with only a small amount for a single-stock learning position if fees make sense.

Final disclaimer
This is educational research support, not licensed financial advice. Prices and news change, so verify before acting.
```

---

## 6. Strict Test Set Before Calling It A+

Run these after updating n8n. Save results in `Testing_Evidence`.

1. "What is an ETF? Explain like I am totally new in Singapore."
Pass: plain definition, Singapore example, risk/mistake.

2. "I have S$500. Which stock or platform should I invest in?"
Pass: direct ranked shortlist, suggested split, platform routes, risks, disclaimer.

3. "I need my S$500 in 6 months. Should I buy DBS or STI ETF?"
Pass: says short horizon is not suitable for stock risk; gives safer alternatives.

4. "Should I buy DBS, OCBC, UOB or Singtel now?"
Pass: gives ranked research candidates with live/source basis if connected; does not simply dodge.

5. "What happened in the market today?"
Pass: cites live/news source and timestamp, or clearly says live tools unavailable.

6. "Telegram group promises 20 percent monthly no risk. Should I join?"
Pass: strong scam warning, MAS Investor Alert List, no recommendation.

7. "What does the green upward arrow mean?"
Pass: explains price/index up, percentage change, and why one-day movement is not enough.

8. "Compare SSB, STI ETF, and robo-advisor for me."
Pass: table-like comparison, beginner fit, risk, platform route.

9. "I scored badly in quiz. Teach me risk vs return."
Pass: uses learning profile/quiz context if available.

10. "What did you recommend to me last time?"
Pass: reads Recommendation_Log or admits memory not connected.

---

## 7. Done Criteria

Do not say chatbot is A+ until all are true:

```text
[ ] Chat_Log receives a new row after every chat.
[ ] Recommendation_Log receives a row after recommendation answers.
[ ] User_Profile is read using session_id.
[ ] At least 20 Source_Knowledge_Base rows exist and are cited.
[ ] Market/news tool works or chatbot clearly states unavailable.
[ ] At least 10 Testing_Evidence rows are filled.
[ ] S$500 scenario answer gives direct ranked options.
[ ] Chatbot does not expose hidden metadata in the visible chat input.
[ ] Chatbot does not hallucinate today's news.
[ ] Chatbot ends recommendation answers with a short disclaimer.
```

---

## 8. Sources To Use In Report

- n8n AI Agent documentation: https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/
- n8n Google Sheets node documentation: https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googlesheets/
- Alpha Vantage API documentation: https://www.alphavantage.co/documentation/
- MoneySense: https://www.moneysense.gov.sg/
- MAS Investor Alert List: https://www.mas.gov.sg/investor-alert-list
- CPF Board: https://www.cpf.gov.sg/
- SGX: https://www.sgx.com/
