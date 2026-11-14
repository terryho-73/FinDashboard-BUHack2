/**
 * Pure CSV import core for PocketGoals HK / Savings Jars HK.
 *
 * No React, no DOM, no network — safe to unit-test and to reuse later for
 * server-side revalidation (PLAN.md §9: "server revalidation, idempotent confirm").
 *
 * Usage:
 *   const analysis = analyzeCsv(text, {
 *     existingKeys: existingKeysFrom(transactions),
 *     existingGoalIds: goals.map((g) => g.id),
 *   });
 *   analysis.payload // TransactionInput[] ready for useCollection create()
 */
export const KINDS = ["expense", "income", "saving"] as const;
export type Kind = (typeof KINDS)[number];

export const CHANNELS = [
  "octopus",
  "fps",
  "payme",
  "alipay_hk",
  "credit",
  "cash",
  "bank",
  "other",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const CSV_COLUMNS = [
  "date",
  "title",
  "amount",
  "kind",
  "category",
  "channel",
  "goal_id",
  "recurring",
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

export const MAX_ROWS = 5000;
export const MAX_AMOUNT = 10_000_000;
export const MAX_TITLE_LENGTH = 120;
export const MAX_CATEGORY_LENGTH = 40;
export const DEFAULT_CATEGORY = "other";

const REQUIRED_COLUMNS: readonly CsvColumn[] = ["date", "title", "amount", "kind"];
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const CHANNEL_ALIASES: Record<string, Channel> = {
  octopus: "octopus",
  octopus_card: "octopus",
  fps: "fps",
  faster_payment_system: "fps",
  payme: "payme",
  pay_me: "payme",
  alipay: "alipay_hk",
  alipayhk: "alipay_hk",
  alipay_hk: "alipay_hk",
  credit: "credit",
  credit_card: "credit",
  card: "credit",
  cash: "cash",
  bank: "bank",
  bank_transfer: "bank",
  other: "other",
};

const TRUE_VALUES = new Set(["true", "1", "yes", "y", "t"]);
const FALSE_VALUES = new Set(["false", "0", "no", "n", "f", ""]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransactionInput {
  date: string;
  title: string;
  amount: number;
  kind: Kind;
  category: string;
  channel: Channel | null;
  goal_id: string | null;
  recurring: boolean;
  source: "csv";
}

export type IssueLevel = "error" | "warning";

export interface RowIssue {
  field: string;
  code: string;
  level: IssueLevel;
  message: string;
}

export type ImportRowStatus = "valid" | "invalid" | "duplicate";

export interface RawCsvRow {
  /** 1-based data row number, header excluded. */
  index: number;
  raw: Record<string, string>;
}

export interface ImportRow extends RawCsvRow {
  status: ImportRowStatus;
  issues: RowIssue[];
  key?: string;
  transaction?: TransactionInput;
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  warnings: number;
}

export interface ParsedCsv {
  headers: string[];
  rows: RawCsvRow[];
  errors: string[];
}

export interface ImportOptions {
  /** Keys from existing transactions — see `existingKeysFrom`. */
  existingKeys?: Iterable<string>;
  /** Current jar ids; when supplied, unknown goal ids are rejected. */
  existingGoalIds?: Iterable<string>;
  /** Override for tests; defaults to MAX_ROWS. */
  maxRows?: number;
}

export interface ImportAnalysis {
  headers: string[];
  missingColumns: CsvColumn[];
  parseErrors: string[];
  rows: ImportRow[];
  summary: ImportSummary;
  /** Valid, non-duplicate rows, ready to persist. */
  payload: TransactionInput[];
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export interface DuplicateKeyInput {
  date: string;
  title: string;
  amount: number;
  kind: string;
  channel?: string | null;
  goal_id?: string | null;
}

/** Stable, human-inspectable identity for a transaction. */
export function duplicateKey(tx: DuplicateKeyInput): string {
  const title = tx.title.trim().toLowerCase().replace(/\s+/g, " ");
  return [
    tx.date,
    title,
    tx.amount.toFixed(2),
    tx.kind,
    tx.channel ?? "",
    tx.goal_id ?? "",
  ].join("|");
}

export interface ExistingTransactionLike {
  date: string;
  title: string;
  amount: number;
  kind: string;
  channel?: string | null;
  goal_id?: string | null;
}

/** Build the `existingKeys` set from the current transactions collection. */
export function existingKeysFrom(
  transactions: ReadonlyArray<ExistingTransactionLike>,
): Set<string> {
  const keys = new Set<string>();
  for (const tx of transactions) {
    if (!isKind(tx.kind)) continue;
    keys.add(duplicateKey(tx));
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Lightweight CSV parser (no papaparse dependency — avoids blank app if package is missing). */
export function parseCsvText(text: string): ParsedCsv {
  const errors: string[] = [];
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ["File is empty"] };
  }

  const headerCells = splitCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_"),
  );
  const rows: RawCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    headerCells.forEach((h, idx) => {
      raw[h] = (cells[idx] ?? "").trim();
    });
    rows.push({ index: i, raw });
  }

  return { headers: headerCells, rows, errors };
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export function analyzeCsv(text: string, options: ImportOptions = {}): ImportAnalysis {
  const maxRows = options.maxRows ?? MAX_ROWS;
  const parsed = parseCsvText(text);
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !parsed.headers.includes(c));

  const parseErrors = [...parsed.errors];
  if (parsed.rows.length > maxRows) {
    parseErrors.push(`File has ${parsed.rows.length} rows; the limit is ${maxRows}.`);
  }

  const overLimit = parsed.rows.length > maxRows;
  const knownGoals = options.existingGoalIds
    ? new Set(options.existingGoalIds)
    : null;
  const seen = new Set<string>(options.existingKeys ?? []);

  const rows: ImportRow[] = [];
  const payload: TransactionInput[] = [];
  let warnings = 0;

  for (const { index, raw } of parsed.rows) {
    let row: ImportRow;

    if (overLimit) {
      row = fileInvalid(index, raw, `File exceeds the ${maxRows}-row limit.`);
    } else if (missingColumns.length > 0) {
      row = fileInvalid(
        index,
        raw,
        `Missing required column(s): ${missingColumns.join(", ")}.`,
      );
    } else {
      row = analyzeRow(index, raw, knownGoals, seen);
    }

    warnings += row.issues.filter((i) => i.level === "warning").length;
    if (row.status === "valid" && row.transaction) payload.push(row.transaction);
    rows.push(row);
  }

  const summary: ImportSummary = {
    total: rows.length,
    valid: rows.filter((r) => r.status === "valid").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    warnings,
  };

  return { headers: parsed.headers, missingColumns, parseErrors, rows, summary, payload };
}

// ---------------------------------------------------------------------------
// Row-level validation
// ---------------------------------------------------------------------------

function analyzeRow(
  index: number,
  raw: Record<string, string>,
  knownGoals: Set<string> | null,
  seen: Set<string>,
): ImportRow {
  const get = (key: string): string => (raw[key] ?? "").trim();
  const issues: RowIssue[] = [];

  const date = parseDate(get("date"));
  if (date === null) {
    issues.push(error("date", "date_invalid", "Date must be a real calendar date in YYYY-MM-DD format."));
  }

  const title = get("title").replace(/\s+/g, " ");
  if (!title) {
    issues.push(error("title", "title_required", "Title is required."));
  } else if (title.length > MAX_TITLE_LENGTH) {
    issues.push(error("title", "title_too_long", `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`));
  }

  const amount = parseAmount(get("amount"));
  if (amount.issue) issues.push(amount.issue);

  const kindRaw = get("kind").toLowerCase();
  const kind = isKind(kindRaw) ? kindRaw : null;
  if (kind === null) {
    issues.push(error("kind", "kind_invalid", `Kind must be one of: ${KINDS.join(", ")}.`));
  }

  const categoryRaw = get("category");
  const category = categoryRaw ? categoryRaw.slice(0, MAX_CATEGORY_LENGTH) : DEFAULT_CATEGORY;
  if (categoryRaw.length > MAX_CATEGORY_LENGTH) {
    issues.push(warning("category", "category_truncated", `Category truncated to ${MAX_CATEGORY_LENGTH} characters.`));
  }

  let channel: Channel | null = null;
  const channelRaw = get("channel");
  if (channelRaw) {
    const normalised = normaliseChannel(channelRaw);
    if (normalised === null) {
      issues.push(error("channel", "channel_invalid", `Channel must be one of: ${CHANNELS.join(", ")}.`));
    } else {
      channel = normalised;
    }
  }

  let goalId: string | null = null;
  const goalRaw = get("goal_id");
  if (kind === "saving") {
    if (!goalRaw) {
      issues.push(error("goal_id", "goal_required", "goal_id is required for saving transactions."));
    } else if (knownGoals && !knownGoals.has(goalRaw)) {
      issues.push(error("goal_id", "goal_unknown", `No jar found with id "${goalRaw}".`));
    } else {
      goalId = goalRaw;
    }
  } else if (kind !== null && goalRaw) {
    issues.push(warning("goal_id", "goal_ignored", "goal_id is only used for saving transactions; it was ignored."));
  }

  const recurring = parseBoolean(get("recurring"));
  if (recurring === null) {
    issues.push(warning("recurring", "recurring_invalid", "Recurring must be true/false; defaulting to false."));
  }

  const hasErrors = issues.some((i) => i.level === "error");
  if (hasErrors || date === null || !title || kind === null || amount.value === null) {
    return { index, raw, status: "invalid", issues };
  }

  const transaction: TransactionInput = {
    date,
    title,
    amount: amount.value,
    kind,
    category,
    channel,
    goal_id: goalId,
    recurring: recurring ?? false,
    source: "csv",
  };

  const key = duplicateKey(transaction);
  if (seen.has(key)) {
    return {
      index,
      raw,
      status: "duplicate",
      key,
      issues: [...issues, warning("row", "duplicate_row", "Matches an existing transaction; row skipped.")],
    };
  }

  seen.add(key);
  return { index, raw, status: "valid", key, issues, transaction };
}

function fileInvalid(index: number, raw: Record<string, string>, message: string): ImportRow {
  return {
    index,
    raw,
    status: "invalid",
    issues: [error("", "file_invalid", message)],
  };
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

function parseDate(input: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return input;
}

function parseAmount(input: string): { value: number | null; issue: RowIssue | null } {
  const cleaned = input.replace(/[\s,]/g, "").replace(/^(hk\$|hkd|\$)/i, "");
  if (!cleaned) {
    return { value: null, issue: error("amount", "amount_required", "Amount is required.") };
  }
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { value: null, issue: error("amount", "amount_invalid", `"${input}" is not a number.`) };
  }
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return { value: null, issue: error("amount", "amount_invalid", `"${input}" is not a number.`) };
  }
  if (parsed <= 0) {
    return {
      value: null,
      issue: error("amount", "amount_not_positive", "Amount must be greater than zero; use kind=expense instead of a negative value."),
    };
  }
  if (parsed > MAX_AMOUNT) {
    return { value: null, issue: error("amount", "amount_too_large", `Amount must not exceed ${MAX_AMOUNT}.`) };
  }
  return { value: Math.round(parsed * 100) / 100, issue: null };
}

function parseBoolean(input: string): boolean | null {
  const value = input.trim().toLowerCase();
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;
  return null;
}

function normaliseChannel(input: string): Channel | null {
  const key = input.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return CHANNEL_ALIASES[key] ?? (isChannel(key) ? key : null);
}

function error(field: string, code: string, message: string): RowIssue {
  return { field, code, level: "error", message };
}

function warning(field: string, code: string, message: string): RowIssue {
  return { field, code, level: "warning", message };
}