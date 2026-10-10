# streaming-ui-lab

**Compare four ways to render a streamed LLM markdown response in React. The page measures each one live, so you don't need DevTools.**

Chat UIs get an LLM response as a stream of small text chunks. The obvious approach is to append each chunk to state and render the whole message as markdown again. That works fine for short answers. On long ones, with code blocks and tables, the page starts to stutter, typing gets laggy, and the fans spin up.

This project is a small, self-contained lab for seeing that problem and comparing the usual fixes side by side, with the numbers on the page.

- Four render strategies run on the same input, one at a time.
- Metrics come from React's Profiler and the browser's own performance APIs.
- The results table averages repeated runs, and you can copy it as markdown for an issue, PR or blog post.
- No API keys and no network calls. The stream is simulated, so every run gets the same input.

---

## Contents

- [The four render modes](#the-four-render-modes)
- [What is measured](#what-is-measured)
- [Getting started](#getting-started)
- [Using the lab](#using-the-lab)
- [Getting trustworthy numbers](#getting-trustworthy-numbers)
- [Reading the results](#reading-the-results)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [License](#license)

---

## The four render modes

| Mode | Strategy | Trade-off |
| --- | --- | --- |
| **Naive** | Every chunk calls `setState`, and the full text is parsed again with `react-markdown`. | Simplest code. The cost of each update grows with the message length, so total work grows quadratically. |
| **Throttle** | Chunks are buffered in a ref and written to state every 50 ms. The tail is written immediately when the stream ends. | Fewer commits, but each commit still parses the whole message. This is the same idea as `useChat({ throttle })` in the Vercel AI SDK. |
| **Memoize** | The text is split into blocks on blank lines, never inside a code fence. Each block is a `React.memo` component, so only the last, still-growing block renders again. | Per-update cost stays roughly constant. You need a splitter that understands fences (see [`split-blocks.ts`](modules/renderers/split-blocks.ts)). |
| **Streamdown** | [`streamdown`](https://github.com/vercel/streamdown), a drop-in `react-markdown` replacement built for streaming. | Memoizes blocks internally and also repairs unterminated markdown (half-open fences, bold, links). It is an extra dependency. |

Naive, throttle and memoize share one `react-markdown` + `remark-gfm` setup. All four use the same `prose` styling, and none of them highlights code syntax, so the comparison is about rendering strategy and nothing else.

## What is measured

| Metric | Source | What it tells you |
| --- | --- | --- |
| **Commits** | `<Profiler onRender>` around the streaming subtree | How many times React committed that subtree. |
| **Render total / avg** | `actualDuration` from the Profiler | Time React spent rendering the subtree, in total and per commit. |
| **Total blocking time** | `PerformanceObserver` with `long-animation-frame` | The sum of `blockingDuration`: the main-thread time that went past the 50 ms budget and was felt as jank. |
| **Worst input delay** | `PerformanceObserver` with `event` (Event Timing) | `processingStart − startTime` for keystrokes in the probe input: how long a key press waited for the main thread. |
| **Worst event duration** | Same Event Timing entries | `duration`, from input to the next paint. Similar in spirit to INP. |
| **FPS avg / min** | `requestAnimationFrame` loop | Average frame rate and the worst full one-second window. |
| **Stream duration** | `performance.now()` | Time from the first chunk until the last chunk is in state. |

Each API is feature-detected. When one is missing, the panel says **"not supported in this browser"** and shows no fake number.

| | Chrome / Edge | Firefox | Safari |
| --- | --- | --- | --- |
| React Profiler, FPS, duration | ✅ | ✅ | ✅ |
| Long Animation Frames (TBT) | ✅ | ❌ | ❌ |
| Event Timing (input metrics) | ✅ | ✅ | check your version |

Use a Chromium-based browser to get the full picture.

## Getting started

**Requirements:** Node.js 22.12 or newer and npm.

```bash
git clone https://github.com/gorkemyagci/streaming-ui-lab.git
cd streaming-ui-lab
npm install
```

To get real numbers, run a production build:

```bash
npm run build   # runs `next build --profile`, so the React Profiler works in production
npm start       # http://localhost:3000
```

For a quick look while you change code:

```bash
npm run dev     # React dev mode is much slower; don't compare these numbers with production ones
```

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build with React profiling enabled (`next build --profile`) |
| `npm start` | Serves the production build |
| `npm test` | Unit tests (Vitest) for the block splitter and the metric math |
| `npm run lint` | ESLint |

## Using the lab

1. **Pick a render mode.**
2. **Adjust the settings if you want to.**
   - **Sample:** `short` (about 600 characters) or `long` (about 10k characters with headings, nested lists, two tables and several code blocks).
   - **Chunk size / interval:** how fast the fake stream emits text. The default is 5 characters every 20 ms, about 250 characters per second.
   - **Runs per mode:** used by Run all.
3. **Press Run** and, while it streams, **type in the probe input**. Your keystrokes are what the input delay metrics measure.
4. Watch the **Live metrics** panel. When the run ends, a row goes into the **Results** table.
5. **Run all** runs every mode *Runs per mode* times, in round-robin order (A B C D, A B C D, …).
6. **Copy as markdown** puts the results table on your clipboard.

The table shows one row per mode and settings combination, averaged over all its runs. The `n` column says how many runs went into each average. **Reset** stops the current run or batch and discards the run in progress.

## Getting trustworthy numbers

Fast laptops hide most of the differences. To make them show:

- **Use the production build** (`npm run build && npm start`), never `npm run dev`.
- **Throttle the CPU.** Open DevTools → Performance → ⚙️ → CPU: **4x slowdown**. Keep DevTools open while you run; the setting only applies while it is open. This is closer to a mid-range phone.
- **Use the `long` sample.** Problems grow with message length.
- **Use Run all with 3 or more runs per mode.** One run is noisy, and the round-robin order spreads JIT warm-up and GC pauses evenly across the modes.
- **Type in the probe input during every run**, at roughly the same pace, or the input columns stay empty.
- Close other heavy tabs, and don't switch tabs mid-run: background tabs throttle timers and `requestAnimationFrame`.

## Reading the results

Some things to look for:

- **Commits vs. render avg.** Throttling cuts commits, but if *render avg* goes up by about the same factor, the total work hasn't changed. It has only been grouped into bigger, and possibly blockier, frames.
- **Render total.** This is the clearest signal of how much work a strategy does. Memoization should cut it sharply on long messages.
- **TBT and worst input delay.** This is what users actually feel. A strategy can have a low render total and still produce occasional long frames.
- **Short vs. long sample.** On short messages every strategy is fine. The gaps open up as the message grows.

<details>
<summary>Example: one headless Chrome run, long sample, no CPU throttling, n = 1</summary>

These numbers come from a single run, only to show what the table looks like. Run it on your own hardware with CPU throttling before drawing conclusions.

| Mode | Commits | Render total (ms) | Render avg (ms) | TBT (ms) |
| --- | --- | --- | --- | --- |
| naive | 1969 | 6774 | 3.44 | 0 |
| throttle | 797 | 6400 | 8.03 | 342 |
| memoize | 1969 | 1757 | 0.89 | 0 |
| streamdown | 2592 | 3129 | 1.21 | 27 |

In this run, throttling cut commits by about 2.5× but total render time barely moved, because each flush still parses the whole message. Memoizing blocks cut render time by about 4×.

</details>

## How it works

```
Lab (page state, run queue)
├── Controls, ProbeInput (uncontrolled)
├── <div role="log">
│   └── StreamLane  (key = run id, React.memo)
│       └── <Profiler onRender={collector.onRender}>
│           └── LaneBody → useFakeStream(...) → Renderer for the mode
├── MetricsPanel  (polls collector.snapshot() every 250 ms)
└── ResultsTable  (groups raw runs into averaged rows)
```

- **The fake stream.** [`useFakeStream`](modules/stream/use-fake-stream.ts) slices the sample on a `setInterval` and returns `{ text, status, start, reset }`. With `flushMs` set, chunks are collected in a ref and written to state on a separate timer. That option is the only difference between naive and throttle.
- **Measuring without disturbing.** All metrics live in a plain class, [`RunCollector`](modules/metrics/run-collector.ts), and never in React state, so measuring a run causes no extra renders. The panel reads a snapshot on a fixed 250 ms timer, which costs the same in every mode. The probe input is uncontrolled, so typing never causes a React render.
- **Clean run boundaries.** Each run mounts a new `StreamLane` with a unique `key`. When the stream ends, the collector waits about 300 ms for late LoAF and Event Timing entries, then stores the result. Runs never overlap.
- **The block splitter.** [`splitBlocks`](modules/renderers/split-blocks.ts) scans line by line and keeps track of the fence state: backtick or tilde fences, fence length, and fences nested in list items. It splits only on blank lines outside a fence. Blank lines stay attached to the block before them, so finished blocks keep the same string as the text grows. That is what lets `React.memo` skip them.

## Project structure

```
app/                  Next.js App Router entry (page, layout, global CSS)
modules/
├── stream/           useFakeStream hook and the sample texts
├── renderers/        the four render modes, shared Markdown wrapper, block splitter
├── metrics/          RunCollector, feature detection, aggregation, metrics panel
└── lab/              page UI: controls, probe input, stream lane, results table
```

Feature code lives under `modules/<feature>`, and file names are kebab-case.

## Accessibility

- The streamed output is in a `role="log"` region with `aria-live="off"`, so screen readers don't announce every chunk.
- A separate visually hidden `role="status"` region (`aria-live="polite"`) announces **"Response streaming"** and **"Response ready"**.
- All controls have labels. The mode switcher is a native radio group, and the results table has a caption and row headers.

## Limitations

- **The stream is simulated.** Real network streams arrive in irregular bursts. Fixed-interval chunks make runs repeatable, but they are not a real-world trace.
- **Event Timing only reports events of 16 ms or more.** If you type and every event is faster than that, the input columns show `< 16`. If you don't type at all, they show `—`.
- **Profiler numbers cover only the streaming subtree.** Work outside it, such as layout and paint, shows up in TBT and FPS, not in render time.
- **Numbers depend on the machine.** Compare modes against each other on one machine, not across machines.

## Contributing

Issues and pull requests are welcome. Ideas that fit the lab:

- more render strategies, such as `useDeferredValue`, a Web Worker parser, or incremental `marked` parsing
- more samples (math, long tables, very long single paragraphs)
- replaying a recorded real LLM stream with its original timing

Before opening a PR:

```bash
npm test && npm run lint && npm run build
```

## License

[MIT](./LICENSE) © 2026 Görkem Yağcı
