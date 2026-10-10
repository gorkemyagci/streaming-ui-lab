import type { ComponentType } from "react";
import { MemoizeRenderer } from "./memoize-renderer";
import { NaiveRenderer } from "./naive-renderer";
import { StreamdownRenderer } from "./streamdown-renderer";
import { ThrottleRenderer } from "./throttle-renderer";
import type { Mode, RendererProps } from "./types";

export const RENDERERS: Record<Mode, ComponentType<RendererProps>> = {
  naive: NaiveRenderer,
  throttle: ThrottleRenderer,
  memoize: MemoizeRenderer,
  streamdown: StreamdownRenderer,
};
