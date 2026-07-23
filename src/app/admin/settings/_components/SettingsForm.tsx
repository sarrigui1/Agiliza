'use client';

import { useState, useTransition } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { actualizarConfiguracionGlobal } from '@/actions/settings';
import type { ConfiguracionGlobal } from '@/types/database';
import { AlgorithmCard } from './AlgorithmCard';
import { TolerancesCard } from './TolerancesCard';
import { AbsenceCard } from './AbsenceCard';
import { PrivacyCard } from './PrivacyCard';

export function SettingsForm({ configuracionInicial }: { configuracionInicial: ConfiguracionGlobal }) {
  const [draft, setDraft] = useState(configuracionInicial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardadoEn, setGuardadoEn] = useState<number | null>(null);

  function patch(cambios: Partial<ConfiguracionGlobal>) {
    setDraft((prev) => ({ ...prev, ...cambios }));
    setGuardadoEn(null);
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const { id, updated_at, actualizado_por, ...editable } = draft;
      void id;
      void updated_at;
      void actualizado_por;

      const res = await actualizarConfiguracionGlobal(editable);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft(res.data);
      setGuardadoEn(Date.now());
    });
  }

  return (
    <main className="p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">CONFIGURACIÓN DEL SISTEMA</h1>
        <div className="flex items-center gap-4">
          {guardadoEn && (
            <span className="flex items-center gap-1 text-sm text-primary">
              <CheckCircle2 className="size-4" />
              Cambios guardados
            </span>
          )}
          {error && <span className="text-sm text-danger">{error}</span>}
          <Button onClick={guardar} loading={isPending}>
            <Save className="size-4" />
            Guardar Cambios
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AlgorithmCard
          algoritmoCola={draft.algoritmo_cola}
          intercaladoPreferencial={draft.intercalado_preferencial}
          intercaladoNormal={draft.intercalado_normal}
          onChange={patch}
        />
        <TolerancesCard
          minutosCheckinPrevio={draft.minutos_checkin_previo}
          minutosTolerancia={draft.minutos_tolerancia}
          segundosIntervaloRellamado={draft.segundos_intervalo_rellamado}
          onChange={patch}
        />
        <AbsenceCard
          limiteLlamadosAusencia={draft.limite_llamados_ausencia}
          reingresoPenalizado={draft.reingreso_penalizado}
          onChange={patch}
        />
        <PrivacyCard formatoPrivacidadTv={draft.formato_privacidad_tv} onChange={patch} />
      </div>
    </main>
  );
}
