# Contributing

Use a feature branch and open a pull request describing the problem, change and validation. Keep changes focused. For large features, discuss an issue first to agree on scope.

## Setup

Use Node 24 and the root README. `npm ci` installs pinned dependencies. `npm test` needs no Docker; interactive use needs PostgreSQL and the migrations. Run `npm run build` and relevant browser checks for UI changes. Firmware changes belong in firmware/esp32 and need an explicit hardware/compile validation note.

## Conventions

- ES modules on the backend, React components on the frontend.
- Validate input and ownership server-side. Use parameterized SQL, existing session/CSRF middleware, and the shared command enqueue path.
- Keep token values and passwords out of logs, screenshots, fixtures and documentation.
- Never modify SQL001–004 after publication. Add a new numbered migration with an upgrade test.
- Absolute desired-state commands must remain safe to retry; do not implement implicit toggle/replay semantics without a protocol design.
- Update web/src/manuals.js for user-facing behavior changes and regenerate docs/USER_MANUAL.md using `npm run docs:manual`.
- Do not add a test merely to mirror a trivial implementation. Add meaningful regression tests for authorization, persistence or behavior changes.

## Before submitting

```sh
npm test
npm run build
npm run check:release
```

For UI changes, run npm run test:browser after installing Chromium. Include what was not tested. Keep node_modules, .env, .device.env, secrets.h, database dumps, firmware builds and .upgrade-backups out of the PR. Respect other contributors and focus discussion on the work.

Security vulnerabilities should be reported privately as described in SECURITY.md.
