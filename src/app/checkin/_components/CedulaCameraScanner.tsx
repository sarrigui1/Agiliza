'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserPDF417Reader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { Modal } from '@/components/ui/Modal';

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

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!open) return;

    const reader = new BrowserPDF417Reader();
    let cancelado = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current ?? undefined,
        (result, _err, controls) => {
          controlsRef.current = controls;
          if (cancelado || !result) return;
          controls.stop();
          onResultRef.current(result.getText());
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
        {open && error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
