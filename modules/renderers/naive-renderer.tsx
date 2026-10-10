import { Markdown } from "./markdown";
import type { RendererProps } from "./types";

export function NaiveRenderer({ text }: RendererProps) {
  return <Markdown>{text}</Markdown>;
}
