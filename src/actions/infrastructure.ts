'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/types/domain';
import type { Especialidad, EstadoPuntoAtencion, PuntoAtencion, Zona } from '@/types/database';

/**
 * MÓDULO — Gestión de Infraestructura Operativa (/admin/infraestructura).
 *
 * No se crean RPC nuevas: `zonas`, `especialidades`, `puntos_atencion` y
 * `agentes_puntos_atencion` ya tienen políticas RLS "admin/supervisor pueden escribir
 * todo" desde 0002_rls_policies.sql, así que un `insert()`/`update()` directo (respetando
 * RLS) alcanza — mismo criterio que se usó para `actions/settings.ts`.
 *
 * Nota de nomenclatura: el pedido original habla de estados 'en_pausa' /
 * 'fuera_de_servicio' para los puntos de atención, pero el enum real en base de datos
 * (`estado_punto_atencion`, ver 0001_init_schema.sql) usa 'pausado' / 'fuera_de_linea'.
 * Se usan los valores reales para no crear un segundo vocabulario de estados — y se
 * excluye 'atendiendo' de lo que el admin puede fijar a mano: ese estado solo debe
 * reflejar un turno realmente activo (lo gestionan fn_iniciar_atencion/fn_finalizar_atencion).
 */

function revalidarVistasAfectadas() {
  revalidatePath('/admin/infraestructura');
  revalidatePath('/admin/settings');
  revalidatePath('/admin/supervisor');
  revalidatePath('/workspace');
  revalidatePath('/checkin');
}

/** Slug simple y determinista para generar el `codigo` único de zonas/puntos de atención. */
function slugify(texto: string): string {
  const base = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return base || 'item';
}

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

async function generarCodigoUnico(
  supabase: ClienteSupabase,
  tabla: 'zonas' | 'puntos_atencion',
  base: string,
): Promise<string> {
  const slug = slugify(base);

  for (let intento = 0; intento < 6; intento++) {
    const candidato = intento === 0 ? slug : `${slug}-${intento + 1}`;
    const { data } = await supabase.from(tabla).select('id').eq('codigo', candidato).maybeSingle();
    if (!data) return candidato;
  }
  return `${slug}-${Date.now()}`;
}

// =========================================================================================
// ZONAS
// =========================================================================================

export async function crearZona(nombre: string, descripcion?: string): Promise<ActionResult<Zona>> {
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) return fail('El nombre de la zona es obligatorio.');

  const supabase = await createClient();
  const codigo = await generarCodigoUnico(supabase, 'zonas', nombreLimpio);

  const { data, error } = await supabase
    .from('zonas')
    .insert({ codigo, nombre: nombreLimpio, descripcion: descripcion?.trim() || null })
    .select()
    .single();

  if (error) return fail(error.message);

  revalidarVistasAfectadas();
  return ok(data as Zona);
}

export async function actualizarZona(
  id: string,
  datos: Partial<Pick<Zona, 'nombre' | 'descripcion'>>,
): Promise<ActionResult<Zona>> {
  if (datos.nombre !== undefined && !datos.nombre.trim()) {
    return fail('El nombre de la zona no puede quedar vacío.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('zonas')
    .update(datos)
    .eq('id', id)
    .select()
    .single();

  if (error) return fail(error.message);

  revalidarVistasAfectadas();
  return ok(data as Zona);
}

export async function cambiarEstadoZona(id: string, activa: boolean): Promise<ActionResult<Zona>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('zonas')
    .update({ activo: activa })
    .eq('id', id)
    .select()
    .single();

  if (error) return fail(error.message);

  revalidarVistasAfectadas();
  return ok(data as Zona);
}

// =========================================================================================
// SERVICIOS / ESPECIALIDADES
// =========================================================================================

export async function crearServicio(
  nombre: string,
  codigoPrefijo: string,
): Promise<ActionResult<Especialidad>> {
  const nombreLimpio = nombre.trim();
  const codigo = codigoPrefijo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!nombreLimpio) return fail('El nombre del servicio es obligatorio.');
  if (!codigo) return fail('El prefijo de ticket es obligatorio (solo letras/números, ej. "CAR").');
  if (codigo.length > 6) return fail('El prefijo de ticket debe tener máximo 6 caracteres.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('especialidades')
    .insert({ codigo, nombre: nombreLimpio })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return fail(`Ya existe un servicio con el prefijo "${codigo}".`);
    return fail(error.message);
  }

  revalidarVistasAfectadas();
  return ok(data as Especialidad);
}

