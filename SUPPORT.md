# Support

Talk With Data is a volunteer-maintained open-source project. Support is best
effort and happens in public channels when the topic is safe to discuss.

This document does not create a service-level agreement, paid support contract,
or guaranteed response time.

## Supported channels

Use GitHub issues for:

- Reproducible bugs.
- Documentation gaps.
- Setup or deployment problems that are caused by the repository instructions.
- Feature requests with a clear user workflow.
- Questions that should become public documentation.

Before opening an issue:

- Search existing open and closed issues.
- Use the latest `main` or the latest supported release when one exists.
- Remove secrets, private URLs, personal data, access tokens, and customer data
  from logs and screenshots.
- Include exact versions, environment details, and reproduction steps.

## Unsupported channels

The project does not provide support through private maintainer email, direct
messages, private chat, or comments unrelated to the issue topic.

The public issue tracker is not for:

- Security vulnerabilities.
- Emergency production operations.
- Private deployment debugging.
- Legal, compliance, procurement, or data-processing advice.
- Consulting, custom feature delivery, or hosted service support.
- Questions that require access to private data, secrets, or proprietary
  infrastructure.

Security reports must use the private process in [SECURITY.md](SECURITY.md).

Code of conduct reports follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Triage expectations

Maintainers may ask for more evidence, reduce scope, change labels, close
duplicates, or convert broad requests into narrower issues.

Reports are easier to handle when they include:

- Expected behavior.
- Actual behavior.
- Reproduction steps.
- Logs or screenshots with secrets removed.
- Browser, operating system, hosting platform, and relevant environment
  variables.
- Whether the issue appears on local development, Docker, Cloud Run, or another
  deployment target.

Issues without enough evidence may be closed after follow-up. They can be
reopened when new evidence is provided.

## Maintenance scope

The maintainer prioritizes security, release blockers, reproducible bugs,
documentation that affects setup, and changes that move the public roadmap.

Self-hosters are responsible for:

- Firebase, Google Cloud, PostgreSQL, DNS, TLS, backup, monitoring, and regional
  hosting configuration.
- Managing secrets and access keys.
- Applying updates.
- Verifying legal and compliance obligations for their own deployment.
- Protecting private data used in dashboards, uploads, and data sources.

## Security boundaries

Do not post exploit details, private reproduction data, secrets, or credential
material in public issues. If a report might expose user data, bypass
authorization, disclose secrets, or enable code execution, use
[SECURITY.md](SECURITY.md).
