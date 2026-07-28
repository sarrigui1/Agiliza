import { createClient } from '@/lib/supabase/server';
import { obtenerReporteCostos } from '@/actions/notifications';
import { NotificacionesForm } from './_components/NotificacionesForm';

export const dynamic = 'force-dynamic';

export default async function AdminNotificacionesPage() {
  const supabase = await createClient();
  const [{ data: config }, reporte] = await Promise.all([
    supabase.from('notificaciones_configuracion').select('*').eq('id', 1).single(),
    obtenerReporteCostos(30),
  ]);

  if (!config) {
    return (
      <main className="flex h-dvh items-center justify-center bg-bg text-muted">
        No se pudo cargar la configuración de notificaciones.
      </main>
    );
  }

  return (
    <NotificacionesForm
      configuracionInicial={config}
      reporteInicial={reporte.ok ? reporte.data : null}
    />
  );
}
