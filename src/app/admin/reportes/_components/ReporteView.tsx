import type { MetricasEjecutivas, PuntoTendencia, RendimientoServicio } from '@/actions/analytics';
import { PrintButton } from './PrintButton';

interface ReporteViewProps {
  desde: string;
  hasta: string;
  metricas: MetricasEjecutivas;
  tendencia: PuntoTendencia[];
  porServicio: RendimientoServicio[];
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * A diferencia del resto de la app (dark-mode fijo), este resumen ejecutivo se
 * renderiza en claro a propósito — un PDF de una página en fondo negro gasta tinta
 * y no es el formato que espera Alta Dirección. `nav` y `.no-print` se ocultan al
 * imprimir vía la regla global en globals.css.
 */
export function ReporteView({ desde, hasta, metricas, tendencia, porServicio }: ReporteViewProps) {
  const hastaInclusive = new Date(new Date(hasta).getTime() - 1);

  return (
    <main className="mx-auto max-w-4xl bg-white p-10 text-gray-900 print:max-w-none print:p-6">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>

      <header className="mb-8 flex items-end justify-between border-b-2 border-gray-900 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Agiliza · FlowQ</p>
          <h1 className="text-2xl font-bold">Resumen Ejecutivo de Operación</h1>
        </div>
        <p className="text-sm text-gray-500">
          {formatearFecha(desde)} — {formatearFecha(hastaInclusive.toISOString())}
        </p>
      </header>

      <section className="mb-8 grid grid-cols-4 gap-4">
        <ReporteKpi label="Total Atendidos" valor={String(metricas.totalAtendidos)} />
        <ReporteKpi
          label="TPE Promedio"
          valor={metricas.tpeGlobalMinutos !== null ? `${metricas.tpeGlobalMinutos} min` : '—'}
        />
        <ReporteKpi
          label="% Cumplimiento SLA"
          valor={metricas.cumplimientoSla !== null ? `${metricas.cumplimientoSla}%` : '—'}
        />
        <ReporteKpi label="Tasa de Ausentismo" valor={`${metricas.tasaAusentismo}%`} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Tendencia de Demanda
        </h2>
        <ReporteTendenciaBars datos={tendencia} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Comparativa por Servicio
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-xs uppercase text-gray-500">
              <th className="py-2">Servicio</th>
              <th className="py-2">Atenciones</th>
              <th className="py-2">TPE</th>
              <th className="py-2">TPA</th>
            </tr>
          </thead>
          <tbody>
            {porServicio.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-400">
                  Sin datos en este periodo.
                </td>
              </tr>
            )}
            {porServicio.map((s) => (
              <tr key={s.especialidadId} className="border-b border-gray-100">
                <td className="py-2 font-medium">{s.nombre}</td>
                <td className="py-2">{s.totalAtenciones}</td>
                <td className="py-2">{s.tpeMinutos !== null ? `${s.tpeMinutos} min` : '—'}</td>
                <td className="py-2">{s.tpaMinutos !== null ? `${s.tpaMinutos} min` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-10 text-center text-[10px] text-gray-400">
        Generado el {new Date().toLocaleString('es-CO')} — Sistema de Gestión de Turnos FlowQ
      </footer>
    </main>
  );
}

function ReporteKpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-md border border-gray-200 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valor}</p>
    </div>
  );
}

function ReporteTendenciaBars({ datos }: { datos: PuntoTendencia[] }) {
  if (datos.length === 0) {
    return <p className="text-sm text-gray-400">Sin datos en este periodo.</p>;
  }

  const max = Math.max(1, ...datos.map((d) => d.cantidad));

  return (
    <div className="flex flex-col gap-1.5">
      {datos.map((d) => (
        <div key={d.fecha} className="flex items-center gap-3 text-xs">
          <span className="w-16 shrink-0 text-gray-500">
            {new Date(`${d.fecha}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
          </span>
          <div className="h-3 flex-1 rounded-sm bg-gray-100">
            <div
              className="h-3 rounded-sm bg-gray-900"
              style={{ width: `${Math.max(2, (d.cantidad / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-medium text-gray-700">{d.cantidad}</span>
        </div>
      ))}
    </div>
  );
}
