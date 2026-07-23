import { listarUsuarios } from '@/actions/usuarios';
import { UsuariosView } from './_components/UsuariosView';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  const res = await listarUsuarios();

  return <UsuariosView usuariosIniciales={res.ok ? res.data : []} errorCarga={res.ok ? null : res.error} />;
}
