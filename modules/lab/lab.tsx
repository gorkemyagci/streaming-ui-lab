"use client";

import { useCallback, useRef, useState } from "react";
import type { RunResult, RunSettings } from "../metrics/aggregate";
import { MetricsPanel } from "../metrics/metrics-panel";
import { RunCollector } from "../metrics/run-collector";
import { MODE_IDS, MODES, type Mode } from "../renderers/types";
import { SAMPLES } from "../stream/samples";
import type { StreamTiming } from "../stream/use-fake-stream";
import { Controls, type Settings } from "./controls";
import { ProbeInput } from "./probe-input";
import { ResultsTable } from "./results-table";
import { StreamLane, type LaneRun } from "./stream-lane";

const PAUSE_BETWEEN_RUNS_MS = 500;

export function Lab() {
  const [collector] = useState(() => new RunCollector());
  const [mode, setMode] = useState<Mode>("naive");
  const [settings, setSettings] = useState<Settings>({ sample: "long", chunkSize: 5, intervalMs: 20, runsPerMode: 3 });
  const [lane, setLane] = useState<{ id: number; run: LaneRun } | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const queueRef = useRef<RunSettings[]>([]);
  const totalRef = useRef(0);
  const currentRef = useRef<RunSettings | null>(null);
  const laneIdRef = useRef(0);
  // Bumped on every new batch and on reset, so late results from an aborted run are dropped.
  const batchRef = useRef(0);
  const pauseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      currentRef.current = null;
      setRunning(false);
      return;
    }
    currentRef.current = next;
    setProgress({ current: totalRef.current - queueRef.current.length, total: totalRef.current });
    collector.begin();
    setLane({
      id: ++laneIdRef.current,
      run: { mode: next.mode, source: SAMPLES[next.sample], chunkSize: next.chunkSize, intervalMs: next.intervalMs },
    });
    setAnnouncement("Response streaming");
  }, [collector]);

  const handleDone = useCallback(
    async (timing: StreamTiming) => {
      const batch = batchRef.current;
      const settled = currentRef.current;
      collector.markStreamDone(timing);
      setAnnouncement("Response ready");

      const metrics = await collector.end();
      if (batch !== batchRef.current || !settled) return;

      setRuns((prev) => [...prev, { ...settled, ...metrics }]);
      if (queueRef.current.length === 0) {
        currentRef.current = null;
        setRunning(false);
      } else {
        pauseRef.current = setTimeout(startNext, PAUSE_BETWEEN_RUNS_MS);
      }
    },
    [collector, startNext],
  );

  const startBatch = (queue: RunSettings[]) => {
    batchRef.current++;
    queueRef.current = queue;
    totalRef.current = queue.length;
    setRunning(true);
    startNext();
  };

  const base = { sample: settings.sample, chunkSize: settings.chunkSize, intervalMs: settings.intervalMs };

  const runOne = () => startBatch([{ mode, ...base }]);

  // Round-robin (A B C D, A B C D, ...) so warm-up does not land on one mode.
  const runAll = () =>
    startBatch(
      Array.from({ length: settings.runsPerMode }, () => MODE_IDS.map((m) => ({ mode: m, ...base }))).flat(),
    );

  const reset = () => {
    batchRef.current++;
    if (pauseRef.current) clearTimeout(pauseRef.current);
    queueRef.current = [];
    currentRef.current = null;
    collector.clear();
    setLane(null);
    setRunning(false);
    setProgress(null);
    setAnnouncement("");
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">streaming-ui-lab</h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
          Four ways to render a streamed LLM markdown response, measured live on this page. Run a mode, type in the
          probe input while it streams, and compare the numbers.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Controls
            mode={mode}
            settings={settings}
            running={running}
            onModeChange={setMode}
            onSettingsChange={setSettings}
            onRun={runOne}
            onRunAll={runAll}
            onReset={reset}
          />
          <ProbeInput collector={collector} />

          <section aria-labelledby="output-heading" className="flex flex-col gap-2">
            <h2 id="output-heading" className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Output{lane && ` · ${MODES[lane.run.mode].label}`}
            </h2>
            <div
              role="log"
              aria-live="off"
              aria-label="Streamed response"
              className="prose prose-zinc min-h-64 max-w-none rounded-lg border border-zinc-200 p-5 dark:prose-invert dark:border-zinc-800"
            >
              {lane ? (
                <StreamLane key={lane.id} run={lane.run} collector={collector} onDone={handleDone} />
              ) : (
                <p className="text-zinc-500">Press Run to start streaming.</p>
              )}
            </div>
            <p role="status" aria-live="polite" className="sr-only">
              {announcement}
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <MetricsPanel collector={collector} progress={progress} />
        </aside>
      </div>

      <ResultsTable runs={runs} />
    </div>
  );
}
