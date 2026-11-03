# Eldervale

Browser-based medieval fantasy RPG using Three.js, Supabase authentication,
player persistence, gathering, equipment and multiplayer social features.

Production is deployed from `main` with the manual `deploy-hostinger.yml` workflow.
A branch push alone does not publish the game.

See [World Studio guide](owner-guide.html) for world building, item creation,
moderator roles and the in-game terminal. The terminal uses server-validated game
commands; hosting and code deployment remain separate operations.

## Local checks

Node.js 22 or newer:

```sh
npm ci
npm test
npm run check
```

For the offline browser regression, install Chromium with
`npx playwright-core install chromium`, then run `npm run test:browser` and `npm run test:auth`.
An existing compatible binary can be supplied through `ELDERVALE_CHROMIUM`.
The harness serves its own local HTTP page, substitutes an offline auth fixture,
blocks external services, and writes ignored screenshots to `test-results/`.
The authentication suite uses the real client UI with a fake transport. Neither suite tests against production or changes real player accounts.

Serve the repository with any static HTTP server for ordinary development.
Production auth requires the existing Supabase configuration; never place private
service credentials in client files.
