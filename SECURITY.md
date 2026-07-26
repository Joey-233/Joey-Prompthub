# Security Policy

## Supported versions

Only the latest published Joey Prompthub release receives security fixes.

## Reporting a vulnerability

Please do not disclose exploitable details in a public issue. Use GitHub's [private vulnerability reporting](https://github.com/Joey-233/Joey-Prompthub/security/advisories/new) and include:

- affected version and Windows version
- reproduction steps or proof of concept
- expected impact
- any suggested mitigation

If private reporting is unavailable, open a minimal issue asking for a private contact channel without including secrets or exploit details.

## Security expectations

- Installers published as official releases must have a valid Windows Authenticode signature and a matching SHA-256 checksum.
- API keys must never appear in exports, logs, renderer responses, screenshots, or source control.
- Non-loopback custom service endpoints require HTTPS and explicit user approval.
- Local development builds are not official signed releases.
