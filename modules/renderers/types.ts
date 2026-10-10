export type Mode = "naive" | "throttle" | "memoize" | "streamdown";

export type RendererProps = {
  text: string;
  streaming: boolean;
};

export const MODES: Record<Mode, { label: string; description: string; flushMs?: number }> = {
  naive: {
    label: "Naive",
    description: "Every chunk updates state; the full text is re-parsed with react-markdown.",
  },
  throttle: {
    label: "Throttle",
    description: "Chunks are buffered in a ref and flushed to state every 50 ms.",
    flushMs: 50,
  },
  memoize: {
    label: "Memoize",
    description: "Text is split into blocks; finished blocks are memoized, only the last re-renders.",
  },
  streamdown: {
    label: "Streamdown",
    description: "The streamdown package, built for streaming markdown.",
  },
};

export const MODE_IDS = Object.keys(MODES) as Mode[];
