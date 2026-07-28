import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Client } from 'pg';
import { conectar, desconectar, crearFixturesCola, crearTurno, type FixturesCola } from './setup';

describe('fn_cerrar_jornada', () => {
  let client: Client;
  let fx: FixturesCola;

  beforeEach(async () => {
    client = await conectar();
    fx = await crearFixturesCola(client);
    // fn_cerrar_jornada opera sobre TODA la tabla, no solo los fixtures de este test —
    // seed.sql deja turnos en estados cancelables (en_espera/programado) que, sin esto,
    // se sumarían al conteo esperado y volverían el test dependiente de datos externos.
    // Es seguro: vive dentro de la transacción que se revierte en afterEach.
    await client.query(
      `update public.turnos set estado = 'cancelado' where estado in ('programado', 'en_espera', 'llamado', 'reingresado')`,
    );
  });

  afterEach(async () => {
    await desconectar(client);
  });

  it('cancela turnos sin atender (programado/en_espera/llamado/reingresado) y respeta el resto de estados', async () => {
    const programado = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, estado: 'programado' });
    const enEspera = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, estado: 'en_espera' });
    const llamado = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, estado: 'llamado' });
    const reingresado = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, estado: 'reingresado' });
    const enAtencion = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, estado: 'en_atencion' });
    const finalizado = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, estado: 'finalizado' });

    const { rows } = await client.query('select public.fn_cerrar_jornada() as expirados');
    expect(rows[0].expirados).toBe(4);

    const estados = await client.query(
      `select id, estado from public.turnos where id = any($1::uuid[])`,
      [[programado.id, enEspera.id, llamado.id, reingresado.id, enAtencion.id, finalizado.id]],
    );
    const estadoPorId = Object.fromEntries(estados.rows.map((r) => [r.id, r.estado]));

    expect(estadoPorId[programado.id]).toBe('cancelado');
    expect(estadoPorId[enEspera.id]).toBe('cancelado');
    expect(estadoPorId[llamado.id]).toBe('cancelado');
    expect(estadoPorId[reingresado.id]).toBe('cancelado');
    // No se corta una consulta en curso ni se toca un turno ya terminal.
    expect(estadoPorId[enAtencion.id]).toBe('en_atencion');
    expect(estadoPorId[finalizado.id]).toBe('finalizado');
  });

  it('libera un punto de atención marcado "atendiendo" sin un turno en_atencion real (turno huérfano expirado)', async () => {
    const turnoLlamado = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, estado: 'llamado' });
    await client.query(
      `update public.puntos_atencion set estado = 'atendiendo', agente_actual_id = $1 where id = $2`,
      [fx.agenteAdminId, fx.puntoAtencionId],
    );
    // referencia cruzada para que el turno "pertenezca" a este punto, como en el flujo real
    await client.query(`update public.turnos set punto_atencion_id = $1 where id = $2`, [
      fx.puntoAtencionId,
      turnoLlamado.id,
    ]);

    await client.query('select public.fn_cerrar_jornada()');

    const { rows } = await client.query('select estado from public.puntos_atencion where id = $1', [fx.puntoAtencionId]);
    expect(rows[0].estado).toBe('disponible');
  });

  it('NO libera un punto de atención que sí tiene un turno en_atencion vigente', async () => {
    const turnoActivo = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, estado: 'en_atencion' });
    await client.query(
      `update public.puntos_atencion set estado = 'atendiendo', agente_actual_id = $1 where id = $2`,
      [fx.agenteAdminId, fx.puntoAtencionId],
    );
    await client.query(`update public.turnos set punto_atencion_id = $1 where id = $2`, [
      fx.puntoAtencionId,
      turnoActivo.id,
    ]);

    await client.query('select public.fn_cerrar_jornada()');

    const { rows } = await client.query('select estado from public.puntos_atencion where id = $1', [fx.puntoAtencionId]);
    expect(rows[0].estado).toBe('atendiendo');
  });

  it('registra una fila de auditoría con el conteo de expirados', async () => {
    await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, estado: 'en_espera' });

    const { rows } = await client.query('select public.fn_cerrar_jornada() as expirados');

    const auditoria = await client.query(
      `select metadata from public.auditoria where accion = 'cierre_jornada' order by created_at desc limit 1`,
    );
    expect(auditoria.rows).toHaveLength(1);
    expect(auditoria.rows[0].metadata.turnos_expirados).toBe(rows[0].expirados);
  });

  it('devuelve 0 sin fallar cuando no hay nada que expirar', async () => {
    const { rows } = await client.query('select public.fn_cerrar_jornada() as expirados');
    expect(rows[0].expirados).toBe(0);
  });
});
