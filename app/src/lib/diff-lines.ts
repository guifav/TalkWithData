/**
 * Minimal line-by-line LCS diff. Outputs an array of segments that an
 * UI can render side-by-side or unified.
 *
 * No external deps — diff is small enough (prompts are typically
 * a few hundred lines) that an O(N*M) LCS is fine.
 */

export type DiffSegment =
  | { type: "equal"; line: string; oldNum: number; newNum: number }
  | { type: "remove"; line: string; oldNum: number }
  | { type: "add"; line: string; newNum: number };

export function diffLines(oldText: string, newText: string): DiffSegment[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS length table.
  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  // Walk the table to emit segments.
  const out: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      out.push({
        type: "equal",
        line: oldLines[i],
        oldNum: i + 1,
        newNum: j + 1,
      });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: "remove", line: oldLines[i], oldNum: i + 1 });
      i++;
    } else {
      out.push({ type: "add", line: newLines[j], newNum: j + 1 });
      j++;
    }
  }
  while (i < m) {
    out.push({ type: "remove", line: oldLines[i], oldNum: i + 1 });
    i++;
  }
  while (j < n) {
    out.push({ type: "add", line: newLines[j], newNum: j + 1 });
    j++;
  }
  return out;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export function diffStats(segments: DiffSegment[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const s of segments) {
    if (s.type === "add") added++;
    else if (s.type === "remove") removed++;
    else unchanged++;
  }
  return { added, removed, unchanged };
}
