import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Client } from 'pg';
import { conectar, desconectar, crearFixturesCola, crearTurno, crearEspecialidad, type FixturesCola } from './setup';

describe('fn_llamar_siguiente_turno', () => {
  let client: Client;
  let fx: FixturesCola;

  beforeEach(async () => {
    client = await conectar();
    fx = await crearFixturesCola(client);
  });

  afterEach(async () => {
    await desconectar(client);
  });

  it('retorna null cuando la cola está vacía (no explota, no inventa un turno)', async () => {
    const { rows } = await client.query('select public.fn_llamar_siguiente_turno($1, $2) as turno', [
      fx.puntoAtencionId,
      fx.agenteAdminId,
    ]);

    expect(rows[0].turno).toBeNull();
  });

  it('llama los turnos en orden de llegada y transiciona el estado atómicamente', async () => {
    const a = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, horaLlegadaOffsetMin: -30 });
    const b = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, horaLlegadaOffsetMin: -20 });
    const c = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, horaLlegadaOffsetMin: -10 });

    const primero = await client.query('select * from public.fn_llamar_siguiente_turno($1, $2)', [
      fx.puntoAtencionId,
      fx.agenteAdminId,
    ]);
    expect(primero.rows[0].id).toBe(a.id);
    expect(primero.rows[0].estado).toBe('llamado');
    expect(primero.rows[0].punto_atencion_id).toBe(fx.puntoAtencionId);
    expect(primero.rows[0].intentos_llamado).toBe(1);
    expect(primero.rows[0].hora_llamado).not.toBeNull();

    const segundo = await client.query('select * from public.fn_llamar_siguiente_turno($1, $2)', [
      fx.puntoAtencionId,
      fx.agenteAdminId,
    ]);
    expect(segundo.rows[0].id).toBe(b.id);

    const tercero = await client.query('select * from public.fn_llamar_siguiente_turno($1, $2)', [
      fx.puntoAtencionId,
      fx.agenteAdminId,
    ]);
    expect(tercero.rows[0].id).toBe(c.id);

    const cuarto = await client.query('select public.fn_llamar_siguiente_turno($1, $2) as turno', [
      fx.puntoAtencionId,
      fx.agenteAdminId,
    ]);
    expect(cuarto.rows[0].turno).toBeNull();
  });

  it('registra el llamado en `llamados` con la etiqueta pública enmascarada (solo_codigo por defecto)', async () => {
    const turno = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId });

    await client.query('select public.fn_llamar_siguiente_turno($1, $2)', [fx.puntoAtencionId, fx.agenteAdminId]);

    const { rows } = await client.query('select * from public.llamados where turno_id = $1', [turno.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].etiqueta_publica).toBe(turno.codigo);
    expect(rows[0].tipo_llamado).toBe('inicial');
    expect(rows[0].agente_id).toBe(fx.agenteAdminId);
  });

  it('no llama turnos de otra especialidad/zona (aislamiento de colas)', async () => {
    const otraEspecialidadId = await crearEspecialidad(client, 'Otra Especialidad');
    await crearTurno(client, { especialidadId: otraEspecialidadId, zonaId: fx.zonaId });

    const { rows } = await client.query('select public.fn_llamar_siguiente_turno($1, $2) as turno', [
      fx.puntoAtencionId,
      fx.agenteAdminId,
    ]);

    expect(rows[0].turno).toBeNull();
  });

  it('con el intercalado por defecto (1 preferencial : 2 normal), el primer llamado del día prioriza un turno preferencial aunque haya llegado después', async () => {
    const normalTemprano = await crearTurno(client, {
      especialidadId: fx.especialidadId,
      zonaId: fx.zonaId,
      esPreferencial: false,
      horaLlegadaOffsetMin: -30,
    });
    const preferencialTardio = await crearTurno(client, {
      especialidadId: fx.especialidadId,
      zonaId: fx.zonaId,
      esPreferencial: true,
      horaLlegadaOffsetMin: -5,
    });

    const { rows } = await client.query('select * from public.fn_llamar_siguiente_turno($1, $2)', [
      fx.puntoAtencionId,
      fx.agenteAdminId,
    ]);

    expect(rows[0].id).toBe(preferencialTardio.id);
    expect(rows[0].id).not.toBe(normalTemprano.id);
  });
});
