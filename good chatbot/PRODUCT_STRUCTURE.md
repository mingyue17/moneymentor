# MoneyMentor Product Structure

## Product Promise

MoneyMentor is a guided investing companion for young Singaporeans. It walks beginners through a seven-step learning path, gives sensible beginner recommendations, teaches through quizzes, translates market news into plain English, lets users practise with a virtual investing simulator, and remembers progress through a lightweight learning profile.

## Information Architecture

Primary navigation: **Home / Learn / Practice / Market / Ask AI / Profile**. "Ask AI" opens a dedicated AI workspace (`chat.html`) with multiple separate conversations, like ChatGPT/Claude. Every "Ask MoneyMentor" button anywhere on the site opens that workspace and starts a fresh chat with the question. Mobile gets a fixed bottom navigation.

| URL | Role |
|---|---|
| `index.html` | Home: personalised dashboard (journey progress, next lesson, practice summary, one market update, scam reminder) |
| `learn.html` | Learn hub: 7-step path; contains lessons 1 (basics) and 2 (risk) inline; links supporting resources |
| `where.html` | Learn step 3: where to invest in Singapore |
| `invest.html` | Learn step 4: what beginners can buy (with minimums, horizons, fees, downsides) |
| `smart-picks.html` | Learn step 5: building a simple portfolio (S$500 examples) |
| `sources-safety.html` | Learn step 6: avoiding scams + trusted sources |
| `learning-room.html` | Learn step 7: 10-question quiz + free courses |
| `library.html` | Learn resource: plain-English glossary |
| `watch.html` | Learn resource: video picks |
| `more.html` | Learn resource: official guides and books |
| `practice.html` | Practice Lab: "Market Run" 12-month simulator with virtual cash, monthly events, trade-fee lessons, badges, CSV export, resume |
| `market.html` | Market: live STI chart (TradingView) + beginner-translated market updates (`#news`) |
| `market-pulse.html` | Redirect to `market.html#news` (kept so old URLs work) |
| `profile.html` | Learning profile, progress summary, beginner-mode setting, evidence export, progress reset |
| `chat.html` | AI workspace: sidebar of separate chats (each with its own n8n session memory), suggested prompts, source rendering, chat export |

## Learning Path Progress

- Every step (1–6) completes only when its one-question checkpoint is answered correctly — visiting a page is not enough.
- Step 7 completes when the 10-question quiz is finished; results include a topic diagnosis with remediation links.
- After completion the path stays useful: review steps, download a completion summary, restart the path, weekly Practice Lab runs, and AI coaching.
- Stored in `mm_lessons_done`; drives the Home journey tracker and recommended next lesson.

## Memory Design (localStorage)

| Key | Contents |
|---|---|
| `mm_session_id` | Stable anonymous session ID |
| `mm_learning_profile` | Nickname, level, budget, risk, horizon, goal |
| `mm_original_split_progress` | Quiz best score + attempts |
| `mm_lessons_done` | Completed learning-path steps |
| `mm_marketrun_state` | Practice Lab game state (supports resume + Home summary) |
| `mm_marketrun_best` | Best Practice Lab final value |
| `mm_market_pulse_opened` | Opened market updates |
| `mm_beginner_mode` | Beginner mode on/off |
| `mm_pending_question` | Question handed to the AI workspace |
| `mm_chats_v1` | AI workspace conversations (max 50) |
| `mm_quiz_history` | Quiz attempt history for evidence export |
| `mm_run_history` | Practice Lab run results for evidence export |

Managed keys expire after 180 days of inactivity.

## Integrations

- **n8n chat**: `chat.html` calls the chat webhook directly (`action: sendMessage`). Each chat thread sends its own `sessionId` (the chat ID), so separate chats have separate memory in n8n. Full profile/quiz/lesson metadata is attached to every message.
- **n8n profile webhook**: fire-and-forget profile sync (site works fully offline from localStorage).
- **TradingView**: ticker tape on Home, advanced STI chart on Market.

## Safety Rules

- No passwords; the profile is a learning profile, not authentication or a financial account.
- All recommendation surfaces show who it may suit, minimums, horizon, risk, liquidity, fees, and the main downside; nothing is presented as guaranteed.
- Scam-safety messaging routes users to the MAS Investor Alert List.
