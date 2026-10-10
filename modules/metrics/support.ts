export type Support = {
  longAnimationFrame: boolean;
  eventTiming: boolean;
  animationFrame: boolean;
};

let cached: Support | null = null;

export function detectSupport(): Support {
  if (cached) return cached;
  const types =
    typeof PerformanceObserver === "undefined" ? [] : (PerformanceObserver.supportedEntryTypes ?? []);
  cached = {
    longAnimationFrame: types.includes("long-animation-frame"),
    eventTiming: types.includes("event"),
    animationFrame: typeof requestAnimationFrame === "function",
  };
  return cached;
}
