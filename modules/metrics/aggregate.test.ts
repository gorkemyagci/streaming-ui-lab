import { describe, expect, it } from "vitest";
import { fpsStats, groupRuns, mean, toMarkdownTable, totalBlockingTime, type RunResult } from "./aggregate";

const run = (overrides: Partial<RunResult> = {}): RunResult => ({
  mode: "naive",
  sample: "long",
  chunkSize: 5,
  intervalMs: 20,
  commits: 100,
  totalRenderMs: 200,
  avgRenderMs: 2,
  tbtMs: 50,
  worstInputDelayMs: null,
  worstEventDurationMs: null,
  typed: false,
  avgFps: 60,
  minFps: 55,
  durationMs: 1000,
  ...overrides,
});

describe("mean", () => {
  it("ignores nulls", () => {
    expect(mean([2, null, 4])).toBe(3);
  });
  it("returns null when every value is null", () => {
    expect(mean([null, null])).toBeNull();
  });
});

describe("totalBlockingTime", () => {
  it("sums blocking duration of entries after the run start", () => {
    const entries = [
      { startTime: 5, blockingDuration: 100 },
      { startTime: 10, blockingDuration: 30 },
      { startTime: 20, blockingDuration: 0 },
      { startTime: 30, blockingDuration: 12 },
    ];
    expect(totalBlockingTime(entries, 10)).toBe(42);
  });
});

describe("fpsStats", () => {
  it("computes average and the worst full one-second window", () => {
    // 60 frames in the first second, 30 in the second, 5 in a trailing partial window.
    const frames = [
      ...Array.from({ length: 60 }, (_, i) => i * (1000 / 60)),
      ...Array.from({ length: 30 }, (_, i) => 1000 + i * (1000 / 30)),
      ...Array.from({ length: 5 }, (_, i) => 2000 + i * 50),
    ];
    const { avgFps, minFps } = fpsStats(frames, 0, 2500);
    expect(avgFps).toBeCloseTo(38);
    expect(minFps).toBe(30);
  });

  it("uses the average as the minimum when the run is shorter than a second", () => {
    expect(fpsStats([0, 100, 200], 0, 500)).toEqual({ avgFps: 6, minFps: 6 });
  });

  it("returns nulls for an empty interval", () => {
    expect(fpsStats([], 10, 10)).toEqual({ avgFps: null, minFps: null });
  });
});

describe("groupRuns", () => {
  it("averages runs with the same mode and settings", () => {
    const rows = groupRuns([
      run({ commits: 100, durationMs: 1000 }),
      run({ mode: "throttle", commits: 10 }),
      run({ commits: 200, durationMs: 2000 }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ mode: "naive", n: 2, commits: 150, durationMs: 1500 });
    expect(rows[1]).toMatchObject({ mode: "throttle", n: 1, commits: 10 });
  });

  it("separates different settings for the same mode", () => {
    expect(groupRuns([run(), run({ chunkSize: 10 }), run({ sample: "short" })])).toHaveLength(3);
  });

  it("averages nullable metrics only over runs that have a value", () => {
    const [row] = groupRuns([
      run({ worstInputDelayMs: 40, typed: true }),
      run({ worstInputDelayMs: null }),
      run({ worstInputDelayMs: 20, typed: true }),
    ]);
    expect(row.worstInputDelayMs).toBe(30);
    expect(row.worstEventDurationMs).toBeNull();
    expect(row.typed).toBe(true);
  });
});

describe("toMarkdownTable", () => {
  it("renders a header, separator and one line per row", () => {
    const table = toMarkdownTable(groupRuns([run({ typed: true })]));
    const lines = table.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^\| Mode \| Sample \|/);
    expect(lines[1]).toMatch(/^\| --- \| --- \|/);
    expect(lines[2]).toBe(
      "| naive | long | 5 | 20 | 1 | 100 | 200.0 | 2.00 | 50 | < 16 | < 16 | 60 / 55 | 1000 |",
    );
  });
});
