# MoneyMentor Product Structure

## Product Promise

MoneyMentor is an investing companion for young Singaporeans that stays useful forever, not a course you finish. It teaches through short visual lessons, a market simulator game with XP and badges, real market news with a beginner decoder, and an AI coach (Mento) that knows the user's profile.

## Information Architecture

Primary navigation: **Home / Learn / Practice / Market / Profile**, plus a persistent "Ask MoneyMentor" chat action. Mobile gets a fixed bottom navigation with the same five destinations.

| URL | Role |
|---|---|
| `index.html` | Home: Mento coach card (level, XP, streak, daily tip), Practice Lab summary, market pointer, quiz stats, scam reminder |
| `learn.html` | Learn hub: interactive compound-growth calculator, visual risk ladder (S$1,000 good-year/bad-year examples), topic cards - no fixed path |
| `where.html` | Topic: where to invest in Singapore |
| `invest.html` | Topic: what beginners can buy (minimums, horizons, fees, downsides) |
| `smart-picks.html` | Topic: building a simple portfolio (S$500 examples) |
| `sources-safety.html` | Topic: avoiding scams + trusted sources |
| `learning-room.html` | Quiz (earns XP) + free courses |
| `library.html` | Resource: plain-English glossary |
| `watch.html` | Resource: video picks |
| `more.html` | Resource: official guides and books |
| `practice.html` | Practice Lab: "Market Run" 12-month simulator - quarterly dividends, cash interest, hype pump, rug pull, rumour events, diversification meter, badges, XP, CSV export, resume |
| `market.html` | Market: live STI chart + **real live news feed** (TradingView timeline: headline, source, publish time) + 5-pattern news decoder (`#news`, `#decoder`) |
| `market-pulse.html` | Redirect to `market.html#news` (kept so old URLs work) |
| `profile.html` | Learning profile, XP/streak/quiz progress, beginner-mode setting, progress reset |

## Engagement System (no finish line)

- **XP** (`mm_xp_state`): daily visit +10, streak tracked; quiz completion + score/2; decoding a news pattern +15 (once each); playing the compound calculator +20 (once); Market Run: +5/month, +60/finished year, +10/badge; profile setup +20.
- **Levels**: 10 titles from "Total Newbie" to "Mentor Material"; XP bar on Home, summary on Profile.
- **Mento**: the robot coach. Daily rotating tip on Home, in-game commentary in Market Run, and the persona for chat prompts.

## Memory Design (localStorage)

| Key | Contents |
|---|---|
| `mm_session_id` | Stable anonymous session ID |
| `mm_learning_profile` | Nickname, level, budget, risk, horizon, goal |
| `mm_original_split_progress` | Quiz best score + attempts |
| `mm_xp_state` | XP total, streak, last visit, one-time awards |
| `mm_marketrun_state` | Practice Lab game state (resume + Home summary) |
| `mm_marketrun_best` | Best Practice Lab final value |
| `mm_market_pulse_opened` | Decoded news patterns |
| `mm_beginner_mode` | Beginner mode on/off |
| `mm_pending_question` | Question queued for the chat widget |

Managed keys expire after 180 days of inactivity.

## Integrations

- **n8n chat** (`@n8n/chat` CDN bundle) with profile/quiz/XP metadata; production webhook in `assets/app.js`.
- **n8n profile webhook**: fire-and-forget profile sync (site works fully offline from localStorage).
- **TradingView**: ticker tape (Home), advanced STI chart (Market), timeline news widget (Market - real headlines with source + timestamp).

## Safety Rules

- No passwords; the profile is a learning profile, not authentication or a financial account.
- Recommendation surfaces show who it may suit, minimums, horizon, risk, liquidity, fees, and the main downside; nothing is presented as guaranteed.
- Practice Lab repeatedly states no real money is involved; rumour and rug-pull events teach verification via SGX/MAS.
- Scam-safety messaging routes users to the MAS Investor Alert List.
