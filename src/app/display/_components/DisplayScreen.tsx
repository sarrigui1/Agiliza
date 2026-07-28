'use client';

import { Volume2, History, MapPin, WifiOff } from 'lucide-react';
import { useRealtimeCalls } from '@/hooks/useRealtimeCalls';
import { useTicketAudio } from '@/hooks/useTicketAudio';
import { useClock } from '@/hooks/useClock';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTick } from '@/hooks/useTick';
import { useEffect } from 'react';
import type { Llamado, ModoAudioTv, Zona } from '@/types/database';
import { cn } from '@/lib/utils';
import { calcularTamanoFuente } from '@/lib/autoFitText';

interface DisplayScreenProps {
  zona: Zona;
  initialCalls: Llamado[];
  modoAudio: ModoAudioTv;
  textoInformativo: string;
}

/** A partir de cuánto tiempo sin confirmar conexión se avisa que los datos pueden estar desactualizados. */
const UMBRAL_DATOS_DESACTUALIZADOS_MS = 3 * 60_000;

/**
 * `Date.now()` es impuro, así que se llama desde funciones aparte invocadas en JSX (mismo
 * patrón que `minutosDesde` en lib/utils.ts) en vez de en el cuerpo del componente — ahí
 * lo marca `react-hooks/purity` porque el resultado dependería de CUÁNDO se ejecuta el
 * render, no solo de las props/estado.
 */
function sonDatosDesactualizados(ultimaActualizacion: number): boolean {
  return Date.now() - ultimaActualizacion > UMBRAL_DATOS_DESACTUALIZADOS_MS;
}

function formatearMinutosTranscurridos(desde: number): string {
  const minutos = Math.floor((Date.now() - desde) / 60_000);
  if (minutos < 1) return 'hace menos de 1 min';
  return `hace ${minutos} min`;
}

export function DisplayScreen({ zona, initialCalls, modoAudio, textoInformativo }: DisplayScreenProps) {
  const { calls, onNuevoLlamado, estadoConexion, ultimaActualizacion } = useRealtimeCalls(zona.id, initialCalls);
  const { habilitado, habilitar, anunciar } = useTicketAudio(modoAudio);
  const { hora, fecha } = useClock();
  const enLinea = useNetworkStatus();
  useTick(15_000); // re-renderiza cada 15s para mantener "hace X min" fresco en el aviso de abajo

  const sinConexion = !enLinea || estadoConexion === 'reconectando';
  const datosDesactualizados = sinConexion && sonDatosDesactualizados(ultimaActualizacion);

  useEffect(() => {
    onNuevoLlamado((llamado) => anunciar(llamado.etiqueta_publica, llamado.etiqueta_punto_atencion));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anunciar]);

  // Muchos TVs corren con un control remoto (sin mouse ni touch): un click exacto sobre
  // el botón de activación puede no llegar nunca si el foco D-pad no cae encima. Cualquier
  // tecla del remoto ya cuenta como gesto de usuario válido para el navegador, así que se
  // habilita el audio con la primera tecla presionada, sin depender del foco.
  useEffect(() => {
    if (habilitado) return;
    const onKeyDown = () => habilitar();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [habilitado, habilitar]);

  const actual = calls[0] ?? null;
  const recientes = calls.slice(1, 5);

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-bg">
      {!habilitado && (
        <button
          type="button"
          autoFocus
          onClick={habilitar}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-bg/95 backdrop-blur-sm"
        >
          <Volume2 className="size-12 text-primary" />
          <p className="font-mono text-lg uppercase tracking-widest text-text">
            Presione cualquier tecla del control remoto para activar el sonido
          </p>
        </button>
      )}

      <header className="flex items-center justify-between border-b border-border px-16 py-6">
        <p className="font-mono text-xl font-bold tracking-widest text-primary">AGILIZA</p>
        {sinConexion ? (
          <p className="flex items-center gap-2 font-mono text-sm text-warning">
            <WifiOff className="size-4" />
            RECONECTANDO
          </p>
        ) : (
          <p className="flex items-center gap-2 font-mono text-sm text-primary">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            REALTIME SYNC
          </p>
        )}
      </header>

      {datosDesactualizados && (
        <div className="flex items-center justify-center gap-2 border-b border-warning/40 bg-warning/10 px-6 py-2 font-mono text-sm text-warning">
          <WifiOff className="size-4 shrink-0" />
          Sin conexión — mostrando la última actualización conocida ({formatearMinutosTranscurridos(ultimaActualizacion)})
        </div>
      )}

      <div className="grid flex-1 grid-cols-[3fr_2fr] overflow-hidden">
        {/* Hero: turno actual */}
        <section className="flex flex-col justify-center gap-8 px-16">
          <p className="font-mono text-2xl uppercase tracking-[0.3em] text-muted">Turno Actual</p>

          {actual ? (
            <div
              key={actual.id}
              className="animate-flash-in rounded-lg border-2 border-primary bg-surface px-12 py-10 glow-primary"
            >
              <p
                className="break-words font-mono font-bold leading-tight tracking-wider text-primary"
                style={{
                  fontSize: `${calcularTamanoFuente(actual.etiqueta_publica, { max: 112, min: 40, factor: 1200 })}px`,
                }}
              >
                {actual.etiqueta_publica}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-border bg-surface px-12 py-10">
              <p className="font-mono text-4xl text-muted">Esperando el próximo llamado…</p>
            </div>
          )}

          {actual && (
            <div className="flex items-center gap-3">
              <span className="size-3 rounded-full bg-primary animate-sonar" />
              <h2 className="text-6xl font-bold text-text">{actual.etiqueta_punto_atencion}</h2>
            </div>
          )}
        </section>

        {/* Sidebar: llamados recientes */}
        <aside className="flex flex-col border-l border-border px-10 py-8">
          <p className="mb-6 flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted">
            <History className="size-4" />
            Llamados Recientes
          </p>
          <ul className="flex flex-1 flex-col divide-y divide-border">
            {recientes.length === 0 && <li className="py-4 text-sm text-muted">Sin registros aún.</li>}
            {recientes.map((llamado, i) => (
              <li
                key={llamado.id}
                className={cn('py-5', i === 0 && 'text-text', i > 0 && 'text-muted')}
              >
                <p
                  className="break-words font-mono font-bold leading-tight tracking-wide"
                  style={{
                    fontSize: `${calcularTamanoFuente(llamado.etiqueta_publica, { max: 30, min: 16, factor: 320 })}px`,
                  }}
                >
                  {llamado.etiqueta_publica}
                </p>
                <p className="text-sm">{llamado.etiqueta_punto_atencion}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Footer / ticker */}
      <footer className="flex h-[120px] items-center justify-between gap-8 border-t border-primary bg-surface px-16">
        <p className="flex shrink-0 items-center gap-2 font-mono text-sm uppercase tracking-widest text-primary">
          <MapPin className="size-4" />
          Zona: {zona.nombre}
        </p>
        <div className="flex-1 overflow-hidden">
          <p className="animate-marquee whitespace-nowrap font-mono text-sm text-muted">{textoInformativo}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-2xl text-text">{hora}</p>
          <p className="text-xs text-muted">{fecha}</p>
        </div>
      </footer>
    </main>
  );
}
