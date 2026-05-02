# web

Layer 1 — Next.js 15 (App Router) UI for the diagnostic.

Pages:

- `/` landing — "Start the assessment" CTA
- `/assessment` test-taking screen with KaTeX question rendering and A/B/C/D
- `/results` radar chart + outcome-tagged report

The `/api/assessment` route proxies to the deployed Lua agent. Set
`LUA_AGENT_ID` in `.env.local` after `lua deploy`.
