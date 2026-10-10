import type { RunCollector } from "../metrics/run-collector";

// Uncontrolled on purpose: no value, no onChange, no state, so typing never renders React.
export function ProbeInput({ collector }: { collector: RunCollector }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="probe" className="text-sm font-medium">
        Type here while streaming
      </label>
      <input
        id="probe"
        ref={(el) => collector.setProbe(el)}
        type="text"
        autoComplete="off"
        aria-describedby="probe-hint"
        className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700"
      />
      <p id="probe-hint" className="text-xs text-zinc-500">
        Keystrokes here feed the input delay and event duration metrics.
      </p>
    </div>
  );
}
