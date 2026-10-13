# Changelog

## Unreleased — editable device controls

- Add Edit and Remove buttons to every V0–V31 pin card, including demo presets.
- Add authenticated pin update/delete APIs with confirmation, dependency checks, state reset and widget/voice cleanup.
- Ignore telemetry for absent pins while retaining validation for configured pins.
- Handle empty devices and removal of the last chartable input; update online and offline manuals.


## Google Assistant documentation update

- Added a complete self-hosting, Google account-linking and troubleshooting walkthrough.
- Linked the walkthrough from README and backend documentation.
- Documented feature-branch publishing to the existing repository.
- Included the OAuth native-form browser fix and regression check.

## 5.1.0

- Contextual tab manuals and searchable full guide with examples/troubleshooting.
- Complete repository distribution, refreshed setup/readme, operations and contribution guides.
- Secret-free ESP32 template, release hygiene checks and CI configuration.
- Fresh-install database host port defaults to 5433; setup includes loopback MQTT settings and never overwrites existing configuration.

## 5.0.0

- Rooms/groups, multi-output scenes, threshold rules with reset margins/cooldown.
- Per-action run history and local-HTTP UUID fallback.

## 4.0.0

- Saved responsive widget layouts and timezone-aware scheduled automations.

## 3.0.0

- Embedded MQTT broker and ESP32 LED firmware.

## 2.0.0

- Virtual pins, telemetry, commands, WebSockets and HTTP simulator.

## 1.0.0

- Landing page, accounts, sessions and token-based device management.

## Unreleased — optional voice backend

- Add migration 005 for OAuth clients, grants, hashed tokens and opt-in voice mappings.
- Add Google fulfillment and Alexa Smart Home Lambda/Express adapter using existing device commands and ACKs.
- Add exact redirect checks, consent binding, optional S256 PKCE, grant revocation, provider isolation and retry deduplication.
- Add voice integration tests and developer setup/operations guide; voice remains disabled by default.
