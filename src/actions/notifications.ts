'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/types/domain';
import type { NotificacionesConfiguracion } from '@/types/database';
import { enviarWhatsApp } from '@/lib/notifications/twilioWhatsApp';
import { formatearTelefonoE164 } from '@/lib/notifications/phone';

/**
 * MÓDULO 6 — Motor de Notificaciones WhatsApp.
 * Mismo patrón que src/actions/settings.ts: la política RLS `notif_config_update_admin`
 * (0019_whatsapp_notificaciones.sql) ya restringe el UPDATE al rol 'admin'.
 */
export type ConfiguracionNotificacionesEditable = Omit<
  NotificacionesConfiguracion,
  'id' | 'updated_at' | 'actualizado_por'
>;

export async function actualizarConfiguracionNotificaciones(
  input: ConfiguracionNotificacionesEditable,
): Promise<ActionResult<NotificacionesConfiguracion>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('Sesión no válida.');

  const { data, error } = await supabase
    .from('notificaciones_configuracion')
    .update({ ...input, updated_at: new Date().toISOString(), actualizado_por: user.id })
    .eq('id', 1)
    .select()
    .single();

  if (error) return fail(error.message);

  revalidatePath('/admin/notificaciones');
  return ok(data as NotificacionesConfiguracion);
}

/**
 * El envío de prueba llama directo a Twilio sin pasar por una tabla con RLS (no hay nada
 * que bloquee la mutación a nivel de base de datos), así que el rol se valida a mano acá
 * — evita que cualquier sesión autenticada dispare mensajes reales (con costo) contra la
 * cuenta de Twilio del cliente.
 */
async function requiereAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión no válida.' };

  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single();
  if (perfil?.rol !== 'admin') {
    return { ok: false, error: 'Solo un administrador puede enviar un mensaje de prueba.' };
  }

  return { ok: true };
}

export async function enviarNotificacionPrueba(telefono: string): Promise<ActionResult<{ sid: string }>> {
  const chequeo = await requiereAdmin();
  if (!chequeo.ok) return fail(chequeo.error);

  const telefonoE164 = formatearTelefonoE164(telefono);
  if (!telefonoE164) {
    return fail('Número no reconocido. Use 10 dígitos (Colombia) o formato E.164 completo con "+".');
  }

  const resultado = await enviarWhatsApp(
    telefonoE164,
    'Este es un mensaje de prueba del motor de notificaciones de Agiliza. Si lo recibiste, la integración con Twilio está funcionando correctamente.',
  );

  if (!resultado.ok) {
    return fail(resultado.mensaje ?? 'No se pudo enviar el mensaje de prueba.');
  }

  return ok({ sid: resultado.sid! });
}

export interface ResumenCostosEvento {
  tipoEvento: string;
  cantidad: number;
  fallidos: number;
  costoUsd: number;
  costoCop: number;
}

export interface ReporteCostos {
  totalMensajes: number;
  totalFallidos: number;
  totalCostoUsd: number;
  totalCostoCop: number;
  porEvento: ResumenCostosEvento[];
}

export async function obtenerReporteCostos(dias = 30): Promise<ActionResult<ReporteCostos>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('Sesión no válida.');

  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('notificaciones_log')
    .select('tipo_evento, estado, costo_usd, costo_cop')
    .gte('created_at', desde);

  if (error) return fail(error.message);

  const filas = data ?? [];
  const porEventoMap = new Map<string, ResumenCostosEvento>();

  for (const fila of filas) {
    const actual = porEventoMap.get(fila.tipo_evento) ?? {
      tipoEvento: fila.tipo_evento,
      cantidad: 0,
      fallidos: 0,
      costoUsd: 0,
      costoCop: 0,
    };
    actual.cantidad += 1;
    if (fila.estado === 'fallido') actual.fallidos += 1;
    actual.costoUsd += Number(fila.costo_usd ?? 0);
    actual.costoCop += Number(fila.costo_cop ?? 0);
    porEventoMap.set(fila.tipo_evento, actual);
  }

  const porEvento = [...porEventoMap.values()].sort((a, b) => b.cantidad - a.cantidad);

  return ok({
    totalMensajes: filas.length,
    totalFallidos: filas.filter((f) => f.estado === 'fallido').length,
    totalCostoUsd: porEvento.reduce((acc, e) => acc + e.costoUsd, 0),
    totalCostoCop: porEvento.reduce((acc, e) => acc + e.costoCop, 0),
    porEvento,
  });
}
