'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Turno } from '@/types/database';

const ESTADOS_ACTIVOS = new Set(['en_espera', 'llamado', 'en_atencion']);

/**
 * Suscripción Realtime a `turnos` para el Operator Workspace. Realtime de Supabase solo
 * filtra por igualdad de una columna, así que se filtra por `zona_id` en el canal y se
 * afina por `especialidad_id` en el cliente (una zona puede tener varias especialidades).
 *
 * Mantiene la lista reconciliada de turnos "vivos" (en_espera | llamado | en_atencion);
 * los que transicionan a un estado terminal se remueven de la vista local.
 */
export function useRealtimeTurnos(
  especialidadId: string | null,
  zonaId: string | null,
  initialTurnos: Turno[],
) {
  // `especialidadId`/`zonaId` son estables durante la vida del componente (el punto de
  // atención de un agente no cambia sin recargar la página), por lo que `initialTurnos`
  // solo necesita sembrar el estado una vez al montar.
  const [turnos, setTurnos] = useState<Turno[]>(initialTurnos);

  useEffect(() => {
    if (!especialidadId || !zonaId) return;

    const supabase = createClient();
    let cancelado = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // `turnos` está protegido por RLS (requiere rol autenticado con permiso sobre la
    // cola). `supabase-js` carga la sesión desde las cookies de forma asíncrona y solo
    // después llama a `realtime.setAuth()` internamente; si el canal se suscribe antes
    // de que eso termine, negocia como `anon` y RLS descarta todos los eventos en
    // silencio (sin error visible). `getSession()` espera esa inicialización interna,
    // así que sirve como barrera antes de suscribirse.
    supabase.auth.getSession().then(() => {
      if (cancelado) return;

      channel = supabase
        .channel(`turnos-zona-${zonaId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'turnos', filter: `zona_id=eq.${zonaId}` },
          (payload) => {
            const nuevo = (payload.new ?? null) as Turno | null;
            const anterior = (payload.old ?? null) as Turno | null;
            const turno = nuevo ?? anterior;
            if (!turno || turno.especialidad_id !== especialidadId) return;

            setTurnos((prev) => {
              const sinEste = prev.filter((t) => t.id !== turno.id);

              if (payload.eventType === 'DELETE' || !nuevo || !ESTADOS_ACTIVOS.has(nuevo.estado)) {
                return sinEste;
              }

              return [...sinEste, nuevo].sort(
                (a, b) => new Date(a.hora_llegada).getTime() - new Date(b.hora_llegada).getTime(),
              );
            });
          },
        )
        .subscribe();
    });

    return () => {
      cancelado = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [especialidadId, zonaId]);

  return turnos;
}
