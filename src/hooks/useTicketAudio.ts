'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Chime (Web Audio API, sin asset externo) + voz sintética en español (Web Speech API).
 * Los navegadores bloquean audio/TTS autoplay sin gesto previo del usuario, por eso
 * `habilitado` empieza en `false` y la pantalla debe llamar a `habilitar()` en el primer
 * click/tap (overlay "Toque para activar sonido" en el TV Display).
 */
export function useTicketAudio() {
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

  const anunciar = useCallback(
    (etiquetaTurno: string, etiquetaPunto: string) => {
      if (!habilitado) return;
      reproducirChime();

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const mensaje = `Turno ${etiquetaTurno.split('').join(' ')}, dirigirse a ${etiquetaPunto}`;
      const utterance = new SpeechSynthesisUtterance(mensaje);
      utterance.lang = 'es-CO';
      utterance.rate = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [habilitado, reproducirChime],
  );

  return { habilitado, habilitar, anunciar };
}
