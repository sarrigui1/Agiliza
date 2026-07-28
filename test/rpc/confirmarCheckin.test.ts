import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Client } from 'pg';
import { conectar, desconectar, crearFixturesCola, crearTurno, type FixturesCola } from './setup';

describe('fn_confirmar_checkin', () => {
  let client: Client;
  let fx: FixturesCola;

  beforeEach(async () => {
    client = await conectar();
    fx = await crearFixturesCola(client);
  });

  afterEach(async () => {
    await desconectar(client);
  });

  it('confirma una cita programada -> en_espera, registra hora_llegada y el consentimiento', async () => {
    const cita = await crearTurno(client, {
      especialidadId: fx.especialidadId,
      zonaId: fx.zonaId,
      estado: 'programado',
      tipoTurno: 'cita_previa',
      horaCita: new Date(Date.now() + 10 * 60_000),
    });

    const { rows } = await client.query('select * from public.fn_confirmar_checkin($1, $2, $3)', [
      cita.id,
      fx.agenteAdminId,
      true,
    ]);

    expect(rows[0].estado).toBe('en_espera');
    expect(rows[0].hora_llegada).not.toBeNull();
    expect(rows[0].acepto_tratamiento_datos).toBe(true);
    expect(rows[0].fecha_consentimiento_datos).not.toBeNull();
  });

  it('rechaza confirmar un turno que no está "programado"', async () => {
    const yaEnEspera = await crearTurno(client, {
      especialidadId: fx.especialidadId,
      zonaId: fx.zonaId,
      estado: 'en_espera',
    });

    await expect(
      client.query('select * from public.fn_confirmar_checkin($1, $2, $3)', [yaEnEspera.id, fx.agenteAdminId, true]),
    ).rejects.toThrow(/Solo se puede confirmar check-in/);
  });

  it('rechaza un turno inexistente', async () => {
    await expect(
      client.query('select * from public.fn_confirmar_checkin($1, $2, $3)', [
        '00000000-0000-0000-0000-000000000000',
        fx.agenteAdminId,
        true,
      ]),
    ).rejects.toThrow(/no existe/);
  });

  it('registra una fila en auditoria con accion = checkin_confirmado', async () => {
    const cita = await crearTurno(client, {
      especialidadId: fx.especialidadId,
      zonaId: fx.zonaId,
      estado: 'programado',
    });

    await client.query('select * from public.fn_confirmar_checkin($1, $2, $3)', [cita.id, fx.agenteAdminId, false]);

    const { rows } = await client.query(
      `select * from public.auditoria where turno_id = $1 and accion = 'checkin_confirmado'`,
      [cita.id],
    );
    expect(rows).toHaveLength(1);
  });

  it('el consentimiento es "pegajoso": una vez true, un llamado posterior con false no lo revierte', async () => {
    // No aplica al flujo real (solo se llama una vez por turno), pero documenta la garantía
    // explícita del SQL: `acepto_tratamiento_datos = v_turno.acepto_tratamiento_datos or p_...`.
    const cita = await crearTurno(client, { especialidadId: fx.especialidadId, zonaId: fx.zonaId, estado: 'programado' });

    await client.query('select * from public.fn_confirmar_checkin($1, $2, $3)', [cita.id, fx.agenteAdminId, true]);

    // Revertir a 'programado' a mano para poder invocar la RPC una segunda vez en el test.
    await client.query(`update public.turnos set estado = 'programado' where id = $1`, [cita.id]);

    const { rows } = await client.query('select * from public.fn_confirmar_checkin($1, $2, $3)', [
      cita.id,
      fx.agenteAdminId,
      false,
    ]);

    expect(rows[0].acepto_tratamiento_datos).toBe(true);
  });
});
