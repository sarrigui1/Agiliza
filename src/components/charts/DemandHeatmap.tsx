'use client';

import type { CeldaHeatmap } from '@/actions/analytics';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORAS = Array.from({ length: 11 }, (_, i) => i + 8); // 8:00 .. 18:00

/**
 * Mapa de calor: escala secuencial de un solo hue (verde primario) por opacidad
 * continua — monótono por construcción, sin necesidad de pasos hex discretos. Celdas
 * con separador de 1px en el color de superficie (spacer, no borde).
 */
export function DemandHeatmap({ datos }: { datos: CeldaHeatmap[] }) {
  const mapa = new Map(datos.map((d) => [`${d.diaSemana}-${d.hora}`, d.cantidad]));
  const max = Math.max(1, ...datos.map((d) => d.cantidad));

  if (datos.length === 0) {
    return <p className="py-12 text-center text-sm text-muted">Sin datos en este periodo.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-10" />
            {HORAS.map((h) => (
              <th key={h} className="pb-1 text-center font-mono font-normal text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIAS.map((dia, i) => {
            const diaIso = i + 1; // 1 = lunes (ISO)
            return (
              <tr key={dia}>
                <td className="pr-2 text-right font-mono text-muted">{dia}</td>
                {HORAS.map((hora) => {
                  const cantidad = mapa.get(`${diaIso}-${hora}`) ?? 0;
                  const intensidad = cantidad === 0 ? 0 : 0.15 + (cantidad / max) * 0.85;
                  return (
                    <td key={hora} className="p-[1px]">
                      <div
                        className="group relative aspect-square rounded-sm"
                        style={{ backgroundColor: `rgba(57, 255, 20, ${intensidad})` }}
                      >
                        <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1.5 text-xs text-text shadow-lg group-hover:block">
                          <span className="font-semibold text-primary">{cantidad}</span> turnos
                          <br />
                          <span className="text-muted">
                            {dia} · {hora}:00
                          </span>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
