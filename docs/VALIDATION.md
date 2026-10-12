# Validation of the 5.1 GitHub distribution

Local checks completed on 11 October 2026:

- Fresh `npm ci` completed successfully from the supplied package/lock files.
- Full automated suite at that stage: 18 tests passed, covering accounts, sessions, owner checks, MQTT, WebSockets, virtual pins, commands/ACKs, dashboards, schedules, scenes, rules, migration preservation and fresh setup/non-overwrite behavior.
- The subsequently added release-hygiene regression test passed separately. The committed `npm test` glob includes all 19 tests.
- Production frontend build passed.
- Production dependency audit (`npm audit --omit=dev`) reported zero known vulnerabilities at validation time. This is not a security audit and advisories may change.
- M4 browser workflow passed: widgets/layouts, drag/resize, simulator control/ACK, scheduled automation and phone/desktop layout.
- M5 browser workflow passed: rooms, multi-action scenes with simulator ACK, rule lifecycle, phone layouts and local-HTTP UUID fallback.
- Contextual/manual browser workflow passed: all eight dashboard page types, full manual search/deep links, troubleshooting, close controls and phone/desktop layouts.
- Release hygiene check passed for source candidates; ZIP packaging explicitly excludes credentials, dependencies, builds, QA screenshots and local backups.
- Compose, Dependabot and CI YAML parsed successfully.
- Documentation links checked against supplied files.

Limitations:

- Local database tests use PGlite rather than the user's Windows Docker PostgreSQL instance. A real PostgreSQL migration smoke job is configured in CI, but that hosted job has not run here.
- Docker is unavailable in this environment; the supplied Docker build job is not claimed as locally executed.
- PlatformIO is unavailable here; the included firmware source matches the prior working ESP32 MQTT example. The secret-free template and CI firmware compile job are supplied, but compilation with this template has not run locally.
- Hardware behavior is not newly tested for this packaging/documentation release. Browser commands use the simulator.
- GitHub workflows have not executed on the user's repository because this project has not been pushed or published. Check the Actions tab after first push.
- Single-instance LAN starter only. No load testing, external penetration test, internet deployment review or safety certification is claimed.


## Optional voice backend candidate

Based on GitHub commit `4358fb3`. All 20 Node integration/security tests passed,
including the new OAuth and voice test. The Vite production build and release
hygiene check also passed. Voice tests cover consent Origin binding, optional
S256 PKCE, single-use authorization codes, client/provider isolation, mapping
ownership and types, command ACKs, duplicate request IDs, unacknowledged expiry,
Alexa discovery/state responses, and password-change revocation.

Database tests use the existing serialized PGlite test adapter; this is not a
PostgreSQL concurrency/load test. Existing MQTT regression tests pass, but no
live Google/Alexa developer accounts, real cloud tunnel, or physical ESP32 were
used for this voice integration validation. Provider certification, public
security review, and production load testing remain outstanding.

## Google Assistant guide and OAuth browser regression (2026-10-12)

- All 20 Node tests, production frontend build and release hygiene passed again.
- Chromium native-form test preserved Origin and reached a controlled callback endpoint; this is not a live Google account-linking test.
- Guide commands were checked against OAuth provisioning, voice mapping and authentication handlers.
- The maintainer reported successful Google Home linking after the browser fix; other installations still require their own end-to-end tests.
- Hosted GitHub Actions results are separate from these local checks; review the pull request checks before merging.
