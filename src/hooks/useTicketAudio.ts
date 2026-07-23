'use client';

import { useCallback, useRef, useState } from 'react';
import { construirMensajeVoz } from '@/lib/voiceMessage';
import type { ModoAudioTv } from '@/types/database';

/** Espera entre el chime y la voz cuando suenan los dos, para que no se pisen. */
const RETARDO_VOZ_TRAS_CHIME_MS = 650;

/**
 * Chime (Web Audio API, sin asset externo) + voz sintética en español (Web Speech API).
 * Los navegadores bloquean audio/TTS autoplay sin gesto previo del usuario, por eso
 * `habilitado` empieza en `false` y la pantalla debe llamar a `habilitar()` en el primer
 * click/tap (overlay "Toque para activar sonido" en el TV Display).
 *
 * `modo` viene de `configuraciones_globales.modo_audio_tv` (editable en /admin/settings):
 * 'tono' | 'voz' | 'tono_voz'.
 */
export function useTicketAudio(modo: ModoAudioTv = 'tono_voz') {
  const [habilitado, setHabilitado] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const habilitar = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    setHabilitado(true);
  }, []);

  const reproducirChime = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  }, []);

  const reproducirVoz = useCallback((etiquetaTurno: string, etiquetaPunto: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const mensaje = construirMensajeVoz(etiquetaTurno, etiquetaPunto);
    const utterance = new SpeechSynthesisUtterance(mensaje);
    utterance.lang = 'es-MX';
    utterance.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const anunciar = useCallback(
    (etiquetaTurno: string, etiquetaPunto: string) => {
      if (!habilitado) return;

      const suenaChime = modo === 'tono' || modo === 'tono_voz';
      const suenaVoz = modo === 'voz' || modo === 'tono_voz';

      if (suenaChime) reproducirChime();

      if (suenaVoz) {
        // Si también suena el chime, se espera a que termine para que no se pisen.
        const retardo = suenaChime ? RETARDO_VOZ_TRAS_CHIME_MS : 0;
        window.setTimeout(() => reproducirVoz(etiquetaTurno, etiquetaPunto), retardo);
      }
    },
    [habilitado, modo, reproducirChime, reproducirVoz],
  );

  return { habilitado, habilitar, anunciar };
}
