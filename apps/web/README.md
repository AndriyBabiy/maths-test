# web

Layer 1 — Next.js 15 (App Router) UI for the diagnostic.

Pages:

- `/` landing — "Start the assessment" CTA
- `/assessment` test-taking screen with KaTeX question rendering and A/B/C/D
- `/results` radar chart + outcome-tagged report

The `/api/assessment` route is served by an in-process LangGraph agent
(`app/api/assessment/_agent/`) that runs the Rasch picker against
`@maths-diag/core` and calls OpenRouter for short learner-facing commentary.
Set `OPENROUTER_API_KEY` in `.env.local` — see `.env.local.example`.
