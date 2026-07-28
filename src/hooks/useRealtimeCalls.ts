'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Llamado } from '@/types/database';

const MAX_HISTORIAL = 6;

export type EstadoConexionRealtime = 'conectando' | 'conectado' | 'reconectando';

/**
 * Suscripción Realtime (WebSockets, zero polling) a INSERT en `llamados`, filtrada por
 * zona. `llamados` ya viene anonimizada desde las RPC (`etiqueta_publica`), por lo que
 * este hook nunca toca datos con PII — cumple el requisito de <100ms del documento de
 * especificación sin necesidad de resolver relaciones adicionales en el cliente.
 *
 * También expone el estado de la suscripción y la hora del último evento recibido, para
 * que la pantalla pueda avisar cuando los datos podrían estar desactualizados en vez de
 * confiar ciegamente en un socket que se cortó — ver DisplayScreen.tsx. La reconexión en
 * sí la maneja el cliente de Supabase (reintentos con backoff a nivel de socket); acá solo
 * se refleja el estado, no se reimplementa el retry.
 */
export function useRealtimeCalls(zonaId: string | null, initialCalls: Llamado[]) {
  const [calls, setCalls] = useState<Llamado[]>(initialCalls);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionRealtime>('conectando');
  const [ultimaActualizacion, setUltimaActualizacion] = useState(() => Date.now());
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
            setUltimaActualizacion(Date.now());
            onNuevoLlamadoRef.current?.(llamado);
          },
        )
        .subscribe((status) => {
          if (cancelado) return;
          if (status === 'SUBSCRIBED') {
            setEstadoConexion('conectado');
            setUltimaActualizacion(Date.now());
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            setEstadoConexion('reconectando');
          }
        });
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

  return { calls, onNuevoLlamado, estadoConexion, ultimaActualizacion };
}
