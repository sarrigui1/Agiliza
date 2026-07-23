import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from './_components/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: config } = await supabase.from('configuraciones_globales').select('*').eq('id', 1).single();

  if (!config) {
    return (
      <main className="flex h-dvh items-center justify-center bg-bg text-muted">
        No se pudo cargar la configuración global.
      </main>
    );
  }

  return <SettingsForm configuracionInicial={config} />;
}
