# Login and Chrome warning review

## Scope and outcome

This is a limited source review and authentication hardening, not a penetration-test certificate or a guarantee that the application is free of vulnerabilities.

The screenshot shows Chrome's **Dangerous site** warning while the connection is encrypted. Encryption and unsafe-site classification are separate. The screenshot does not establish a compromise, an invalid certificate, or a false positive. Logging in before seeing the warning does not establish that login caused it.

Public checks of the Railway hostname supplied by the owner found:

- HTTP redirects to HTTPS with status 301.
- The HTTPS landing page returns 200.
- HSTS, CSP, X-Frame-Options and X-Content-Type-Options were absent from that response at the time of checking.
- Only unauthenticated public requests were made. No production exploit, login guessing, account modification, session revocation or deployment was performed.
- The deployed revision, current Google threat classification and signed-in Railway screens have **not** been independently verified. Missing headers are not evidence of the cause of Google's warning.

## Hardening implemented in this workspace

- Production requires a configured session signing secret; no predictable signing-secret fallback.
- Session cookies are HttpOnly, SameSite=Lax and Secure in production. A single trusted hosting proxy allows cookies on HTTPS terminated by Railway.
- Login regenerates and saves a new session ID. Logout destroys the session and expires the cookie, with error handling.
- Protected API requests revalidate user identity, tenant, active status, role and the existing IST calendar-day login expiry. Inactive or missing business tenants cannot use protected APIs.
- Both PUT and PATCH self-password-change routes require the current password and reject oversized bcrypt inputs.
- Exact same-origin or explicitly configured origins replace permissive hosting-domain substring CORS. Cross-origin writes and untrusted simple-form writes are rejected.
- Per-IP login, recovery-request and self-password-change throttling.
- Public HTTP emergency reset/list routes removed and the emergency prefix disabled in every environment.
- A missing system administrator requires an explicit bootstrap password rather than a known default. Database-health failures cannot trigger default-account recreation. Existing account passwords were not reset.
- Financial reference checks reject foreign tenant/group/borrower/party/loan references and tenant reassignment. Loan and permission updates bind ownership to the authenticated tenant.
- Local photos require an active authenticated session and a matching active photo record in that tenant. Uploads verify loan ownership before processing multipart data.
- Business administrators cannot create system-super-admin roles through user management. Password fields are excluded from relevant user-management responses.
- Security headers added, API response-body logging removed, recovery-password console logging removed, and generic API 5xx errors prevent sending database details to clients.
- Compatible Express, Multer, Cloudinary and vulnerable transitive dependency updates were applied.
- The old PDF release blocked a clean install. jsPDF was therefore updated to the approved 4.2.1 release with the compatible AutoTable release. Constructor imports were standardized without changing report calculations/layouts. Actual embedded-Devanagari receipts, A4 tables, thermal image output and disabled Node filesystem loading have regression coverage.
- Approved package tarball URLs are externally reachable HTTPS registry URLs with integrity hashes retained; no Replit-internal tarball URL remains in the lockfile.

No existing user passwords, global session set, live Railway deployment, domain configuration or production data were deliberately changed.

## Checks and limitations

- **68 tests passed**, including 12 isolated security HTTP/configuration tests, four PDF/lockfile compatibility-security tests and the existing report regressions.
- New tests use synthetic users and in-memory sessions, not production credentials or financial data. They cover the actual reusable security middleware but do not replace full end-to-end coverage of every financial route with PostgreSQL.
- Production-cookie behavior was checked using a synthetic reverse-proxy HTTPS request.
- Build passed. Existing duplicate-key and bundle-size warnings remain.
- A fresh empty-directory/fresh-cache `npm ci --no-audit --no-fund` installed 735 packages with lifecycle scripts on Linux x64 / Node 20. This exercises the dependency-install command used by the Railway Dockerfile without relying on workspace node_modules. Public jsPDF and Express tarball URLs also returned 200. No Docker container/image was run or built, and no actual Railway deployment was performed.
- Full TypeScript checking still reports the **165 pre-existing errors**; it is not a clean type-check result. No errors were reported in the new security modules.
- The managed development workflow was restarted successfully. Mobile login rendering was checked. The signed-in UI was not verified.
- Running preview requests returned 401 for anonymous loans, closures, cash transactions, auth/me and local-photo access; emergency routes returned 404; an unrelated Railway Origin was rejected with 403.

