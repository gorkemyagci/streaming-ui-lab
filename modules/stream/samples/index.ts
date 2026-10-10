import { long } from "./long";
import { short } from "./short";

export const SAMPLES = { short, long };

export type SampleId = keyof typeof SAMPLES;
