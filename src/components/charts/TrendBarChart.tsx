'use client';

import type { PuntoTendencia } from '@/actions/analytics';

const ALTURA_PX = 160;

function formatearFechaCorta(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

/**
 * Barras de una sola serie -> sin leyenda (el título del card ya dice qué se grafica).
 * Alturas en píxeles absolutos (no % en flex) para evitar ambigüedad de resolución de
 * porcentajes dentro de contenedores flex; gap de 2px entre barras (spacer, no borde).
 */
export function TrendBarChart({ datos }: { datos: PuntoTendencia[] }) {
  if (datos.length === 0) {
    return <p className="py-12 text-center text-sm text-muted">Sin datos en este periodo.</p>;
  }

  const max = Math.max(1, ...datos.map((d) => d.cantidad));

  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-[10px] text-muted">
        <span>{max} turnos (máx)</span>
      </div>
      <div className="flex items-end gap-[2px] border-b border-border" style={{ height: ALTURA_PX }}>
        {datos.map((d) => {
          const alturaBarra = Math.max(2, Math.round((d.cantidad / max) * ALTURA_PX));
          return (
            <div key={d.fecha} className="group relative flex-1">
              <div
                className="mx-auto w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80"
                style={{ height: alturaBarra }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1.5 text-xs text-text shadow-lg group-hover:block">
                <span className="font-semibold text-primary">{d.cantidad}</span> turnos
                <br />
                <span className="text-muted">{formatearFechaCorta(d.fecha)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
        <span>{formatearFechaCorta(datos[0].fecha)}</span>
        <span>{formatearFechaCorta(datos[datos.length - 1].fecha)}</span>
      </div>
    </div>
  );
}
