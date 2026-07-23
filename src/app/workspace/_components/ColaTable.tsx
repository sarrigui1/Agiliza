'use client';

import { ListOrdered } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTick } from '@/hooks/useTick';
import { formatHora, minutosDesde } from '@/lib/utils';
import type { Turno } from '@/types/database';

function badgeCategoria(turno: Turno) {
  if (turno.es_preferencial) return <Badge tone="warning">Preferencial</Badge>;
  if (turno.tipo_turno === 'cita_previa') return <Badge tone="primary">Cita Programada</Badge>;
  return <Badge tone="secondary">Demanda Espontánea</Badge>;
}

export function ColaTable({ turnos }: { turnos: Turno[] }) {
  useTick(30_000);

  return (
    <Card>
      <CardTitle>
        <ListOrdered className="size-5 text-primary" />
        Cola de Espera en Vivo
        <span className="ml-auto font-mono text-xs font-normal text-muted">{turnos.length} en espera</span>
      </CardTitle>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4">Pos</th>
              <th className="py-2 pr-4">Turno</th>
              <th className="py-2 pr-4">Categoría</th>
              <th className="py-2 pr-4">Llegada</th>
              <th className="py-2 pr-4">Espera</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {turnos.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">
                  No hay turnos en espera.
                </td>
              </tr>
            )}
            {turnos.map((turno, i) => {
              const espera = minutosDesde(turno.hora_llegada);
              return (
                <tr key={turno.id}>
                  <td className="py-3 pr-4 font-mono text-primary">#{String(i + 1).padStart(2, '0')}</td>
                  <td className="py-3 pr-4 font-mono font-bold text-text">{turno.codigo}</td>
                  <td className="py-3 pr-4">{badgeCategoria(turno)}</td>
                  <td className="py-3 pr-4 font-mono text-muted">{formatHora(turno.hora_llegada)}</td>
                  <td className={`py-3 pr-4 font-mono ${espera > 20 ? 'text-danger' : 'text-muted'}`}>
                    {espera} min
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
