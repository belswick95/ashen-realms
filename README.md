# Eldervale

Browser-based medieval fantasy RPG using Three.js, Supabase authentication,
player persistence, gathering, equipment and multiplayer social features.

Graphics overhaul work stays on `work/character-overhaul-unreleased`.
The production branch is `feature/materials-character-animation`.
No release is authorized by a development branch push.
See [overhaul status](docs/OVERHAUL_STATUS.md) for verified work and remaining gaps.

## Local checks

Node.js 22 or newer:

```sh
npm ci
npm test
npm run check
```

For the offline browser regression, install Chromium with
`npx playwright-core install chromium`, then run `npm run test:browser`.
An existing compatible binary can be supplied through `ELDERVALE_CHROMIUM`.
The harness serves its own local HTTP page, substitutes an offline auth fixture,
blocks external services, and writes ignored screenshots to `test-results/`.
It never tests against production or changes real player accounts.

Serve the repository with any static HTTP server for ordinary development.
Production auth requires the existing Supabase configuration; never place private
service credentials in client files.
