# Weight-output audit

## Scope and calculation contract

Gross weight means recorded collateral grams, not purity-adjusted fine weight.
Sum full-precision eligible records, once per tenant/loan identity, then display
two decimal places. Never sum rounded labels or concatenate numeric fragments
from text. Report-specific date, group, customer, status, unsecured and metal
eligibility are unchanged. No stored weights or purity records are rewritten.

## Inventory of existing gross-weight totals

| Output | Sources and coverage |
| --- | --- |
| Borrower list, all existing tabs/outputs | `client/src/pages/reports/borrower-list.tsx`: checked unique source entries, shared totals and two-decimal labels in existing screen, generated PDF/print and Excel weight fields. |
| Account summary, group/customer modes | `client/src/pages/reports/account-summary.tsx`: checked unique entries, exact row/grand gross totals and two-decimal weight cards. Desktop/print/Excel layouts do not have weight columns; none were added. |
| Overdue/loss analysis | `server/storage.ts`: account-aware source parsing for secured collateral. `client/src/pages/reports/overdue.tsx`: unique loan payload, separate gold/silver gross and fine totals over filtered secured entries, two-decimal weight rows/summary/print/Excel. Screen and print totals share labels; Excel retains its existing per-row metal/weight fields, without new total columns. Existing per-loan purity formula remains unchanged. |
| Packet-label summary | `client/src/components/label-print-dialog.tsx`: filter first, validate and deduplicate; exact raw-weight sum, two-decimal preview summary, consistent unique account count. |
| Packet-label print, including per-packet batches | Same component: validate/deduplicate before splitting into packets, compute each packet from its own raw weights, two-decimal HTML labels. No repeated global total on each packet. |

Search covered client, server and shared code for weight identifiers, weight
reductions/SQL sums and Marathi total labels. Other report files with CSS
`font-weight` are not weight-data consumers. The four report pages with direct
weight-data references are borrower list, account summary, overdue and loading.
No additional existing gross-weight aggregate was found.

## Related individual-weight outputs

- Loading/LTV report has individual gross/fine weight fields, not a gross-weight
  Grand Total. Its backend now uses the same account-aware parser instead of
  stripping text. Existing UI/print/Excel weight fields use two decimals; no new
  totals or columns were introduced.
- Normal, QR-side and QR-center label fields and their previews use the same
  parser/formatter. Invalid selected records prevent preview/printing and expose
  the account-specific message, rather than displaying partial totals or NaN.

## Error propagation

Overdue and loading report routes return HTTP 422 with an account-specific
message for ambiguous weights, within their existing authenticated tenant-scoped
queries. Frontends show an alert and suppress stale report data on error.
Failure to fetch all loading-report export pages aborts the export/print instead
of silently falling back to the current page. Packet validation happens after
account/date/group selection and does not silently omit individual bad records.

## Verification

- Shared arithmetic/parser regression suite and packet-output suite cover
  488.731 → 488.73, duplicate IDs, mixed metals, fine fractional values, account
  errors, packet chunking and source immutability.
- Packet tests exercise the exported real HTML label/print generators.
- API error wiring and stale-data/export guards have source-level regression
  checks; these are not authenticated end-to-end browser tests.
- Authenticated report UI and mobile PDF rendering cannot be visually confirmed
  through the unsigned-in screenshot browser. No auth bypass is introduced.
- The uploaded historical PDF's full underlying loan records are not available
  in this development dataset; no exact corrected total for that historical
  dataset is claimed.
