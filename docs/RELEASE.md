# Release process

Joey Prompthub releases are produced by `.github/workflows/release.yml` from a version tag.

## Prerequisites

Configure these GitHub Actions secrets:

- `WINDOWS_CSC_LINK`: base64 certificate, secure certificate URL, or other electron-builder-supported certificate reference
- `WINDOWS_CSC_KEY_PASSWORD`: certificate password

The workflow fails closed if either secret is absent.

## Checklist

1. Set the same version in `package.json` and `package-lock.json`.
2. Run `npm ci` and `npm run verify`.
3. Run `npm run test:e2e`.
4. Review `npm audit` and the dependency diff.
5. Confirm `.gitignore` still excludes local AI settings, databases, logs, environment files and secret stores.
6. Run `npm run sync:website-release` and review the website fallback version.
7. Commit the release, then create and push the matching tag, for example `v0.3.0`.

## Automated release gates

The signed release workflow:

1. checks that the tag equals the package version;
2. installs from the lockfile;
3. runs lint, formatting, coverage, type/build, real Electron database smoke tests, bundle budgets and Electron E2E tests;
4. builds the NSIS x64 installer;
5. rejects a missing or invalid Authenticode signature;
6. writes `SHA256SUMS.txt`;
7. uploads only the signed installer and checksum file to GitHub Releases.

Never upload an unsigned local installer as an official release.

## Website

`.github/workflows/pages.yml` deploys `docs/官网主页` to GitHub Pages after changes land on `main`. The static fallback version is synchronized from `package.json`; at runtime the page requests the latest GitHub Release and switches the download button to its signed Windows x64 installer.

## macOS

macOS development and release requirements are documented in `MAC-DEVELOPMENT.md`. Production macOS artifacts must be built on macOS with a Developer ID Application certificate and Apple notarization credentials. Never publish the unsigned `release-mac-dev` output.
