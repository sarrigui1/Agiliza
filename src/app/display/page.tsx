import { createClient } from '@/lib/supabase/server';
import { DisplayScreen } from './_components/DisplayScreen';
import type { ModoAudioTv } from '@/types/database';

export const dynamic = 'force-dynamic';

interface DisplayPageProps {
  searchParams: Promise<{ zone?: string }>;
}

export default async function DisplayPage({ searchParams }: DisplayPageProps) {
  const { zone } = await searchParams;

  if (!zone) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-bg text-center">
        <p className="font-mono text-sm uppercase tracking-widest text-muted">Agiliza</p>
        <h1 className="text-2xl font-semibold text-text">Falta el parámetro de zona</h1>
        <p className="font-mono text-sm text-muted">
          Use la URL con el formato <span className="text-primary">/display?zone=piso2</span>
        </p>
      </main>
    );
  }

  const supabase = await createClient();

  const [{ data: zona }, { data: config }] = await Promise.all([
    supabase.from('zonas').select('*').eq('codigo', zone).maybeSingle(),
    supabase.from('configuraciones_globales').select('modo_audio_tv').eq('id', 1).maybeSingle(),
  ]);

  if (!zona) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-bg text-center">
        <h1 className="text-2xl font-semibold text-text">Zona &quot;{zone}&quot; no encontrada</h1>
        <p className="font-mono text-sm text-muted">Verifique el código configurado en Administración.</p>
      </main>
    );
  }

  const { data: llamados } = await supabase
    .from('llamados')
    .select('*')
    .eq('zona_id', zona.id)
    .order('created_at', { ascending: false })
    .limit(6);

  const modoAudio: ModoAudioTv = config?.modo_audio_tv ?? 'tono_voz';

  return <DisplayScreen zona={zona} initialCalls={llamados ?? []} modoAudio={modoAudio} />;
}
