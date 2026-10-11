# Security policy

This project is a single-instance trusted-LAN starter. Only the current 5.1 source line is maintained here; no security audit or response-time commitment is implied.

## Reporting

Use this repository's Security → Report a vulnerability when the maintainer has enabled private vulnerability reporting. If that option is absent, open an issue asking for a private reporting channel without exploit details or secrets. Do not publish credentials, customer data or an exploitable proof of concept in a public issue. Maintainers should enable private reporting before inviting public use.

Include affected version, impact, safe reproduction steps and a suggested fix if available. Rotate exposed credentials immediately; deleting a file from a commit does not remove it from Git history.

## Implemented controls

HttpOnly sessions, bcrypt passwords, CSRF and exact-origin checks, per-owner data authorization, random per-device tokens, hashed lookup, encrypted token recovery, input validation, command expiry and credential-version checks. WebSocket access validates session, Origin and device ownership. MQTT uses device-bound credentials and topic authorization.

## Deployment limits

Development defaults use HTTP and plain MQTT. Do not publish these listeners to the internet. Production needs HTTPS/WSS, TLS for devices with certificate validation, narrowly trusted proxies, network isolation, registration policy, backups, monitoring, dependency maintenance and independent review. Email verification, password recovery, MFA and shared distributed rate limiting are not implemented. Public registration is enabled. The embedded broker is not hardened for hostile internet clients. Encryption at rest depends on keeping TOKEN_ENCRYPTION_KEY private and recoverable.

The board demo is not appropriate for safety-critical or mains control. Last-reported state is not physical-state proof; output reconciliation and hardware safeguards remain application responsibilities.
