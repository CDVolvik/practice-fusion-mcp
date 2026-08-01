# Phase 0 — Practice Fusion FHIR access

Everything needed to go from "code done" to "live smoke + publishable." Mostly manual (needs a real Practice Fusion account); the code is already built and tested against mocks. **Critical path = step 1 (registration approval).** Steps 2–4 can be pre-staged now.

---

## 1. Register the free Open FHIR account

- Go to the **PDS (Patient Data Sharing) API Partner Registration** form: `pfpds.practicefusion.com/s/Registration` (linked from https://www.practicefusion.com/fhir/get-started/).
- Provide developer contact + company details (R21 Digital), homepage URL, agree to ToS.
- On approval you get an email with **PDS API portal** login. _(Approval is not instant — this gates everything else.)_

## 2. Generate the app keypair (for JWKS auth)

The server authenticates with a signed JWT — register the **public** key with PF, keep the **private** one. Run in this repo (`jose` is already installed):

```bash
cd projects/practice-fusion-mcp
node -e "import('jose').then(async j => {
  const {publicKey, privateKey} = await j.generateKeyPair('RS384', {extractable:true});
  const fs = await import('node:fs');
  fs.writeFileSync('pf-private.pem', await j.exportPKCS8(privateKey));
  const jwk = await j.exportJWK(publicKey);
  jwk.alg='RS384'; jwk.use='sig'; jwk.kid='pf-mcp-1';
  fs.writeFileSync('pf-jwks.json', JSON.stringify({keys:[jwk]}, null, 2));
  console.log('wrote pf-private.pem (KEEP SECRET) + pf-jwks.json (register with PF)');
})"
```

- `pf-private.pem` → becomes `PF_PRIVATE_KEY`. **Never commit it** (`.env` + `*.pem` — verify both are gitignored).
- `pf-jwks.json` → the public key you give PF (host it at a URL, or paste it, per what the portal accepts).

## 3. Create the app in the PDS portal

Complete the **Partner Application** form:

- **Application type: `System / Bulk export`** (backend service) — _the load-bearing choice._
- **JWKS URL** → already hosted (see below), or paste the key if the portal allows.
- **Requested scopes:** `system/*.read` (read-only).

**JWKS hosting — DONE + VERIFIED (2026-07-17):** hosted on **Vercel** (team `r21digital`, project `pf-mcp-jwks`), serving public `200 application/json`, kid `pf-mcp-1`, verified to match the local private key.

- **JWKS URL to give PF:** `https://pf-mcp-jwks.vercel.app/pf-jwks.json` (also `/.well-known/jwks.json`).
- Local source: `D:/pf-mcp-jwks` (static files at root). To rotate the key: replace `pf-jwks.json` + `.well-known/jwks.json`, then `vercel deploy --prod --yes` from that dir.
- ~~GitLab Pages attempt (`CDVolvik/pf-mcp-jwks`) abandoned~~ — persistent 403 from Pages access control; moved to Vercel for reliability. Old GitLab repo can be deleted.

## 4. Capture the 4 values → the server's config

From the portal, drop these into a local `.env` (copy `.env.example`):

| Value from PF                | → env var          |
| ---------------------------- | ------------------ |
| FHIR R4 base URL             | `PF_FHIR_BASE_URL` |
| OAuth2 token endpoint        | `PF_TOKEN_URL`     |
| Client ID                    | `PF_CLIENT_ID`     |
| Contents of `pf-private.pem` | `PF_PRIVATE_KEY`   |

## 5. Two verifications

- **✅ RESOLVED 2026-07-31 — the Open tier does allow a System/backend-services app.** PF's API specifications list **"Bulk-Data (Asymmetric/Public Key, Client Credentials, 2-legged OAuth)"** as a supported flow for confidential clients, and their SMART well-known config advertises `client-confidential-asymmetric` plus the `client_credentials` grant. PF's FHIR overview confirms Bulk Data Access v1.0.1 compliance and lists "System or Bulk export" as one of three app classifications. PF's own approval email offered the System App on the standard PDS path with a JWKS requirement and no fee attached. **The auth flow in this repo needs no adjusting.**
- **⚠️ STILL OPEN — is the System app on the Open path actually free?** Not verified, and don't assume it. PF's developer pages twice reference "applicable API fees for users" and a downloadable **"Certified EHR API Fees"** document that is not locatable on any public PF page. The "Open FHIR account = FREE" line in the reference block below traces to prior research, not to that fee schedule. Settle it in writing at zero cost via the **Case comment thread** attached to the application once submitted (every PDS submission gets one), or via `VeradigmConnect@veradigm.com`. **Do not commit a delivery date to a clinic until this answer is in writing** — it is the last item that could turn this lane from free into the paid Integrator/Unity tier.
- **✅ AWS BAA accepted 2026-07-31.** Confirmed in the AWS Artifact console on account **864899857581** (the org management account). Note the trap: `aws artifact list-customer-agreements` returns `[]` whether or not the BAA is accepted, so it does not distinguish the two states — the console is the authority. Prior to this date R21 had **no** AWS BAA, contrary to what `_PUNCHLIST.md` had asserted since 2026-05-16.

## 6. Then run Task 12 (live sandbox smoke)

Once `.env` + sandbox access work:

```bash
pnpm build
npx @modelcontextprotocol/inspector node dist/index.js
```

- Confirm all six tools list.
- Run `search_patients` (known sandbox name) → copy an id → `get_patient`, `get_appointments`, `get_conditions`, `get_medications`, `get_lab_results`.
- Confirm each returns shaped JSON, each emits an audit line on stderr, and no token/PHI leaks to stdout.
- Record which search params PF actually honored in `docs/superpowers/specs/2026-07-17-practice-fusion-mcp-design.md` (Phase 0 verification section); adjust tool `inputSchema`s if PF rejected a param.

## 7. Publish

Published to GitHub: **[kushaim/practice-fusion-mcp](https://github.com/kushaim/practice-fusion-mcp)** (MIT). Next: list on the MCP registries (`awesome-mcp-servers`, the MCP registry) and — once live-smoked — publish to npm as `practice-fusion-mcp`.

---

**Reference — Veradigm access facts:** Open FHIR account = FREE (read, US Core FHIR R4). Integrator/Unity (write, scheduling) = PAID (Gold $5,389/yr min + $3,500/cert + per-client API fee; Gold+ required to go live with clients). 30-day free trial.
