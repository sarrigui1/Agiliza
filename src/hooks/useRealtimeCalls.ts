'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Llamado } from '@/types/database';

const MAX_HISTORIAL = 6;

/**
 * Suscripción Realtime (WebSockets, zero polling) a INSERT en `llamados`, filtrada por
 * zona. `llamados` ya viene anonimizada desde las RPC (`etiqueta_publica`), por lo que
 * este hook nunca toca datos con PII — cumple el requisito de <100ms del documento de
 * especificación sin necesidad de resolver relaciones adicionales en el cliente.
 */
export function useRealtimeCalls(zonaId: string | null, initialCalls: Llamado[]) {
  const [calls, setCalls] = useState<Llamado[]>(initialCalls);
  const onNuevoLlamadoRef = useRef<((llamado: Llamado) => void) | null>(null);

  useEffect(() => {
    if (!zonaId) return;

    const supabase = createClient();
    let cancelado = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Ver la nota equivalente en useRealtimeTurnos.ts: se espera a que la sesión termine
    // de inicializarse (aunque el TV Display normalmente corre anónimo) para que
    // `realtime.setAuth()` quede aplicado antes de suscribirse, evitando una condición
    // de carrera si esta pantalla llega a cargarse con una sesión activa.
    supabase.auth.getSession().then(() => {
      if (cancelado) return;

      channel = supabase
        .channel(`llamados-zona-${zonaId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'llamados', filter: `zona_id=eq.${zonaId}` },
          (payload) => {
            const llamado = payload.new as Llamado;
            setCalls((prev) => [llamado, ...prev].slice(0, MAX_HISTORIAL));
            onNuevoLlamadoRef.current?.(llamado);
          },
        )
        .subscribe();
    });

    return () => {
      cancelado = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [zonaId]);

  /** Registra un callback (chime + TTS) que se dispara con cada llamado entrante. */
  const onNuevoLlamado = (cb: (llamado: Llamado) => void) => {
    onNuevoLlamadoRef.current = cb;
  };

  return { calls, onNuevoLlamado };
}
