import { memo } from "react";
import { Markdown } from "./markdown";
import { splitBlocks } from "./split-blocks";
import type { RendererProps } from "./types";

const MemoBlock = memo(function MemoBlock({ content }: { content: string }) {
  return <Markdown>{content}</Markdown>;
});

export function MemoizeRenderer({ text }: RendererProps) {
  return splitBlocks(text).map((block, i) => <MemoBlock key={i} content={block} />);
}
