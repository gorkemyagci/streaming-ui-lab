"use client";

import { memo, Profiler, useEffect } from "react";
import type { RunCollector } from "../metrics/run-collector";
import { RENDERERS } from "../renderers/renderer-for-mode";
import { MODES, type Mode } from "../renderers/types";
import { useFakeStream, type StreamTiming } from "../stream/use-fake-stream";

export type LaneRun = {
  mode: Mode;
  source: string;
  chunkSize: number;
  intervalMs: number;
};

type Props = {
  run: LaneRun;
  collector: RunCollector;
  onDone: (timing: StreamTiming) => void;
};

// Memoized with stable props so parent re-renders never add commits to a run.
export const StreamLane = memo(function StreamLane({ run, collector, onDone }: Props) {
  return (
    <Profiler id={run.mode} onRender={collector.onRender}>
      <LaneBody run={run} onDone={onDone} />
    </Profiler>
  );
});

function LaneBody({ run, onDone }: { run: LaneRun; onDone: Props["onDone"] }) {
  const { text, status, start } = useFakeStream({
    source: run.source,
    chunkSize: run.chunkSize,
    intervalMs: run.intervalMs,
    flushMs: MODES[run.mode].flushMs,
    onDone,
  });

  // The lane is keyed per run, so this starts exactly one stream per mount.
  useEffect(() => {
    start();
  }, [start]);

  const Renderer = RENDERERS[run.mode];
  return <Renderer text={text} streaming={status === "streaming"} />;
}
