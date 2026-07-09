# MoneyMentor Product Structure

## Locked Product Promise

MoneyMentor is a beginner investing assistant for young Singaporeans. It explains investing concepts, gives sensible beginner recommendations, teaches through quizzes, translates market news into plain English, lets users practise with a safe virtual investing lab, and remembers user progress through a lightweight learning profile.

## Target Audience

- Young Singaporean adults
- Beginner investors
- Users who feel blocked by jargon, fear of losing money, scams, and information overload

## Final Website Pages

1. `index.html` - Home and product overview
2. `where.html` - Where beginners can start investing
3. `invest.html` - Beginner investment options
4. `smart-picks.html` - Direct beginner recommendation examples
5. `practice.html` - Virtual investing Practice Lab with simulated orders, P&L, alerts, reset, and CSV records
6. `market.html` - STI market snapshot graph
7. `market-pulse.html` - Beginner-friendly market news alerts
8. `library.html` - Plain-English investing glossary
9. `watch.html` - Beginner video resources
10. `more.html` - Official guides and books
11. `learning-room.html` - Courses and 10-question quiz
12. `sources-safety.html` - Grounding sources and safety rules
13. `profile.html` - MoneyMentor learning profile onboarding

## Memory Design

- Browser `localStorage`: stores profile, session ID, quiz progress, opened Market Pulse alerts, beginner-mode preference, and Practice Lab state.
- Local data expiry: MoneyMentor-managed browser memory is refreshed on use and cleared after 180 days of inactivity.
- n8n Simple Memory: short-term chat context.
- n8n metadata/context: profile, session ID, beginner mode, quiz progress, and opened-alert context are prepared for the chat widget/workflow.
- Google Sheets, later phase: long-term evidence logs for user profile, chat history, quiz progress, recommendations, and Market Pulse events.

## Profile Data Fields

- `session_id`
- `nickname`
- `beginner_level`
- `budget`
- `risk_comfort`
- `time_horizon`
- `goal`
- `profile_mode`
- `created_at`
- `updated_at`

## Practice Lab Data Fields

- `cash`
- `holdings`
- `orders`
- `alerts`
- `created_at`
- `updated_at`

## Safety Rule

This project does not store passwords. Profile onboarding is not authentication. It is a lightweight learning profile for personalization and project logging.
