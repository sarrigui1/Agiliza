'use server';

import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/types/domain';

/**
 * MÓDULO — Analytics Ejecutivo (/admin/dashboard, /admin/reportes).
 *
 * Todas las agregaciones corren en Postgres (ver supabase/migrations/0011_analytics.sql)
 * en vez de traer cada turno al cliente para sumarlo en JS — con un mes completo de
 * datos, sumar en el servidor de base de datos escala; sumar en Node después de traer
 * miles de filas no.
 */

export interface MetricasEjecutivas {
  totalGenerados: number;
  totalAtendidos: number;
  totalAusentes: number;
  tasaAusentismo: number;
  tpeGlobalMinutos: number | null;
  tpaGlobalMinutos: number | null;
  cumplimientoSla: number | null;
  /** % vs el periodo inmediatamente anterior de igual duración; null si no hay base de comparación. */
  variacionAtendidos: number | null;
}

export async function obtenerMetricasEjecutivas(
  fechaInicio: Date,
  fechaFin: Date,
): Promise<ActionResult<MetricasEjecutivas>> {
  const supabase = await createClient();

  const duracionMs = fechaFin.getTime() - fechaInicio.getTime();
  const inicioAnterior = new Date(fechaInicio.getTime() - duracionMs);

  const [{ data: actual, error }, { data: anterior }] = await Promise.all([
    supabase.rpc('fn_metricas_ejecutivas', {
      p_desde: fechaInicio.toISOString(),
      p_hasta: fechaFin.toISOString(),
    }),
    supabase.rpc('fn_metricas_ejecutivas', {
      p_desde: inicioAnterior.toISOString(),
      p_hasta: fechaInicio.toISOString(),
    }),
  ]);

  if (error) return fail(error.message);

  const fila = actual?.[0];
  if (!fila) return fail('No se pudieron calcular las métricas del periodo.');

  const filaAnterior = anterior?.[0];
  const variacionAtendidos =
    filaAnterior && filaAnterior.total_atendidos > 0
      ? Math.round(
          ((fila.total_atendidos - filaAnterior.total_atendidos) / filaAnterior.total_atendidos) * 1000,
        ) / 10
      : null;

  return ok({
    totalGenerados: fila.total_generados,
    totalAtendidos: fila.total_atendidos,
    totalAusentes: fila.total_ausentes,
    tasaAusentismo: Number(fila.tasa_ausentismo ?? 0),
    tpeGlobalMinutos: fila.tpe_global_minutos !== null ? Number(fila.tpe_global_minutos) : null,
    tpaGlobalMinutos: fila.tpa_global_minutos !== null ? Number(fila.tpa_global_minutos) : null,
    cumplimientoSla: fila.cumplimiento_sla !== null ? Number(fila.cumplimiento_sla) : null,
    variacionAtendidos,
  });
}

export interface CeldaHeatmap {
  diaSemana: number; // 1=lunes .. 7=domingo (ISO)
  hora: number;
  cantidad: number;
}

export async function obtenerHeatmapDemanda(
  fechaInicio: Date,
  fechaFin: Date,
): Promise<ActionResult<CeldaHeatmap[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('fn_heatmap_demanda', {
    p_desde: fechaInicio.toISOString(),
    p_hasta: fechaFin.toISOString(),
  });

  if (error) return fail(error.message);

  return ok(
    (data ?? []).map((fila) => ({
      diaSemana: fila.dia_semana,
      hora: fila.hora,
      cantidad: fila.cantidad,
    })),
  );
}

export interface PuntoTendencia {
  fecha: string; // 'YYYY-MM-DD'
  cantidad: number;
}

/**
 * No estaba en la lista original de 3 acciones, pero el gráfico de "Tendencia de
 * Demanda" del dashboard la necesita (ver nota en 0011_analytics.sql junto a
 * fn_tendencia_diaria) — `obtenerHeatmapDemanda` agrupa por día-de-semana, no sirve
 * para reconstruir una serie por fecha calendario.
 */
export async function obtenerTendenciaDiaria(
  fechaInicio: Date,
  fechaFin: Date,
): Promise<ActionResult<PuntoTendencia[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('fn_tendencia_diaria', {
    p_desde: fechaInicio.toISOString(),
    p_hasta: fechaFin.toISOString(),
  });

  if (error) return fail(error.message);

  return ok((data ?? []).map((fila) => ({ fecha: fila.fecha, cantidad: fila.cantidad })));
}

export interface RendimientoServicio {
  especialidadId: string;
  nombre: string;
  totalAtenciones: number;
  tpeMinutos: number | null;
  tpaMinutos: number | null;
}

export interface RendimientoAgente {
  agenteId: string;
  nombre: string;
  totalAtenciones: number;
  tpaMinutos: number | null;
}

export interface RendimientoServicioYAgente {
  porServicio: RendimientoServicio[];
  porAgente: RendimientoAgente[];
}

export async function obtenerRendimientoPorServicioYAgente(
  fechaInicio: Date,
  fechaFin: Date,
): Promise<ActionResult<RendimientoServicioYAgente>> {
  const supabase = await createClient();

  const [{ data: servicios, error: errorServicios }, { data: agentes, error: errorAgentes }] =
    await Promise.all([
      supabase.rpc('fn_rendimiento_por_servicio', {
        p_desde: fechaInicio.toISOString(),
        p_hasta: fechaFin.toISOString(),
      }),
      supabase.rpc('fn_rendimiento_por_agente', {
        p_desde: fechaInicio.toISOString(),
        p_hasta: fechaFin.toISOString(),
      }),
    ]);

  if (errorServicios) return fail(errorServicios.message);
  if (errorAgentes) return fail(errorAgentes.message);

  return ok({
    porServicio: (servicios ?? []).map((s) => ({
      especialidadId: s.especialidad_id,
      nombre: s.nombre_servicio,
      totalAtenciones: s.total_atenciones,
      tpeMinutos: s.tpe_minutos !== null ? Number(s.tpe_minutos) : null,
      tpaMinutos: s.tpa_minutos !== null ? Number(s.tpa_minutos) : null,
    })),
    porAgente: (agentes ?? []).map((a) => ({
      agenteId: a.agente_id,
      nombre: a.nombre_agente,
      totalAtenciones: a.total_atenciones,
      tpaMinutos: a.tpa_minutos !== null ? Number(a.tpa_minutos) : null,
    })),
  });
}
