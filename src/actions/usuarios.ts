'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail, type ActionResult } from '@/types/domain';
import type { Perfil, RolUsuario } from '@/types/database';

/**
 * MÓDULO — Administración de Roles y Usuarios.
 *
 * `perfiles` extiende `auth.users`, pero el email vive únicamente en `auth.users`
 * (schema privado de Supabase Auth, sin vista pública) — por eso las operaciones que
 * necesitan crear la cuenta de acceso o leer el email usan `createAdminClient()`
 * (Service Role Key, bypassea RLS). Como ese cliente no respeta RLS, cada función valida
 * el rol 'admin' del llamador a mano antes de tocar nada (mismo criterio que
 * `perfiles_admin_escribe` en 0002_rls_policies.sql, replicado aquí porque el cliente
 * admin no pasa por esa policy).
 */

export type UsuarioConEmail = Perfil & { email: string };

const ROLES_VALIDOS: RolUsuario[] = ['admin', 'supervisor', 'agente', 'recepcion'];

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Sesión no válida.' };

  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single();
  if (perfil?.rol !== 'admin') {
    return { ok: false, error: 'Solo un administrador puede gestionar usuarios.' };
  }
  return { ok: true, userId: user.id };
}

export async function listarUsuarios(): Promise<ActionResult<UsuarioConEmail[]>> {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error);

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: perfiles, error: errorPerfiles }, { data: authData, error: errorAuth }] = await Promise.all([
    supabase.from('perfiles').select('*').order('nombre_completo'),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);

  if (errorPerfiles) return fail(errorPerfiles.message);
  if (errorAuth) return fail(errorAuth.message);

  const emailPorId = new Map(authData.users.map((u) => [u.id, u.email ?? '—']));

  const usuarios: UsuarioConEmail[] = (perfiles ?? []).map((p) => ({
    ...p,
    email: emailPorId.get(p.id) ?? '(cuenta eliminada)',
  }));

  return ok(usuarios);
}

export interface CrearUsuarioInput {
  email: string;
  password: string;
  nombreCompleto: string;
  rol: RolUsuario;
}

export async function crearUsuario(input: CrearUsuarioInput): Promise<ActionResult<UsuarioConEmail>> {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error);

  const email = input.email.trim().toLowerCase();
  const nombreCompleto = input.nombreCompleto.trim();

  if (!email || !email.includes('@')) return fail('Ingrese un email válido.');
  if (!nombreCompleto) return fail('El nombre completo es obligatorio.');
  if (input.password.length < 8) return fail('La contraseña debe tener al menos 8 caracteres.');
  if (!ROLES_VALIDOS.includes(input.rol)) return fail('Rol inválido.');

  const admin = createAdminClient();

  const { data: nuevoUsuario, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });

  if (errorAuth || !nuevoUsuario.user) {
    return fail(errorAuth?.message ?? 'No se pudo crear la cuenta de acceso.');
  }

  const { data: perfil, error: errorPerfil } = await admin
    .from('perfiles')
    .insert({ id: nuevoUsuario.user.id, nombre_completo: nombreCompleto, rol: input.rol })
    .select()
    .single();

  if (errorPerfil) {
    // Evita dejar una cuenta de Auth huérfana sin perfil si el insert falla.
    await admin.auth.admin.deleteUser(nuevoUsuario.user.id);
    return fail(errorPerfil.message);
  }

  revalidatePath('/admin/usuarios');
  return ok({ ...(perfil as Perfil), email });
}

export interface ActualizarUsuarioInput {
  nombreCompleto?: string;
  rol?: RolUsuario;
  activo?: boolean;
}

export async function actualizarUsuario(
  id: string,
  patch: ActualizarUsuarioInput,
): Promise<ActionResult<Perfil>> {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error);

  if (id === guard.userId && (patch.activo === false || (patch.rol && patch.rol !== 'admin'))) {
    return fail('No puedes desactivarte ni quitarte el rol de administrador a ti mismo.');
  }

  const cambios: { nombre_completo?: string; rol?: RolUsuario; activo?: boolean } = {};
  if (patch.nombreCompleto !== undefined) cambios.nombre_completo = patch.nombreCompleto.trim();
  if (patch.rol !== undefined) cambios.rol = patch.rol;
  if (patch.activo !== undefined) cambios.activo = patch.activo;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('perfiles')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();

  if (error) return fail(error.message);

  revalidatePath('/admin/usuarios');
  return ok(data as Perfil);
}

export async function restablecerPassword(id: string, nuevaPassword: string): Promise<ActionResult<null>> {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error);

  if (nuevaPassword.length < 8) return fail('La contraseña debe tener al menos 8 caracteres.');

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: nuevaPassword });
  if (error) return fail(error.message);

  return ok(null);
}
