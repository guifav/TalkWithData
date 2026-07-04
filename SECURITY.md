# Security Policy

Talk With Data handles authentication, embed tokens, database credentials, and user-uploaded content. Weaknesses in these areas put every self-hosted deployment at risk, so we ask for private, responsible disclosure.

## Supported versions

Talk With Data is pre-1.0 software. There are no maintenance branches and no backports.

| Version | Supported |
| --- | --- |
| Latest commit on `main` | Yes |
| Any older commit or fork | No |

Security fixes land on `main` only. If you self-host, update to the latest `main` to receive fixes.

## How to report a vulnerability

Report vulnerabilities privately through GitHub Private Vulnerability Reporting:

1. Open https://github.com/guifav/TalkWithData/security/advisories/new
2. Or go to the repository Security tab and click "Report a vulnerability".

Do not open a public issue, pull request, or discussion for a security problem, and do not post exploit details in public comments.

## What to include in a report

- The affected area, for example an API route, a library file, or a feature such as embed tokens or dashboard upload.
- The type of issue, for example XSS, authorization bypass, token forgery, SSRF, or injection.
- Step-by-step reproduction instructions or a proof of concept.
- The impact, meaning what an attacker can read, change, or execute.
- The commit hash you tested against.
- A suggested fix, if you have one.

## What to expect

- Acknowledgment of your report within 5 business days.
- An initial assessment and severity triage within 14 days.
- A fix plan and timeline after triage. Critical issues are prioritized.
- Credit in the published advisory, unless you prefer to stay anonymous.

Please keep the details private until a fix is released. We aim to publish a fix and an advisory within 90 days of a valid report, sooner for critical issues.

This is a volunteer-maintained open source project. There is no bug bounty program.

## Scope

In scope:

- Authentication and session handling, including Firebase sign-in and dashboard session cookies.
- Authorization, including admin routes, department access, and shared folders.
- Embed token generation and validation.
- Rendering and sanitization of user-uploaded HTML dashboards.
- File upload parsing, including CSV, Excel, and ZIP handling.
- Server-side handling of AI provider API keys and database credentials.
- Firestore security rules in this repository.
- Server-side request handling, including MCP host access and dashboard refresh.

Out of scope:

- Vulnerabilities in third-party dependencies without a demonstrated impact on this project. Report those upstream.
- Misconfiguration of individual self-hosted deployments, for example exposed `.env` files or a publicly reachable database.
- Denial of service through high traffic volume.
- Social engineering and physical attacks.
- Reports from automated scanners without a validated proof of concept.

Only test against deployments you own or have permission to test.
