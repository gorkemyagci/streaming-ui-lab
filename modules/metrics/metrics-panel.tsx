"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { formatInputMetric, formatMs } from "./aggregate";
import type { LiveSnapshot, RunCollector } from "./run-collector";
import { detectSupport, type Support } from "./support";

const REFRESH_MS = 250;
const UNSUPPORTED = "not supported in this browser";

const noopSubscribe = () => () => {};

type Props = {
  collector: RunCollector;
  progress: { current: number; total: number } | null;
};

export function MetricsPanel({ collector, progress }: Props) {
  const support = useSyncExternalStore<Support | null>(noopSubscribe, detectSupport, () => null);
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);

  // Polls on a fixed interval in every mode, so the panel's own cost is the same for all of them.
  useEffect(() => {
    const id = setInterval(() => setSnap(collector.snapshot()), REFRESH_MS);
    return () => clearInterval(id);
  }, [collector]);

  const profilerSilent = snap && !snap.running && snap.durationMs > 0 && snap.commits === 0;

  return (
    <section aria-labelledby="metrics-heading" className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="metrics-heading" className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Live metrics
        </h2>
        {progress && (
          <span className="font-mono text-xs text-zinc-500">
            run {progress.current} / {progress.total}
          </span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <Metric label="Commits" value={snap ? String(snap.commits) : "—"} />
        <Metric label="Render total" value={snap ? `${formatMs(snap.totalRenderMs)} ms` : "—"} />
        <Metric label="Render avg" value={snap ? `${formatMs(snap.avgRenderMs, 2)} ms` : "—"} />
        <Metric
          label="Total blocking time"
          value={support && !support.longAnimationFrame ? UNSUPPORTED : snap ? `${formatMs(snap.tbtMs, 0)} ms` : "—"}
        />
        <Metric
          label="Worst input delay"
          value={
            support && !support.eventTiming
              ? UNSUPPORTED
              : snap
                ? withMs(formatInputMetric(snap.worstInputDelayMs, snap.typed))
                : "—"
          }
        />
        <Metric
          label="Worst event duration"
          value={
            support && !support.eventTiming
              ? UNSUPPORTED
              : snap
                ? withMs(formatInputMetric(snap.worstEventDurationMs, snap.typed))
                : "—"
          }
        />
        <Metric
          label="FPS avg / min"
          value={
            support && !support.animationFrame
              ? UNSUPPORTED
              : snap
                ? `${formatMs(snap.avgFps, 0)} / ${formatMs(snap.minFps, 0)}`
                : "—"
          }
        />
        <Metric label="Stream duration" value={snap ? `${formatMs(snap.durationMs, 0)} ms` : "—"} />
      </dl>

      {profilerSilent && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
          React Profiler reported no commits. Production builds need <code>next build --profile</code> (
          <code>npm run build</code> already passes it).
        </p>
      )}
    </section>
  );
}

function withMs(value: string) {
  return value === "—" ? value : `${value} ms`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="text-right font-mono tabular-nums">{value}</dd>
    </>
  );
}
