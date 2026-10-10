// Leading whitespace is allowed so fences nested in list items are still tracked.
const FENCE_OPEN = /^\s*(`{3,}|~{3,})/;
const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/;

/**
 * Splits markdown into blocks on blank lines, never inside a code fence.
 * Blank lines stay attached to the block before them, so `blocks.join("")`
 * equals the input and finished blocks keep the same string as text grows.
 */
export function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];

  let current = "";
  let afterBlank = false;
  let fence: { char: string; length: number } | null = null;

  for (const line of lines) {
    if (fence) {
      const close = FENCE_CLOSE.exec(line);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
        fence = null;
      }
      current += line;
      continue;
    }

    if (line.trim() === "") {
      current += line;
      afterBlank = true;
      continue;
    }

    if (afterBlank && current) {
      blocks.push(current);
      current = "";
    }
    afterBlank = false;

    const open = FENCE_OPEN.exec(line);
    if (open) fence = { char: open[1][0], length: open[1].length };
    current += line;
  }

  if (current) blocks.push(current);
  return blocks;
}
