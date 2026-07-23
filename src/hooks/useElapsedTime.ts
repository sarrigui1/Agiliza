'use client';

import { useEffect, useState } from 'react';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Cronómetro mm:ss transcurrido desde `startIso`. Retorna null mientras no hay inicio. */
export function useElapsedTime(startIso: string | null | undefined): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!startIso) {
      const reset = setTimeout(() => setLabel(null), 0);
      return () => clearTimeout(reset);
    }
    const start = new Date(startIso).getTime();

    const tick = () => setLabel(formatElapsed(Date.now() - start));
    const immediate = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(id);
    };
  }, [startIso]);

  return label;
}
