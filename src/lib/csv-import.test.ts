import { describe, expect, it } from "vitest";
import { analyzeCsv, duplicateKey, existingKeysFrom } from "./csv-import";

const HEADER = "date,title,amount,kind,category,channel,goal_id,recurring";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("analyzeCsv — happy path", () => {
  it("accepts a valid file and builds a payload", () => {
    const text = csv(
      "2026-11-01,Lunch,58,expense,food,octopus,,false",
      "2026-11-02,Salary,20000,income,salary,bank,,false",
      "2026-11-03,Travel top-up,500,saving,travel,fps,jar_travel,false",
    );
    const result = analyzeCsv(text, { existingGoalIds: ["jar_travel"] });

    expect(result.missingColumns).toEqual([]);
    expect(result.parseErrors).toEqual([]);
    expect(result.summary).toMatchObject({ total: 3, valid: 3, invalid: 0, duplicate: 0 });
    expect(result.payload).toHaveLength(3);
    expect(result.payload[2]).toMatchObject({
      kind: "saving",
      goal_id: "jar_travel",
      source: "csv",
    });
  });

  it("tolerates BOM and CRLF line endings", () => {
    const text = `\uFEFFdate,title,amount,kind\r\n2026-11-01,Lunch,58,expense\r\n`;
    const result = analyzeCsv(text);
    expect(result.summary.valid).toBe(1);
    expect(result.payload[0]).toMatchObject({ title: "Lunch", amount: 58 });
  });

  it("defaults category to 'other' and recurring to false", () => {
    const result = analyzeCsv(csv("2026-11-01,Lunch,58,expense,,,, "));
    expect(result.payload[0]).toMatchObject({ category: "other", recurring: false, channel: null });
  });
});

describe("analyzeCsv — file-level problems", () => {
  it("reports a missing required column and imports nothing", () => {
    const text = ["date,title,amount", "2026-11-01,Lunch,58"].join("\n");
    const result = analyzeCsv(text);

    expect(result.missingColumns).toEqual(["kind"]);
    expect(result.payload).toHaveLength(0);
    expect(result.summary.invalid).toBe(1);
    expect(result.rows[0].issues[0].code).toBe("file_invalid");
  });

  it("refuses files above the row limit", () => {
    const text = csv(
      "2026-11-01,A,1,expense",
      "2026-11-02,B,1,expense",
      "2026-11-03,C,1,expense",
    );
    const result = analyzeCsv(text, { maxRows: 2 });

    expect(result.payload).toHaveLength(0);
    expect(result.parseErrors.some((e) => e.includes("limit"))).toBe(true);
  });
});

describe("analyzeCsv — field validation", () => {
  it("rejects impossible calendar dates", () => {
    const result = analyzeCsv(csv("2026-02-30,Lunch,58,expense"));
    expect(result.rows[0].status).toBe("invalid");
    expect(result.rows[0].issues.map((i) => i.code)).toContain("date_invalid");
  });

  it("rejects non-ISO dates", () => {
    const result = analyzeCsv(csv("01/11/2026,Lunch,58,expense"));
    expect(result.rows[0].issues.map((i) => i.code)).toContain("date_invalid");
  });

  it("accepts currency prefixes and thousands separators in amounts", () => {
    const result = analyzeCsv(csv("2026-11-01,Rent,HK$1,200.50,expense"));
    expect(result.payload[0].amount).toBe(1200.5);
  });

  it("rejects zero, negative and non-numeric amounts", () => {
    const result = analyzeCsv(
      csv(
        "2026-11-01,Zero,0,expense",
        "2026-11-02,Negative,-5,expense",
        "2026-11-03,Words,abc,expense",
      ),
    );
    const codes = result.rows.flatMap((r) => r.issues.map((i) => i.code));
    expect(codes).toEqual(
      expect.arrayContaining(["amount_not_positive", "amount_invalid"]),
    );
    expect(result.summary.valid).toBe(0);
  });

  it("rejects unknown kinds", () => {
    const result = analyzeCsv(csv("2026-11-01,Lunch,58,spending"));
    expect(result.rows[0].issues.map((i) => i.code)).toContain("kind_invalid");
  });

  it("requires goal_id for saving rows", () => {
    const result = analyzeCsv(csv("2026-11-01,Top up,500,saving,travel,fps,"));
    expect(result.rows[0].issues.map((i) => i.code)).toContain("goal_required");
  });

  it("rejects saving rows pointing at an unknown jar", () => {
    const result = analyzeCsv(csv("2026-11-01,Top up,500,saving,travel,fps,jar_missing"), {
      existingGoalIds: ["jar_travel"],
    });
    expect(result.rows[0].issues.map((i) => i.code)).toContain("goal_unknown");
  });

  it("ignores goal_id on non-saving rows with a warning", () => {
    const result = analyzeCsv(csv("2026-11-01,Lunch,58,expense,food,octopus,jar_travel"));
    expect(result.rows[0].status).toBe("valid");
    expect(result.payload[0].goal_id).toBeNull();
    expect(result.rows[0].issues.map((i) => i.code)).toContain("goal_ignored");
  });
});

describe("analyzeCsv — channels", () => {
  it("normalises aliases", () => {
    const result = analyzeCsv(
      csv(
        "2026-11-01,A,1,expense,food,PayMe",
        "2026-11-02,B,1,expense,food,Credit Card",
        "2026-11-03,C,1,expense,food,AlipayHK",
        "2026-11-04,D,1,expense,food,octopus card",
      ),
    );
    expect(result.payload.map((t) => t.channel)).toEqual([
      "payme",
      "credit",
      "alipay_hk",
      "octopus",
    ]);
  });

  it("rejects unknown channels", () => {
    const result = analyzeCsv(csv("2026-11-01,Lunch,58,expense,food,crypto"));
    expect(result.rows[0].issues.map((i) => i.code)).toContain("channel_invalid");
  });
});

describe("analyzeCsv — duplicates", () => {
  it("flags the second identical row inside the same file", () => {
    const result = analyzeCsv(
      csv(
        "2026-11-01,Lunch,58,expense,food,octopus",
        "2026-11-01,Lunch,58,expense,food,octopus",
      ),
    );
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[1].status).toBe("duplicate");
    expect(result.payload).toHaveLength(1);
  });

  it("flags rows already present in the collection", () => {
    const existing = existingKeysFrom([
      { date: "2026-11-01", title: "Lunch", amount: 58, kind: "expense", channel: "octopus" },
    ]);
    const result = analyzeCsv(csv("2026-11-01,lunch,58.00,expense,food,octopus"), {
      existingKeys: existing,
    });

    expect(result.rows[0].status).toBe("duplicate");
    expect(result.payload).toHaveLength(0);
  });
});

describe("duplicateKey / existingKeysFrom", () => {
  it("normalises title casing and whitespace", () => {
    const a = duplicateKey({
      date: "2026-11-01",
      title: "  Lunch   at   work ",
      amount: 58,
      kind: "expense",
      channel: "octopus",
      goal_id: null,
    });
    const b = duplicateKey({
      date: "2026-11-01",
      title: "lunch at work",
      amount: 58,
      kind: "expense",
      channel: "octopus",
    });
    expect(a).toBe(b);
  });

  it("skips transactions with an unknown kind", () => {
    const keys = existingKeysFrom([
      { date: "2026-11-01", title: "Refund", amount: 58, kind: "refund" },
    ]);
    expect(keys.size).toBe(0);
  });
});