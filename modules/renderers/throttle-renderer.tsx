import { Markdown } from "./markdown";
import type { RendererProps } from "./types";

// Same render as naive: the difference is `flushMs: 50` on the stream hook,
// which turns per-chunk state updates into one commit every 50 ms.
export function ThrottleRenderer({ text }: RendererProps) {
  return <Markdown>{text}</Markdown>;
}
