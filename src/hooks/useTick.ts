'use client';

import { useEffect, useState } from 'react';

/** Fuerza un re-render periódico (para "hace X min" en tablas), sin un timer por fila. */
export function useTick(intervalMs = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
