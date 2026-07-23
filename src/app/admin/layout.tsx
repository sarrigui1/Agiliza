import { createClient } from '@/lib/supabase/server';
import { AdminNav } from './_components/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rol = user
    ? ((await supabase.from('perfiles').select('rol').eq('id', user.id).single()).data?.rol ?? null)
    : null;

  return (
    <div className="min-h-dvh bg-bg">
      <AdminNav rol={rol} />
      {children}
    </div>
  );
}
