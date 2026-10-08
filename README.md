# DigiStayBook

DigiStayBook is a B2B digital guestbook for short-term rental hosts.

## Local Test

Run `npm run test:local`, then open http://127.0.0.1:5181/__test for accounts and the walkthrough.
This starts the isolated `demo-digistaybook` Firebase emulators and website. It restores saved data or seeds two hosts, an operations reviewer, three properties and eight guest scenarios. All three accounts use `LocalTest-2026!`: `host@example.test`, `host2@example.test`, and `operations@example.test`.

- `npm run test:local:save` saves accounts, records and photos. The launcher also saves every 30 seconds and on Ctrl+C, keeping three recovery snapshots.
- `npm run test:local:reset` replaces local Test data with the original examples. Sign out/back in afterward; clear site data or use a private window for fresh guest sessions.
- `npm run test:local:workers` runs due screening retries and photo cleanup. The launcher runs these periodically; normal settle periods and retry backoff still apply.

Use `[review]`, `[safety]` or `[outage]` in harmless messages to simulate screening routes; unmarked text is clear. Photo classification is simulated from those markers. Payments and real emails are disabled; inspect `notificationOutbox` in http://127.0.0.1:4000 for queued notices. Operations access uses a demo-only reviewer claim, not real MFA.

Test runs on this computer only. Production remains `digistaybook-cbert`; no separate staging environment is used. Generated runtime/secrets/snapshots stay in ignored `.local-test/`. Restart the launcher after backend code changes. Local checks do not establish real Google classification, deployed App Check/MFA, payments, email receipt or cloud deletion/recovery.

## Project status

This repository begins from the consolidated product and operational plan supplied in Google Drive. The implementation will be delivered in small, reviewable pull requests.

## Working agreement

- Google Drive is used for collaborative drafting.
- GitHub is the source of truth for agreed requirements, decisions, code, and release history.
- Every change is made through an issue, branch, commit, and pull request where practical.
- Do not commit secrets, production credentials, or private guest content.

## Documents

- [Authoritative BOP v3](digistaybook_WIP_v3.md)
- [Readable BOP v3 HTML](artifacts/digistaybook_WIP_v3.html)
- [Readable BOP v3 DOCX](artifacts/digistaybook_WIP_v3.docx)
- [BOP v2 to v3 HTML comparison](artifacts/digistaybook_WIP_v2-to-v3-diff.html)
- [Preserved BOP v2 baseline](digistaybook_WIP_v2.md)
- [Product specification](docs/product-spec.md)
- [Decision log](docs/decisions.md)
- [Change log](docs/change-log.md)
- [Backlog](docs/backlog.md)
- [Implementation plan](docs/build-plan.md)
- [Current implementation checkpoint](docs/implementation-status.md)

Regenerate the readable artifacts with the bundled Python runtime by running `tools/build_bop_artifacts.py --outdir artifacts` from the repository root.

Validate the restart/status ledger with `node tools/verify-implementation-status.mjs`.
