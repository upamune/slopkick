import { describe, expect, it } from "vitest";
import { buildStructuredDiff } from "../diff.js";

describe("buildStructuredDiff", () => {
  it("builds replace rows from @pierre/diffs metadata", () => {
    const diff = buildStructuredDiff(
      ["alpha", "old value", "omega"].join("\n") + "\n",
      ["alpha", "new value", "omega"].join("\n") + "\n",
      3,
    );

    expect(diff.additions).toBe(1);
    expect(diff.deletions).toBe(1);
    expect(diff.hunks).toHaveLength(1);
    expect(diff.rows.map((row) => row.kind)).toEqual(["equal", "replace", "equal"]);
    expect(diff.rows[1]).toMatchObject({
      oldLineNumber: 2,
      newLineNumber: 2,
      oldText: "old value",
      newText: "new value",
    });
    expect(diff.rows[1]!.oldHighlights.length).toBeGreaterThan(0);
    expect(diff.rows[1]!.newHighlights.length).toBeGreaterThan(0);
  });

  it("preserves pure insert and delete line numbers", () => {
    const inserted = buildStructuredDiff(
      ["alpha", "omega"].join("\n") + "\n",
      ["alpha", "inserted", "omega"].join("\n") + "\n",
      3,
    );
    const deleted = buildStructuredDiff(
      ["alpha", "removed", "omega"].join("\n") + "\n",
      ["alpha", "omega"].join("\n") + "\n",
      3,
    );

    expect(inserted.rows.map((row) => ({
      kind: row.kind,
      oldLineNumber: row.oldLineNumber,
      newLineNumber: row.newLineNumber,
    }))).toEqual([
      { kind: "equal", oldLineNumber: 1, newLineNumber: 1 },
      { kind: "insert", oldLineNumber: undefined, newLineNumber: 2 },
      { kind: "equal", oldLineNumber: 2, newLineNumber: 3 },
    ]);
    expect(deleted.rows.map((row) => ({
      kind: row.kind,
      oldLineNumber: row.oldLineNumber,
      newLineNumber: row.newLineNumber,
    }))).toEqual([
      { kind: "equal", oldLineNumber: 1, newLineNumber: 1 },
      { kind: "delete", oldLineNumber: 2, newLineNumber: undefined },
      { kind: "equal", oldLineNumber: 3, newLineNumber: 2 },
    ]);
  });
});
