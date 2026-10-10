const F = "```";

export const short = `## Debouncing a search input

Debouncing waits until the user **stops typing** before firing a request. It cuts network traffic and avoids flicker.

- Pick a delay between 200 and 400 ms
- Cancel the pending timer on every keystroke
- Clear the timer on unmount

${F}ts
function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
${F}

> Throttling is different: it fires at most once per interval, even while input keeps coming.
`;
