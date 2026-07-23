'use client';

import { useEffect, useState } from 'react';

/** Reloj en vivo (hora + fecha en español), actualizado cada segundo. Solo cliente:
 *  se inicializa en `null` para evitar mismatches de hidratación SSR/CSR. */
export function useClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const immediate = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(id);
    };
  }, []);

  if (!now) return { hora: '--:--:--', fecha: '' };

  const hora = now.toLocaleTimeString('es-CO', { hour12: false });
  const fecha = now.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return { hora, fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1) };
}
