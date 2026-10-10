import { describe, expect, it } from "vitest";
import { long } from "../stream/samples/long";
import { splitBlocks } from "./split-blocks";

const F = "```";

describe("splitBlocks", () => {
  it("splits paragraphs on blank lines", () => {
    expect(splitBlocks("one\n\ntwo\n\n\nthree")).toEqual(["one\n\n", "two\n\n\n", "three"]);
  });

  it("keeps a fence with blank lines inside as one block", () => {
    const code = `${F}ts\nconst a = 1;\n\nconst b = 2;\n${F}\n`;
    expect(splitBlocks(`intro\n\n${code}\noutro`)).toEqual(["intro\n\n", `${code}\n`, "outro"]);
  });

  it("handles ~~~ fences", () => {
    const code = "~~~py\nx = 1\n\ny = 2\n~~~\n";
    expect(splitBlocks(`${code}\nafter`)).toEqual([`${code}\n`, "after"]);
  });

  it("does not close a ```` fence on an inner ``` line", () => {
    const code = `${F}\`md\n${F}js\n\nfoo()\n${F}\n\nstill inside\n${F}\`\n`;
    expect(splitBlocks(`${code}\nafter`)).toEqual([`${code}\n`, "after"]);
  });

  it("does not close a ``` fence with ~~~", () => {
    const code = `${F}\na\n~~~\n\nb\n${F}\n`;
    expect(splitBlocks(code)).toEqual([code]);
  });

  it("keeps an unterminated fence at the end as one block", () => {
    const text = `para\n\n${F}ts\nconst a = 1;\n\nconst b`;
    expect(splitBlocks(text)).toEqual(["para\n\n", `${F}ts\nconst a = 1;\n\nconst b`]);
  });

  it("tracks fences nested in list items", () => {
    const text = `- step\n\n  ${F}sh\n  a\n\n  b\n  ${F}\n\nend`;
    expect(splitBlocks(text)).toEqual(["- step\n\n", `  ${F}sh\n  a\n\n  b\n  ${F}\n\n`, "end"]);
  });

  it("returns an empty array for empty input", () => {
    expect(splitBlocks("")).toEqual([]);
  });

  it("round-trips the long sample at every prefix length", () => {
    for (let i = 0; i <= long.length; i += 97) {
      const prefix = long.slice(0, i);
      expect(splitBlocks(prefix).join("")).toBe(prefix);
    }
    expect(splitBlocks(long).join("")).toBe(long);
  });

  it("keeps finished blocks stable as text grows", () => {
    const full = splitBlocks(long);
    const partial = splitBlocks(long.slice(0, Math.floor(long.length / 2)));
    expect(partial.slice(0, -1)).toEqual(full.slice(0, partial.length - 1));
  });
});
