'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserPDF417Reader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { ChecksumException, DecodeHintType, FormatException, NotFoundException } from '@zxing/library';
import { Modal } from '@/components/ui/Modal';

/**
 * Traduce las excepciones de ZXing a algo diagnosticable sin abrir el código fuente de
 * la librería: NotFoundException = no detectó ningún patrón de código en el frame
 * (encuadre/distancia/enfoque); ChecksumException = detectó un patrón pero los datos no
 * pasan la validación (movimiento, código dañado o parcialmente tapado); FormatException
 * = detectó un patrón pero no logra interpretar su estructura.
 */
function describirIntento(err: unknown): string {
  if (err instanceof NotFoundException) return 'sin patrón detectado';
  if (err instanceof ChecksumException) return 'patrón detectado, checksum inválido (movimiento o daño)';
  if (err instanceof FormatException) return 'patrón detectado, formato no reconocido';
  if (err instanceof Error) return err.message;
  return 'intentando…';
}

/**
 * Sin esto, el decoder usa su pasada rápida por defecto — suficiente para un QR grande,
 * pero un PDF417 es un código apilado mucho más denso (varias filas de barras finas) y
 * casi nunca se lee sin TRY_HARDER, que le pide al decoder intentar más agresivamente
 * antes de rendirse en cada frame (más lento por frame, pero es la diferencia entre leer
 * o no leer una cédula real).
 */
const HINTS = new Map([[DecodeHintType.TRY_HARDER, true]]);

interface CedulaCameraScannerProps {
  open: boolean;
  onClose: () => void;
  onResult: (raw: string) => void;
}

/**
 * Modal de escaneo del código PDF417 de la cédula usando la cámara (tablet/webcam),
 * para los puntos que no tienen un lector USB/Bluetooth dedicado. Usa
 * `decodeFromConstraints` (no `decodeOnceFromVideoDevice`) para quedarse con el
 * `IScannerControls` y poder cortar la cámara explícitamente al cerrar el modal o al
 * desmontar — dejar el stream corriendo de fondo sería un problema de privacidad/batería
 * en un tótem que queda encendido todo el día.
 */
export function CedulaCameraScanner({ open, onClose, onResult }: CedulaCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onResultRef = useRef(onResult);
  const [error, setError] = useState<string | null>(null);
  const [intentos, setIntentos] = useState(0);
  const [ultimoEstado, setUltimoEstado] = useState('esperando cámara…');

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!open) return;

    const reader = new BrowserPDF417Reader(HINTS);
    let cancelado = false;
    let n = 0;

    reader
      .decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        videoRef.current ?? undefined,
        (result, err, controls) => {
          controlsRef.current = controls;
          if (cancelado) return;

          n += 1;
          setIntentos(n);

          if (result) {
            console.debug('[CedulaCameraScanner] lectura exitosa, texto crudo:', result.getText());
            setUltimoEstado('¡leído!');
            controls.stop();
            onResultRef.current(result.getText());
            return;
          }

          const estado = describirIntento(err);
          setUltimoEstado(estado);
          console.debug(`[CedulaCameraScanner] intento #${n}: ${estado}`);
        },
      )
      .catch((e: unknown) => {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'No se pudo acceder a la cámara.');
        }
      });

    return () => {
      cancelado = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Escanear Cédula">
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-muted">
          Acerca el código de barras (PDF417, al respaldo de la cédula) a la cámara.
        </p>
        <div className="relative w-full overflow-hidden rounded-lg border-2 border-primary bg-black">
          <video ref={videoRef} className="w-full" muted playsInline />
        </div>
        {open && !error && (
          <p className="w-full text-center font-mono text-xs text-muted">
            Intento #{intentos} — {ultimoEstado}
          </p>
        )}
        {open && error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
