import type { ProfilerOnRenderCallback } from "react";
import type { StreamTiming } from "../stream/use-fake-stream";
import { fpsStats, totalBlockingTime, type RunMetrics } from "./aggregate";
import { detectSupport } from "./support";

const SETTLE_MS = 300;

type LoafEntry = PerformanceEntry & { blockingDuration: number };

export type LiveSnapshot = RunMetrics & { running: boolean };

/**
 * Collects metrics for one run at a time. Everything lives in plain fields,
 * never in React state, so measuring a run does not cause extra renders.
 */
export class RunCollector {
  private active = false;
  private commits = 0;
  private totalRenderMs = 0;
  private loafEntries: LoafEntry[] = [];
  private worstInputDelayMs: number | null = null;
  private worstEventDurationMs: number | null = null;
  private typed = false;
  private frames: number[] = [];
  private beganAt = 0;
  private framesEndedAt: number | null = null;
  private streamDurationMs: number | null = null;
  private observers: { observer: PerformanceObserver; handle: (entries: PerformanceEntryList) => void }[] = [];
  private rafId: number | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private probe: HTMLElement | null = null;

  onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    if (!this.active) return;
    this.commits++;
    this.totalRenderMs += actualDuration;
  };

  /** Ref callback for the uncontrolled probe input. */
  setProbe = (el: HTMLElement | null) => {
    this.probe?.removeEventListener("keydown", this.onProbeKeyDown);
    this.probe = el;
    el?.addEventListener("keydown", this.onProbeKeyDown);
  };

  private onProbeKeyDown = () => {
    if (this.active) this.typed = true;
  };

  begin() {
    this.abort();
    this.active = true;
    this.commits = 0;
    this.totalRenderMs = 0;
    this.loafEntries = [];
    this.worstInputDelayMs = null;
    this.worstEventDurationMs = null;
    this.typed = false;
    this.frames = [];
    this.beganAt = performance.now();
    this.framesEndedAt = null;
    this.streamDurationMs = null;

    const support = detectSupport();
    if (support.longAnimationFrame) {
      this.observe({ type: "long-animation-frame", buffered: false }, this.handleLoaf);
    }
    if (support.eventTiming) {
      this.observe({ type: "event", durationThreshold: 16, buffered: false } as PerformanceObserverInit, this.handleEvents);
    }
    if (support.animationFrame) {
      const loop = (t: number) => {
        this.frames.push(t);
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }
  }

  /** Called when the stream finishes. FPS stops here; observers keep running until `end()` settles. */
  markStreamDone({ startedAt, endedAt }: StreamTiming) {
    this.streamDurationMs = endedAt - startedAt;
    this.framesEndedAt = endedAt;
    this.stopFrames();
  }

  /** Waits for late LoAF and event entries, then stops collecting and returns the final metrics. */
  end(): Promise<RunMetrics> {
    return new Promise((resolve) => {
      this.settleTimer = setTimeout(() => {
        this.settleTimer = null;
        for (const { observer, handle } of this.observers) handle(observer.takeRecords());
        const metrics = this.snapshot()!;
        this.abort();
        resolve(metrics);
      }, SETTLE_MS);
    });
  }

  /** Stops collecting and forgets the run, so the panel goes back to empty. */
  clear() {
    this.abort();
    this.beganAt = 0;
  }

  abort() {
    this.active = false;
    this.stopFrames();
    for (const { observer } of this.observers) observer.disconnect();
    this.observers = [];
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = null;
  }

  /** null until a run has started (or after `clear()`). */
  snapshot(): LiveSnapshot | null {
    if (!this.beganAt) return null;
    const support = detectSupport();
    const now = performance.now();
    const fps = support.animationFrame
      ? fpsStats(this.frames, this.beganAt, this.framesEndedAt ?? now)
      : { avgFps: null, minFps: null };
    return {
      running: this.active,
      commits: this.commits,
      totalRenderMs: this.totalRenderMs,
      avgRenderMs: this.commits ? this.totalRenderMs / this.commits : null,
      tbtMs: support.longAnimationFrame ? totalBlockingTime(this.loafEntries, this.beganAt) : null,
      worstInputDelayMs: this.worstInputDelayMs,
      worstEventDurationMs: this.worstEventDurationMs,
      typed: this.typed,
      ...fps,
      durationMs: this.streamDurationMs ?? now - this.beganAt,
    };
  }

  private observe(init: PerformanceObserverInit, handle: (entries: PerformanceEntryList) => void) {
    const observer = new PerformanceObserver((list) => handle(list.getEntries()));
    observer.observe(init);
    this.observers.push({ observer, handle });
  }

  private handleLoaf = (entries: PerformanceEntryList) => {
    this.loafEntries.push(...(entries as LoafEntry[]));
  };

  private handleEvents = (entries: PerformanceEntryList) => {
    for (const entry of entries as PerformanceEventTiming[]) {
      if (entry.startTime < this.beganAt || !this.probe || entry.target !== this.probe) continue;
      this.worstInputDelayMs = Math.max(this.worstInputDelayMs ?? 0, entry.processingStart - entry.startTime);
      this.worstEventDurationMs = Math.max(this.worstEventDurationMs ?? 0, entry.duration);
    }
  };

  private stopFrames() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}
