# Free deployment with Netlify + Neon

This branch targets Netlify's free tier for the full-stack TanStack Start app and keeps PostgreSQL on Neon.

## Deploy

1. Open https://app.netlify.com/start and sign in.
2. Choose **Import from Git**, select `mzn1122334405-lab/My-online-survival-game`.
3. Choose branch `deploy/netlify-free`.
4. Use the build settings from `netlify.toml`; do not override the build command.
5. In Site configuration → Environment variables, add:
   - `VITE_AUTH_ENABLED` = `true`
   - `VITE_GROK_OAUTH_ENABLED` = `false` (email/password login only until OAuth credentials are configured)
   - `BETTER_AUTH_SECRET` = a new random secret of at least 32 bytes
   - `DATABASE_URL` = the pooled connection string from the Neon project `my-online-survival-game`
   - `BETTER_AUTH_URL` = the primary public URL Netlify assigns to this site (for example, `https://your-site-name.netlify.app`)
6. Trigger a fresh deploy after saving environment variables.

## Important

- Keep the Netlify plan on **Free**. Netlify's free tier has monthly usage limits.
- Keep Neon on its free plan too. The database connection string is a password; paste it only into Netlify's environment-variable settings, never into source control or public chat.
- The app build runs `npm run db:migrate`, which applies the database migrations when `DATABASE_URL` is present.
- This configuration has not been validated by a successful production build in this environment. Check the first deploy's logs and test sign-up/sign-in before sharing the link.
