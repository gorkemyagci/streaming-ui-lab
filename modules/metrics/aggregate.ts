import type { Mode } from "../renderers/types";
import type { SampleId } from "../stream/samples";

export type RunMetrics = {
  commits: number;
  totalRenderMs: number;
  avgRenderMs: number | null;
  /** null when long-animation-frame is not supported. */
  tbtMs: number | null;
  /** null when Event Timing is unsupported or nothing was reported above the 16 ms threshold. */
  worstInputDelayMs: number | null;
  worstEventDurationMs: number | null;
  typed: boolean;
  avgFps: number | null;
  minFps: number | null;
  durationMs: number;
};

export type RunSettings = {
  mode: Mode;
  sample: SampleId;
  chunkSize: number;
  intervalMs: number;
};

export type RunResult = RunSettings & RunMetrics;

export type AveragedRow = RunSettings & {
  n: number;
  commits: number;
  totalRenderMs: number;
  avgRenderMs: number | null;
  tbtMs: number | null;
  worstInputDelayMs: number | null;
  worstEventDurationMs: number | null;
  typed: boolean;
  avgFps: number | null;
  minFps: number | null;
  durationMs: number;
};

/** Mean of the non-null values; null when there are none. */
export function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

export function totalBlockingTime(entries: { startTime: number; blockingDuration: number }[], since: number) {
  return entries.reduce((sum, e) => (e.startTime >= since ? sum + e.blockingDuration : sum), 0);
}

/** Average FPS over [start, end] and the lowest FPS in any full one-second window. */
export function fpsStats(frames: number[], start: number, end: number) {
  const elapsed = end - start;
  if (elapsed <= 0) return { avgFps: null, minFps: null };

  const avgFps = (frames.length * 1000) / elapsed;
  const fullWindows = Math.floor(elapsed / 1000);
  if (fullWindows === 0) return { avgFps, minFps: avgFps };

  const counts = new Array<number>(fullWindows).fill(0);
  for (const t of frames) {
    const i = Math.floor((t - start) / 1000);
    if (i >= 0 && i < fullWindows) counts[i]++;
  }
  return { avgFps, minFps: Math.min(...counts) };
}

const settingsKey = (r: RunSettings) => `${r.mode}|${r.sample}|${r.chunkSize}|${r.intervalMs}`;

/** One row per mode and settings combination, metrics averaged over its runs. */
export function groupRuns(runs: RunResult[]): AveragedRow[] {
  const groups = new Map<string, RunResult[]>();
  for (const run of runs) {
    const key = settingsKey(run);
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }

  return [...groups.values()].map((group) => {
    const pick = (k: keyof RunMetrics) => mean(group.map((r) => r[k] as number | null));
    const { mode, sample, chunkSize, intervalMs } = group[0];
    return {
      mode,
      sample,
      chunkSize,
      intervalMs,
      n: group.length,
      commits: pick("commits") ?? 0,
      totalRenderMs: pick("totalRenderMs") ?? 0,
      avgRenderMs: pick("avgRenderMs"),
      tbtMs: pick("tbtMs"),
      worstInputDelayMs: pick("worstInputDelayMs"),
      worstEventDurationMs: pick("worstEventDurationMs"),
      typed: group.some((r) => r.typed),
      avgFps: pick("avgFps"),
      minFps: pick("minFps"),
      durationMs: pick("durationMs") ?? 0,
    };
  });
}

export function formatMs(value: number | null, digits = 1) {
  return value === null ? "—" : value.toFixed(digits);
}

/** Event Timing only reports entries of 16 ms or more, so typing without entries means "under 16". */
export function formatInputMetric(value: number | null, typed: boolean) {
  if (value !== null) return value.toFixed(1);
  return typed ? "< 16" : "—";
}

export const TABLE_COLUMNS = [
  "Mode",
  "Sample",
  "Chunk",
  "Interval (ms)",
  "n",
  "Commits",
  "Render total (ms)",
  "Render avg (ms)",
  "TBT (ms)",
  "Worst input delay (ms)",
  "Worst event duration (ms)",
  "FPS avg / min",
  "Duration (ms)",
] as const;

export function rowCells(row: AveragedRow): string[] {
  return [
    row.mode,
    row.sample,
    String(row.chunkSize),
    String(row.intervalMs),
    String(row.n),
    row.commits.toFixed(0),
    formatMs(row.totalRenderMs),
    formatMs(row.avgRenderMs, 2),
    formatMs(row.tbtMs, 0),
    formatInputMetric(row.worstInputDelayMs, row.typed),
    formatInputMetric(row.worstEventDurationMs, row.typed),
    `${formatMs(row.avgFps, 0)} / ${formatMs(row.minFps, 0)}`,
    formatMs(row.durationMs, 0),
  ];
}

export function toMarkdownTable(rows: AveragedRow[]): string {
  const line = (cells: readonly string[]) => `| ${cells.join(" | ")} |`;
  return [
    line(TABLE_COLUMNS),
    line(TABLE_COLUMNS.map(() => "---")),
    ...rows.map((row) => line(rowCells(row))),
  ].join("\n");
}
