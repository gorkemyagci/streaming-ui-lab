import { MODE_IDS, MODES, type Mode } from "../renderers/types";
import { SAMPLES, type SampleId } from "../stream/samples";

export type Settings = {
  sample: SampleId;
  chunkSize: number;
  intervalMs: number;
  runsPerMode: number;
};

type Props = {
  mode: Mode;
  settings: Settings;
  running: boolean;
  onModeChange: (mode: Mode) => void;
  onSettingsChange: (settings: Settings) => void;
  onRun: () => void;
  onRunAll: () => void;
  onReset: () => void;
};

const fieldClass =
  "rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700";
const buttonClass = "rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40";

export function Controls({ mode, settings, running, onModeChange, onSettingsChange, onRun, onRunAll, onReset }: Props) {
  const setNumber = (key: "chunkSize" | "intervalMs" | "runsPerMode") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, Math.round(Number(e.target.value) || 1));
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <fieldset disabled={running} className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Render mode</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODE_IDS.map((id) => (
            <label
              key={id}
              className="flex cursor-pointer gap-2 rounded-md border border-zinc-200 p-3 has-checked:border-blue-500 has-checked:bg-blue-50 has-disabled:cursor-not-allowed has-disabled:opacity-60 dark:border-zinc-800 dark:has-checked:bg-blue-950/40"
            >
              <input
                type="radio"
                name="mode"
                value={id}
                checked={mode === id}
                onChange={() => onModeChange(id)}
                className="mt-1"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{MODES[id].label}</span>
                <span className="text-xs text-zinc-500">{MODES[id].description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={running} className="flex flex-wrap items-end gap-3">
        <legend className="mb-2 text-sm font-medium">Settings</legend>
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Sample
          <select
            value={settings.sample}
            onChange={(e) => onSettingsChange({ ...settings, sample: e.target.value as SampleId })}
            className={fieldClass}
          >
            {(Object.keys(SAMPLES) as SampleId[]).map((id) => (
              <option key={id} value={id}>
                {id} ({SAMPLES[id].length.toLocaleString("en-US")} chars)
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Chunk size (chars)
          <input type="number" min={1} value={settings.chunkSize} onChange={setNumber("chunkSize")} className={`${fieldClass} w-24`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Interval (ms)
          <input type="number" min={1} value={settings.intervalMs} onChange={setNumber("intervalMs")} className={`${fieldClass} w-24`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Runs per mode
          <input type="number" min={1} value={settings.runsPerMode} onChange={setNumber("runsPerMode")} className={`${fieldClass} w-24`} />
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onRun} disabled={running} className={`${buttonClass} bg-blue-600 text-white`}>
          Run
        </button>
        <button
          type="button"
          onClick={onRunAll}
          disabled={running}
          className={`${buttonClass} border border-zinc-300 dark:border-zinc-700`}
        >
          Run all ({MODE_IDS.length} × {settings.runsPerMode})
        </button>
        <button type="button" onClick={onReset} className={`${buttonClass} border border-zinc-300 dark:border-zinc-700`}>
          Reset
        </button>
      </div>
    </div>
  );
}
