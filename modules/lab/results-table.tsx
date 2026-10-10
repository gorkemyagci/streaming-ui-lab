"use client";

import { useMemo, useState } from "react";
import { groupRuns, rowCells, TABLE_COLUMNS, toMarkdownTable, type RunResult } from "../metrics/aggregate";

export function ResultsTable({ runs }: { runs: RunResult[] }) {
  const rows = useMemo(() => groupRuns(runs), [runs]);
  const [copyStatus, setCopyStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(toMarkdownTable(rows));
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }
    setTimeout(() => setCopyStatus(""), 2000);
  }

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="results-heading" className="text-lg font-semibold">
          Results
        </h2>
        <div className="flex items-center gap-3">
          <span role="status" aria-live="polite" className="text-sm text-zinc-500">
            {copyStatus}
          </span>
          <button
            type="button"
            onClick={copy}
            disabled={rows.length === 0}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
          >
            Copy as markdown
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Metrics averaged per mode and settings. n is the number of runs in each average.
          </caption>
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              {TABLE_COLUMNS.map((col) => (
                <th key={col} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={TABLE_COLUMNS.length} className="px-3 py-6 text-center text-zinc-500">
                  No finished runs yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.mode}|${row.sample}|${row.chunkSize}|${row.intervalMs}`}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  {rowCells(row).map((cell, i) =>
                    i === 0 ? (
                      <th key={i} scope="row" className="whitespace-nowrap px-3 py-2 font-medium">
                        {cell}
                      </th>
                    ) : (
                      <td key={i} className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
