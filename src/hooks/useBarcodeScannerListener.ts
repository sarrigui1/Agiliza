'use client';

import { useEffect, useRef } from 'react';

/**
 * Intervalo máximo entre teclas para considerarlas parte de una lectura de scanner (ms).
 * Un lector de código de barras USB/Bluetooth se conecta como teclado HID y "escribe"
 * el contenido decodificado casi instantáneamente, muy por debajo de lo que cualquier
 * persona logra tecleando a mano.
 */
const INTERVALO_MAX_MS = 40;
const LONGITUD_MINIMA = 5;

/**
 * Detecta la entrada de un lector de código de barras USB/Bluetooth (emulación de
 * teclado) en cualquier parte de la pantalla. Escucha a nivel de `window` en vez de un
 * `<input>` porque el teclado numérico del Check-In (`NumericKeypad`) no usa un campo
 * de texto nativo con foco — el lector puede "escribir" en cualquier momento.
 *
 * `onScan` no necesita memoizarse: se guarda en un ref para que el listener no se
 * vuelva a montar en cada render del componente que lo usa.
 */
export function useBarcodeScannerListener(onScan: (raw: string) => void, activo: boolean = true) {
  const bufferRef = useRef('');
  const ultimaTeclaRef = useRef(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!activo) return;

    function onKeyDown(e: KeyboardEvent) {
      const ahora = Date.now();
      const transcurrido = ahora - ultimaTeclaRef.current;
      ultimaTeclaRef.current = ahora;

      if (transcurrido > INTERVALO_MAX_MS) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        const capturado = bufferRef.current;
        bufferRef.current = '';
        if (capturado.length >= LONGITUD_MINIMA) {
          onScanRef.current(capturado);
        }
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activo]);
}
