<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project boundary and handover

- Work only in Firsteditioncollectibles/tcg-invoice-reconciler. Never access, reuse or modify CardScout repositories, branches, deployments, environment variables, databases or services.
- Read BUILD_STATUS.md before continuing. Update it with completed work, actual test results and concrete remaining work when handing over.
- The user explicitly authorized always skipping Vercel's optional "Secure Your Account with 2FA" setup prompt when it appears. This preference concerns that optional onboarding prompt.
- This is a client-only TCGplayer reconciler. Keep file processing local and require review before export. The user explicitly requested removal of the PDF title and repeated buyer-prepared disclaimer blocks on 20 September 2026. The later explicit exact-layout request also removes the added total/footer/page-number labels: PDFs and their previews follow the supplied marketplace screenshot, including unboxed metadata columns, original thumbnails, the source header buttons and four-column table. Keep reconciliation identified in the app, download filename, PDF metadata; do not represent the output as newly seller-issued.
- Keep money calculations in integer cents. Do not silently accept invalid monetary inputs or merge different sellers, conditions, card variants or prices.
- Test the affected stage before proceeding. Required V1 checks are documented in README.md.
- No real customer records, private invoices, credentials, or environment files belong in this public repository. Use synthetic fixtures.

## Publishing authorization — 20 September 2026

- The user approved connecting only this repository to its existing dedicated Vercel project and publishing the tested reconciler. The connection is now established; do not ask for this permission again. Production tracks `feat/tcgplayer-reconciler-v1` (main still contains the starter). Pushes to this branch trigger deployments. Keep changes limited to project `prj_biGutj7uN6aGN7BhHovBjUz7Gkzs`, team `team_5DQoS9LZQGvYBVK00CtKwcPJ`.
- The user says this may become a CardScout feature later. That is a future plan, not authorization to access or integrate CardScout now. Preserve the current isolation boundary until explicitly authorized.
