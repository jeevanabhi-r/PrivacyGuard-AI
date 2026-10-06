# PrivacyGuard AI

PrivacyGuard AI offers public privacy guides, checklists, short lessons, quizzes, recommendations, and an optional signed-in chat assistant.

## Run locally

From the workspace root:

```sh
pnpm --filter @workspace/privacyguard run dev
pnpm --filter @workspace/privacyguard run typecheck
pnpm --filter @workspace/privacyguard run build
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the web app's environment to enable account and cloud features. `.env.example` contains only those public client values. Without them, the built-in guides and lessons remain usable.

## Supabase deployment

1. Create a Supabase project and enable email/password authentication.
2. Configure `VITE_SUPABASE_URL` and the project's public anon key in the Replit web app's Variables.
3. From this directory, link the Supabase CLI to the project and apply the database migration:

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

4. Deploy the Edge Function:

   ```sh
   supabase functions deploy privacy-assistant
   ```

5. In Supabase Dashboard → Edge Functions → Secrets, set `GROQ_API_KEY`. Optionally set `GROQ_MODEL`; when omitted, the function uses `llama-3.3-70b-versatile`.

**Never store the Groq key in Replit Variables/Secrets, the browser, `.env`, or source control.** The browser sends signed-in requests only to the Supabase Edge Function. The function validates the user, enforces request and history limits, calls Groq, and saves messages. Row-level security protects user-owned conversations and learning progress.

If the Groq secret is missing or the provider is unavailable, the assistant reports that clearly and offers built-in guide-based help. Public guides, lessons, quizzes, checklists, and recommendations do not require the AI service.
