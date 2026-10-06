# PrivacyGuard AI

PrivacyGuard AI teaches practical digital privacy and cybersecurity through built-in guides, lessons, and an optional Groq-powered assistant.

## Run & Operate

- `pnpm --filter @workspace/privacyguard run dev` — start the web app
- `pnpm --filter @workspace/privacyguard run typecheck` — typecheck the web app
- `pnpm --filter @workspace/privacyguard run build` — build the web app
- Configure only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as frontend environment variables. They are public client values; database access is protected by RLS.
- Apply `artifacts/privacyguard/supabase/migrations/20261006000000_privacyguard.sql` to the Supabase project and deploy `artifacts/privacyguard/supabase/functions/privacy-assistant`.

## Architecture

- The web app is a standalone React/Vite artifact in `artifacts/privacyguard`.
- Supabase Auth handles accounts. Supabase Postgres stores conversations, messages, and learning progress with row-level security.
- The browser calls only the `privacy-assistant` Supabase Edge Function. That function authenticates the user, enforces limits, calls Groq, and persists the response.
- Groq is the only LLM provider. `GROQ_API_KEY` must be configured only in Supabase Edge Function secrets, never in Replit Variables, frontend code, `.env` files, or source control.
- Optional `GROQ_MODEL` is also an Edge Function secret. The function defaults to `llama-3.3-70b-versatile`.
- If Supabase or Groq is unavailable, the app keeps its guides, checklists, lessons, quizzes, and recommendations available; the assistant provides built-in guide-based help when possible.

## Supabase setup

1. Create a Supabase project and enable email/password sign-in.
2. Set `VITE_SUPABASE_URL` and the public anon key as Replit Variables for the web artifact. Never use the service-role key in the browser.
3. Link the Supabase CLI to the project and run `supabase db push` from `artifacts/privacyguard` to apply the migration.
4. Deploy with `supabase functions deploy privacy-assistant`.
5. In Supabase Dashboard → Edge Functions → Secrets, set `GROQ_API_KEY`. Optionally set `GROQ_MODEL` to a Groq model available to the project. Do not add the Groq key to Replit.

## Product scope

- Public privacy guides, checklists, lessons with quizzes, and practical next-step recommendations.
- Optional signed-in assistant with saved conversations, safe Markdown rendering, retry, copy, and conversation controls.
- The assistant provides defensive privacy and cybersecurity education. It must not ask users for credentials or claim it can change third-party account settings.
