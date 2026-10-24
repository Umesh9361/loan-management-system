# Overdue/loss report performance

## Scope

Backend-only optimization. No changes to report columns, frontend, printing,
metal-rate fetching, pagination, interest formulas, rounding, valuation or risk
thresholds.

## Changes

- Removed loan-by-loan and compounding-period debug logs. Successful storage
  calls emit only start/finish messages, including empty reports.
- Replaced repeated closure queries with one tenant-scoped closure fetch and an
  in-memory loan-ID map. Retained descending closure-date ordering and the
  original per-loan JavaScript `reduce` expression. SQL aggregation could change
  floating-point results, so it was deliberately not substituted.
- Added three non-unique schema indexes:
  - `loans_tenant_status_date_idx`: tenant, status, loan date.
  - `loans_tenant_status_group_date_idx`: tenant, status, group, loan date.
  - `loan_closures_tenant_loan_idx`: tenant, loan.
- Normal route debug logs were removed; existing error/timeout handling remains.

## Verification

- Before/after checks ran against the existing development database only:
  12 active loans across two tenants, 22 scenarios combining current/future
  projections, manual/loan-wise interest and purity, group, borrower and dates.
- A fixed clock and SHA-256 of all returned row fields verified identical
  contents in every scenario. Rows were sorted by ID for comparison; the actual
  report's existing loan-date ordering query was not changed.
- Across those scenarios: 125 database queries became 42; 944 log calls became
  44. A nonempty report uses two queries, an empty report one, with two normal
  storage log calls in either case.
- Eight synthetic full-output reference hashes were captured from the previous
  implementation. Regression tests exercise the real storage method source and
  Drizzle SQL generation against a synthetic client, without connecting to a
  database. They also cover tenant separation, filters, multiple payments,
  closure-date reduction order, unpaid/overpaid accounts, risk boundaries, empty
  results and query failure.
- A 10,000-loan/20,000-payment synthetic case, with loans dating to 1980, verifies
  two queries and two log calls regardless of compounding periods. Its elapsed
  time is diagnostic only, not a live database/Railway latency guarantee.
- All 82 tests passed. Production build passed. Full TypeScript checking still
  has the same 165 pre-existing diagnostics; it is not a clean type-check pass.
- The workflow restarted successfully and the mobile login screen rendered.
  Anonymous overdue API access still returns 401. The signed-in report UI was
  not visually verified; authentication was not bypassed.

## Database application and rollout

`npm run db:push -- --verbose` applied the three indexes to the development
database (`heliumdb`); catalog queries confirmed all three are valid. Drizzle
also normalized the existing `parties.opening_balance_date` default to the
schema's `current_date` expression. No records were deleted or rewritten.

No production database, GitHub branch or Railway deployment was changed for
this optimization. Railway's external database does not acquire these indexes
from a Replit preview restart. Apply the three additive indexes there only
through an owner-approved external migration, with a suitable lock/time budget
for the real table sizes, and verify the deployed revision and response time.

## Limits

The report still materializes its full result and the tenant's closures, so
work and memory remain proportional to portfolio/history size. This removes
the identified per-loan query and logging overhead; it is not constant-time
generation for arbitrary database sizes. The existing 30-second route timer
does not cancel database work, and the success path can attempt a second
response after a timeout; that separate behavior was not changed here.
