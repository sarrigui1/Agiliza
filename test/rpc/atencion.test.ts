import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Client } from 'pg';
import {
  conectar,
  desconectar,
  crearFixturesCola,
  crearTurno,
  crearPerfil,
  crearPuntoAtencion,
  type FixturesCola,
} from './setup';

/** Lleva un turno recién creado hasta 'llamado' pasando por la RPC real (no a mano). */
async function llamarTurno(client: Client, puntoAtencionId: string, agenteId: string, turnoId: string) {
  await client.query('select public.fn_llamar_siguiente_turno($1, $2)', [puntoAtencionId, agenteId]);
  const { rows } = await client.query('select * from public.turnos where id = $1', [turnoId]);
  return rows[0];
}

describe('fn_iniciar_atencion / fn_finalizar_atencion', () => {
  let client: Client;
  let fx: FixturesCola;

  beforeEach(async () => {
    client = await conectar();
    fx = await crearFixturesCola(client);
  });

  afterEach(async () => {
    await desconectar(client);
  });

  it('ciclo completo: llamado -> en_atencion -> finalizado, actualizando el punto de atención', async () => {
    const turno = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId });
    await llamarTurno(client, fx.puntoAtencionId, fx.agenteAdminId, turno.id);

    const iniciado = await client.query('select * from public.fn_iniciar_atencion($1, $2, $3)', [
      turno.id,
      fx.puntoAtencionId,
      fx.agenteAdminId,
    ]);
    expect(iniciado.rows[0].estado).toBe('en_atencion');
    expect(iniciado.rows[0].hora_atencion).not.toBeNull();

    const puntoTrasIniciar = await client.query('select estado, agente_actual_id from public.puntos_atencion where id = $1', [
      fx.puntoAtencionId,
    ]);
    expect(puntoTrasIniciar.rows[0].estado).toBe('atendiendo');
    expect(puntoTrasIniciar.rows[0].agente_actual_id).toBe(fx.agenteAdminId);

    const finalizado = await client.query('select * from public.fn_finalizar_atencion($1, $2, $3)', [
      turno.id,
      fx.puntoAtencionId,
      fx.agenteAdminId,
    ]);
    expect(finalizado.rows[0].estado).toBe('finalizado');
    expect(finalizado.rows[0].hora_finalizacion).not.toBeNull();

    const puntoTrasFinalizar = await client.query('select estado from public.puntos_atencion where id = $1', [
      fx.puntoAtencionId,
    ]);
    expect(puntoTrasFinalizar.rows[0].estado).toBe('disponible');
  });

  it('rechaza iniciar atención de un turno que todavía no fue llamado', async () => {
    const turno = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId }); // sigue 'en_espera'

    await expect(
      client.query('select * from public.fn_iniciar_atencion($1, $2, $3)', [turno.id, fx.puntoAtencionId, fx.agenteAdminId]),
    ).rejects.toThrow(/Solo se puede iniciar atención/);
  });

  it('rechaza finalizar un turno que no está en_atencion', async () => {
    const turno = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId });
    await llamarTurno(client, fx.puntoAtencionId, fx.agenteAdminId, turno.id); // queda en 'llamado', no 'en_atencion'

    await expect(
      client.query('select * from public.fn_finalizar_atencion($1, $2, $3)', [turno.id, fx.puntoAtencionId, fx.agenteAdminId]),
    ).rejects.toThrow(/Solo se puede finalizar/);
  });

  it('rechaza a un agente sin punto de atención asignado a esa cola (no admin/supervisor)', async () => {
    const turno = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId });
    await llamarTurno(client, fx.puntoAtencionId, fx.agenteAdminId, turno.id);

    const agenteSinAsignar = await crearPerfil(client, 'agente'); // sin fila en agentes_puntos_atencion

    await expect(
      client.query('select * from public.fn_iniciar_atencion($1, $2, $3)', [turno.id, fx.puntoAtencionId, agenteSinAsignar]),
    ).rejects.toThrow(/no está autorizado/);
  });

  it('autoriza a un agente sí asignado al punto de atención de la cola', async () => {
    const turno = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId });
    await llamarTurno(client, fx.puntoAtencionId, fx.agenteAdminId, turno.id);

    const agenteAsignado = await crearPerfil(client, 'agente');
    await client.query('insert into public.agentes_puntos_atencion (perfil_id, punto_atencion_id) values ($1, $2)', [
      agenteAsignado,
      fx.puntoAtencionId,
    ]);

    const { rows } = await client.query('select * from public.fn_iniciar_atencion($1, $2, $3)', [
      turno.id,
      fx.puntoAtencionId,
      agenteAsignado,
    ]);
    expect(rows[0].estado).toBe('en_atencion');
  });

  it('rechaza iniciar atención desde un punto de atención distinto al que llamó el turno', async () => {
    const turno = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId });
    await llamarTurno(client, fx.puntoAtencionId, fx.agenteAdminId, turno.id);

    const otroPunto = await crearPuntoAtencion(client, fx.especialidadId, fx.zonaId, 'Otro Punto');

    await expect(
      client.query('select * from public.fn_iniciar_atencion($1, $2, $3)', [turno.id, otroPunto, fx.agenteAdminId]),
    ).rejects.toThrow(/fue llamado desde otro punto/);
  });
});
