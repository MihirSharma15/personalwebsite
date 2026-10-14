'use client';

import { useEffect, useRef } from 'react';

const chevron = Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3);
  const column = index % 3;
  return (column + Math.abs(row - 1)) * 90;
});

// Adapted from the requested Beautiful UI loading-state registry component.
// The site uses plain CSS rather than Tailwind, so its visual treatment lives
// in app/globals.css instead of utility classes.
//
// Writes straight to the DOM via a ref instead of React state: the WebGL
// canvas in main.js is also fighting for the main thread during load, and a
// setState-per-tick clock visibly lags because each render has to queue
// behind that work. A ref sidesteps React's render cycle entirely, and each
// tick recomputes its own delay from the real elapsed time (rather than a
// fixed setInterval) so it can't drift.
//
// Measures from performance.timeOrigin (i.e. reads performance.now() as-is)
// rather than zeroing a local `startedAt` when this effect happens to fire.
// This effect can't run until React hydrates — typically several hundred ms
// after navigation starts, since the JS bundle has to load and execute first
// — so a local zero point made the clock silently throw that time away and
// restart from 0:00 once it finally mounted. Anchoring to the real time
// origin means the first tick already shows the correct elapsed time, so it
// looks caught-up rather than delayed.
function useElapsedClock(ref) {
  useEffect(() => {
    let timeoutId;

    const tick = () => {
      const elapsedMs = performance.now();
      const seconds = Math.floor(elapsedMs / 1000);
      const hundredths = String(Math.floor((elapsedMs % 1000) / 10)).padStart(2, '0');
      if (ref.current) {
        ref.current.textContent = `${seconds}:${hundredths}`;
      }
      const nextBoundary = (Math.floor(elapsedMs / 10) + 1) * 10;
      timeoutId = window.setTimeout(tick, nextBoundary - elapsedMs);
    };

    tick();
    return () => window.clearTimeout(timeoutId);
  }, [ref]);
}

export default function LoadingState() {
  const elapsedRef = useRef(null);

  useElapsedClock(elapsedRef);

  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-pixel-grid" aria-hidden="true">
        {chevron.map((delay, index) => (
          <span key={index} className="loading-pixel" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </span>
      <span className="loading-label">writing scripts</span>
      <span className="loading-elapsed" ref={elapsedRef}>0:00</span>
    </div>
  );
}
