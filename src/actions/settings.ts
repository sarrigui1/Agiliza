'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/types/domain';
import type { ConfiguracionGlobal } from '@/types/database';

/**
 * MÓDULO 1 — Motor de Configuración Global.
 * No requiere RPC: la política `settings_admin_update`/`config_admin_actualiza` de
 * `0002_rls_policies.sql` ya restringe el UPDATE de `configuraciones_globales` al rol
 * 'admin', así que un `update()` directo (respetando RLS) es suficiente y más simple
 * que envolverlo en una función de Postgres.
 */
export type ConfiguracionEditable = Omit<
  ConfiguracionGlobal,
  'id' | 'updated_at' | 'actualizado_por'
>;

export async function actualizarConfiguracionGlobal(
  input: ConfiguracionEditable,
): Promise<ActionResult<ConfiguracionGlobal>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail('Sesión no válida.');

  const { data, error } = await supabase
    .from('configuraciones_globales')
    .update({ ...input, updated_at: new Date().toISOString(), actualizado_por: user.id })
    .eq('id', 1)
    .select()
    .single();

  if (error) return fail(error.message);

  revalidatePath('/admin/settings');
  return ok(data as ConfiguracionGlobal);
}
