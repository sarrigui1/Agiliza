import { Card, CardTitle } from '@/components/ui/Card';
import { ListChecks } from 'lucide-react';
import type { RendimientoServicio } from '@/actions/analytics';

export function ServicioTable({ datos }: { datos: RendimientoServicio[] }) {
  return (
    <Card className="p-0">
      <div className="p-6 pb-0">
        <CardTitle>
          <ListChecks className="size-5 text-primary" />
          Comparativa por Servicio
        </CardTitle>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="px-6 py-3">Servicio</th>
            <th className="px-6 py-3">Atenciones</th>
            <th className="px-6 py-3">TPE</th>
            <th className="px-6 py-3">TPA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {datos.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-6 text-center text-muted">
                No hay servicios registrados.
              </td>
            </tr>
          )}
          {datos.map((s) => (
            <tr key={s.especialidadId}>
              <td className="px-6 py-4 font-medium text-text">{s.nombre}</td>
              <td className="px-6 py-4 font-mono text-primary">{s.totalAtenciones}</td>
              <td className="px-6 py-4 font-mono text-muted">
                {s.tpeMinutos !== null ? `${s.tpeMinutos} min` : '—'}
              </td>
              <td className="px-6 py-4 font-mono text-muted">
                {s.tpaMinutos !== null ? `${s.tpaMinutos} min` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
