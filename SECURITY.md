# Security policy

## Supported versions

| Version | Supported |
|---|---|
| `main` and the latest release (0.1.x) | Yes |
| Older releases | No |

The live site is https://travertinefields.com and the engine API is https://api.travertinefields.com.

## Reporting a vulnerability

Please report vulnerabilities **privately** through GitHub: open the repository's **Security** tab and choose
**Report a vulnerability** (private vulnerability reporting). Do not open a public issue, pull request or discussion
for a security problem.

Include what you found, where (URL, endpoint or file), how to reproduce it, and the impact you expect.

## What to expect

- Acknowledgement within 3 days.
- An assessment and, if confirmed, a fix or mitigation plan within 14 days, sooner for anything actively exploited.
- Credit in the advisory and the changelog if you want it.

## What the app stores

Travertine has no user accounts, no login and no user database. Fields, priorities and settings live in the page
address and in your own browser on your device. The only data sent to the engine is the field's coordinates (and
outline, if drawn) needed to compute an analysis; the engine caches results from public datasets by rounded location
and stores nothing that identifies a person.