export async function actualizarServicio(
  id: string,
  datos: Partial<Pick<Especialidad, 'nombre' | 'codigo'>>,
): Promise<ActionResult<Especialidad>> {
  const cambios = { ...datos };
  if (cambios.codigo !== undefined) {
    cambios.codigo = cambios.codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cambios.codigo) return fail('El prefijo de ticket no puede quedar vacío.');
  }
  if (cambios.nombre !== undefined && !cambios.nombre.trim()) {
    return fail('El nombre del servicio no puede quedar vacío.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('especialidades')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return fail(`Ya existe un servicio con ese prefijo.`);
    return fail(error.message);
  }

  revalidarVistasAfectadas();
  return ok(data as Especialidad);
}

export async function cambiarEstadoServicio(id: string, activo: boolean): Promise<ActionResult<Especialidad>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('especialidades')
    .update({ activo })
    .eq('id', id)
    .select()
    .single();

  if (error) return fail(error.message);

  revalidarVistasAfectadas();
  return ok(data as Especialidad);
}

// =========================================================================================
// PUNTOS DE ATENCIÓN
// =========================================================================================

export async function crearPuntoAtencion(
  nombre: string,
  zonaId: string,
  especialidadId: string,
): Promise<ActionResult<PuntoAtencion>> {
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) return fail('El nombre del punto de atención es obligatorio.');
  if (!zonaId) return fail('Debe seleccionar una zona.');
  if (!especialidadId) return fail('Debe seleccionar un servicio/especialidad.');

  const supabase = await createClient();
  const codigo = await generarCodigoUnico(supabase, 'puntos_atencion', nombreLimpio);

  const { data, error } = await supabase
    .from('puntos_atencion')
    .insert({
      codigo,
      nombre: nombreLimpio,
      zona_id: zonaId,
      especialidad_id: especialidadId,
      estado: 'fuera_de_linea',
    })
    .select()
    .single();

  if (error) return fail(error.message);

  revalidarVistasAfectadas();
  return ok(data as PuntoAtencion);
}

export async function actualizarPuntoAtencion(
  id: string,
  datos: Partial<Pick<PuntoAtencion, 'nombre' | 'zona_id' | 'especialidad_id'>>,
): Promise<ActionResult<PuntoAtencion>> {
  if (datos.nombre !== undefined && !datos.nombre.trim()) {
    return fail('El nombre del punto de atención no puede quedar vacío.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('puntos_atencion')
    .update(datos)
    .eq('id', id)
    .select()
    .single();

  if (error) return fail(error.message);

  revalidarVistasAfectadas();
  return ok(data as PuntoAtencion);
}

/**
 * Asigna al agente responsable de un punto de atención. Reemplaza cualquier asignación
 * previa de ESE punto (un punto físico tiene un único responsable primario a la vez) —
 * no toca `puntos_atencion.agente_actual_id`, que refleja quién está activamente
 * atendiendo ahora mismo y solo lo gestionan fn_iniciar_atencion/fn_finalizar_atencion.
 */
export async function asignarAgenteAPunto(
  agenteId: string,
  puntoAtencionId: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error: errorBorrado } = await supabase
    .from('agentes_puntos_atencion')
    .delete()
    .eq('punto_atencion_id', puntoAtencionId);

  if (errorBorrado) return fail(errorBorrado.message);

  // `agenteId` vacío = "Sin asignar" (desasignar): el DELETE de arriba ya lo resuelve,
  // no hay nada que insertar. Sin este corte, se intentaba insertar perfil_id='' y la
  // FK constraint fallaba DESPUÉS del delete, dejando el punto desasignado en la base
  // de datos pero mostrando al agente anterior en la UI hasta el próximo refresh manual.
  if (!agenteId) {
    revalidarVistasAfectadas();
    return ok(null);
  }

  const { error: errorInsercion } = await supabase
    .from('agentes_puntos_atencion')
    .insert({ perfil_id: agenteId, punto_atencion_id: puntoAtencionId });

  if (errorInsercion) return fail(errorInsercion.message);

  revalidarVistasAfectadas();
  return ok(null);
}

/** Subconjunto de `estado_punto_atencion` que el admin puede fijar manualmente. */
export type EstadoPuntoAdministrable = Exclude<EstadoPuntoAtencion, 'atendiendo'>;

export async function cambiarEstadoPunto(
  id: string,
  estado: EstadoPuntoAdministrable,
): Promise<ActionResult<PuntoAtencion>> {
  const supabase = await createClient();

  const { data: puntoActual, error: errorLectura } = await supabase
    .from('puntos_atencion')
    .select('estado')
    .eq('id', id)
    .single();

  if (errorLectura) return fail(errorLectura.message);
  if (puntoActual.estado === 'atendiendo') {
    return fail('No se puede cambiar el estado: el punto está atendiendo un turno activo en este momento.');
  }

  const { data, error } = await supabase
    .from('puntos_atencion')
    .update({ estado })
    .eq('id', id)
    .select()
    .single();

  if (error) return fail(error.message);

  revalidarVistasAfectadas();
  return ok(data as PuntoAtencion);
}
