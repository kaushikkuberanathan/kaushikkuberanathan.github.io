# Governance (Portfolio)

Profile `portfolio-light`. Canon lives in product-ops @ v0.1.1 (conceptually pinned). The PR body guard is **inlined** in `.github/workflows/pr-governance.yml` because GitHub blocks public→private reusable workflow calls from this public repo to private `product-ops` — do not reintroduce a `uses:` of the private workflow. Local overrides: live-smoke, confidentiality/AES, never edit activity-data from copy PRs.
