# DigiStayBook

DigiStayBook is a B2B digital guestbook for short-term rental hosts.

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

Regenerate the readable artifacts with the bundled Python runtime by running `tools/build_bop_artifacts.py --outdir artifacts` from the repository root.
