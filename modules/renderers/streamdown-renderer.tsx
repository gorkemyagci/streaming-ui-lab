import { Streamdown } from "streamdown";
import type { RendererProps } from "./types";

export function StreamdownRenderer({ text, streaming }: RendererProps) {
  return <Streamdown isAnimating={streaming}>{text}</Streamdown>;
}
