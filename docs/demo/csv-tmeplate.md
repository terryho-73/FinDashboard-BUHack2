# CSV import — canonical template

Scope: manual entry only. Importing creates **virtual** transactions and jar
allocations; it never moves real money.

## File format

- UTF-8, comma-separated, one header row on line 1.
- BOM is tolerated and stripped.
- Column names are case-insensitive; spaces become `_` (`Goal ID` → `goal_id`).
- Unknown extra columns are ignored.
- Recommended limits: ≤ 5,000 data rows, ≤ 2 MB.
- Download the starter file: [`public/templates/transactions-template.csv`](../public/templates/transactions-template.csv)

## Columns

| Column | Required | Format | Example |
|---|---|---|---|
| `date` | yes | `YYYY-MM-DD`, real calendar date, 2000–2100 | `2026-11-01` |
| `title` | yes | 1–120 chars | `Lunch at cha chaan teng` |
| `amount` | yes | Positive HKD number; `HK$`, `$`, `HKD` prefixes and thousands commas tolerated; max 10,000,000; rounded to 2 dp | `58`, `HK$1,200.50` |
| `kind` | yes | `expense` \| `income` \| `saving` | `expense` |
| `category` | no | ≤ 40 chars; defaults to `other` | `food` |
| `channel` | no | `octopus` \| `fps` \| `payme` \| `alipay_hk` \| `credit` \| `cash` \| `bank` \| `other` | `octopus` |
| `goal_id` | for `saving` | Existing jar id | `jar_travel` |
| `recurring` | no | `true/false/1/0/yes/no`; blank = `false` | `true` |

### Rules

- **Amounts are always positive.** Direction comes from `kind`, never from a minus sign.
- `goal_id` is required for `saving` rows and ignored (with a warning) for `expense`/`income`.
- If the importer is given the current jar list, unknown `goal_id` values are rejected.
- Channel aliases are accepted: `Octopus Card`, `PayMe`, `Pay Me`, `Credit Card`, `AlipayHK`, `FPS`, `Bank Transfer`.
- Jar ids are visible in Settings → Download JSON backup (`/api/export`).

### Duplicates

Duplicate key = `date | normalised title | amount | kind | channel | goal_id`
(title lowercased, whitespace collapsed). Re-importing the same file is
idempotent: rows matching an existing transaction, or an earlier row in the
same file, are marked `duplicate` and skipped.

## Row statuses

| Status | Meaning |
|---|---|
| `valid` | Imported |
| `invalid` | Has at least one error; not imported |
| `duplicate` | Matches an existing/same-file transaction; not imported |

## Error codes

| Code | Meaning |
|---|---|
| `file_invalid` | Header row is missing a required column |
| `date_invalid` | Not a real `YYYY-MM-DD` date |
| `title_required` / `title_too_long` | Missing or > 120 chars |
| `amount_required` / `amount_invalid` / `amount_not_positive` / `amount_too_large` | Amount problems |
| `kind_invalid` | Not one of the three kinds |
| `channel_invalid` | Unrecognised payment channel |
| `goal_required` / `goal_unknown` | Saving row without / with an unknown jar |
| `duplicate_row` | Warning — row skipped |

## Out of scope

Transfers between accounts, refunds, card repayments, multi-currency, bank
auto-sync (Octopus/FPS Open API). Refunds/transfers arrive with the Phase B
minor-unit ledger.