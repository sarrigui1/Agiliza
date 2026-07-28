'use client';

import { useSyncExternalStore } from 'react';

/**
 * Señal de conectividad a nivel de navegador (`online`/`offline`), complementaria al
 * estado del canal de Realtime: reacciona de inmediato a una caída de red, mientras que
 * Realtime puede tardar unos segundos en notar que el socket se cortó.
 *
 * `useSyncExternalStore` (no `useState` + `useEffect`) porque `navigator.onLine` es una
 * fuente externa que no existe en el servidor — el snapshot de servidor (`true`) evita el
 * mismatch de hidratación, y React aplica el valor real del cliente de forma segura tan
 * pronto termina de hidratar, sin el round-trip de un `setState` síncrono en un efecto.
 */
function suscribir(notificar: () => void) {
  window.addEventListener('online', notificar);
  window.addEventListener('offline', notificar);
  return () => {
    window.removeEventListener('online', notificar);
    window.removeEventListener('offline', notificar);
  };
}

function obtenerEstadoCliente(): boolean {
  return navigator.onLine;
}

function obtenerEstadoServidor(): boolean {
  return true;
}

export function useNetworkStatus(): boolean {
  return useSyncExternalStore(suscribir, obtenerEstadoCliente, obtenerEstadoServidor);
}
