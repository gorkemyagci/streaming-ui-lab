"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type StreamStatus = "idle" | "streaming" | "done";

export type StreamTiming = { startedAt: number; endedAt: number };

type Options = {
  source: string;
  chunkSize?: number;
  intervalMs?: number;
  /** When set, chunks are buffered in a ref and committed to state every `flushMs`. */
  flushMs?: number;
  onDone?: (timing: StreamTiming) => void;
};

export function useFakeStream({
  source,
  chunkSize = 5,
  intervalMs = 20,
  flushMs,
  onDone,
}: Options) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");

  const cursorRef = useRef(0);
  const bufferRef = useRef("");
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const clearTimers = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (flushRef.current) clearInterval(flushRef.current);
    tickRef.current = null;
    flushRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (!bufferRef.current) return;
    const pending = bufferRef.current;
    bufferRef.current = "";
    setText((prev) => prev + pending);
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    cursorRef.current = 0;
    bufferRef.current = "";
    setText("");
    setStatus("idle");
  }, [clearTimers]);

  const start = useCallback(() => {
    reset();
    startedAtRef.current = performance.now();
    setStatus("streaming");

    tickRef.current = setInterval(() => {
      const chunk = source.slice(cursorRef.current, cursorRef.current + chunkSize);
      cursorRef.current += chunk.length;

      if (flushMs === undefined) {
        setText((prev) => prev + chunk);
      } else {
        bufferRef.current += chunk;
      }

      if (cursorRef.current >= source.length) {
        clearTimers();
        // Commit the tail immediately instead of waiting for the next flush tick.
        flush();
        setStatus("done");
        onDoneRef.current?.({
          startedAt: startedAtRef.current,
          endedAt: performance.now(),
        });
      }
    }, intervalMs);

    if (flushMs !== undefined) {
      flushRef.current = setInterval(flush, flushMs);
    }
  }, [source, chunkSize, intervalMs, flushMs, reset, clearTimers, flush]);

  useEffect(() => clearTimers, [clearTimers]);

  return { text, status, start, reset };
}