### Automated scans

All three scanners completed. Results count advisories/findings, not proven exploits or distinct vulnerable packages:

| Scan | Before | After |
| --- | --- | --- |
| Dependency advisories | 175: 6 critical, 74 high, 80 moderate, 15 low | 78: 2 critical, 36 high, 34 moderate, 6 low |
| SAST | 0 | 0 |
| Privacy | 18 | 9 |

The two remaining critical dependency findings are Python certifi advisories. The workspace scan includes npm and Python tooling; the current Railway Docker build installs npm packages, not the Python dependency set from uv.lock. The latest scan reports no critical npm dependency findings, but high/moderate/low npm findings still require triage and remediation.

The attempted same-major PDF update and the old release in a clean install were blocked by package security policy. That policy was not bypassed: the approved patched release was installed, then lockfile metadata was normalized for external-host portability. Versions and integrity hashes were not changed by URL normalization.

The remaining privacy critical finding points at a generic aggregate cleanup-record count, after borrower/account details were removed from that log. It should be reviewed as a likely contextual false positive; other username/audit logging findings remain. A zero-result SAST scan is not proof that application authorization is correct.

## Remaining work / release considerations

1. Review and upgrade the remaining deployed dependencies, prioritizing Excel, image processing and database-query libraries; continue signed-in browser PDF regressions as well. Some fixes require compatibility work or a replacement decision; do not force a broad migration without owner approval. The PDF library update originally listed in the proposed follow-up has now been completed as part of resolving the clean-install blocker.
2. Audit report/print HTML interpolation and add hostile-input regressions. Enforcing strict CSP was intentionally deferred because existing print templates use inline scripts; disabling those scripts without migration would break printing. **CSP is not currently enforced.**
3. Confirm server-side enforcement of detailed ordinary-user permissions with actual route tests, not just menu visibility. Add separate-test-database A/B tenant tests across create/edit/delete, closures, cashbook, reports, backups and files.
4. Local photo protection does not make an external Cloudinary public URL private. If that provider is configured, assess authenticated/signed delivery separately before claiming end-to-end private file access.
5. Rate limits are in-memory and per process/IP. Replicated deployments need an appropriate shared limiter store; this is not distributed attack protection.
6. Existing weak passwords, if any, remain unchanged. The owner should change them using the normal authenticated password-change flow. Never send credentials through chat or logs.
7. Identify and test the exact release intended for Railway. Workspace checks do not establish which code is deployed. Do not publish this work as a claim that all security findings are resolved.

## Owner steps for Chrome's warning

1. Avoid entering sensitive information on a site while Chrome marks it dangerous. Do not disable Safe Browsing or instruct users to bypass the warning.
2. Open the verified site's **Security Issues** report in Google Search Console. Establish the exact issue/category and affected sample URLs.
3. Inspect the deployed revision, pages, redirects, third-party scripts and hosting activity. Fix all reported issues across affected pages; code hardening alone does not prove that unwanted deployed content is absent.
4. After fixes are verified and the owner has explicitly approved publication, deploy the intended safe release through the actual Railway project. This review did not perform that action.
5. Use **Request Review** in Google's Security Issues report with an accurate description of verified fixes. A report does not guarantee immediate removal. No review was submitted here.
6. Check classification again after Google's review. Retain monitoring, backups and a recovery procedure.

Official references:

- https://support.google.com/chrome/answer/99020
- https://support.google.com/webmasters/answer/9044101
