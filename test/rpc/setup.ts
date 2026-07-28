import { Client } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Tests de integración reales contra las RPCs de supabase/migrations/*.sql, corriendo
 * sobre el stack local de Supabase (`npx supabase start`, requiere Docker). Cada test
 * corre dentro de una transacción que se revierte al final (BEGIN/ROLLBACK) — así los
 * tests nunca se pisan entre sí ni ensucian los datos sembrados por seed.sql, sin
 * necesidad de limpiar manualmente después de cada uno.
 *
 * Se conecta directo a Postgres (no vía PostgREST/RLS): las RPC son SECURITY DEFINER así
 * que RLS no las bloquea, y lo que se está probando acá es la lógica SQL en sí, no la capa
 * de autorización de PostgREST (esa ya la ejerce el resto de la app en producción).
 */
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export async function conectar(): Promise<Client> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  await client.query('BEGIN');
  return client;
}

export async function desconectar(client: Client): Promise<void> {
  await client.query('ROLLBACK');
  await client.end();
}

export async function crearPerfil(
  client: Client,
  rol: 'admin' | 'supervisor' | 'agente' | 'recepcion' = 'admin',
): Promise<string> {
  const id = randomUUID();
  const email = `${id}@test.local`;
  await client.query(
    `insert into auth.users
       (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values
       ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, crypt('test-password-123', gen_salt('bf')), now(), now(), now(), '{}', '{}')`,
    [id, email],
  );
  await client.query(`insert into public.perfiles (id, nombre_completo, rol) values ($1, 'Test User', $2)`, [
    id,
    rol,
  ]);
  return id;
}

export async function crearEspecialidad(client: Client, nombre = 'Test Especialidad'): Promise<string> {
  const codigo = `T${randomUUID().slice(0, 4).toUpperCase()}`;
  const { rows } = await client.query(
    `insert into public.especialidades (codigo, nombre) values ($1, $2) returning id`,
    [codigo, nombre],
  );
  return rows[0].id;
}

export async function crearZona(client: Client, nombre = 'Test Zona'): Promise<string> {
  const codigo = `z-${randomUUID().slice(0, 8)}`;
  const { rows } = await client.query(`insert into public.zonas (codigo, nombre) values ($1, $2) returning id`, [
    codigo,
    nombre,
  ]);
  return rows[0].id;
}

export async function crearPuntoAtencion(
  client: Client,
  especialidadId: string,
  zonaId: string,
  nombre = 'Test Punto',
): Promise<string> {
  const codigo = `P${randomUUID().slice(0, 6).toUpperCase()}`;
  const { rows } = await client.query(
    `insert into public.puntos_atencion (codigo, nombre, zona_id, especialidad_id) values ($1, $2, $3, $4) returning id`,
    [codigo, nombre, zonaId, especialidadId],
  );
  return rows[0].id;
}

export interface FixturesCola {
  especialidadId: string;
  zonaId: string;
  puntoAtencionId: string;
  agenteAdminId: string;
}

/** Atajo para el caso común: una especialidad + zona + punto de atención + un admin (autorizado sobre cualquier turno). */
export async function crearFixturesCola(client: Client): Promise<FixturesCola> {
  const especialidadId = await crearEspecialidad(client);
  const zonaId = await crearZona(client);
  const puntoAtencionId = await crearPuntoAtencion(client, especialidadId, zonaId);
  const agenteAdminId = await crearPerfil(client, 'admin');
  return { especialidadId, zonaId, puntoAtencionId, agenteAdminId };
}

export interface OpcionesTurno {
  especialidadId: string;
  zonaId: string;
  estado?: string;
  tipoTurno?: 'cita_previa' | 'espontaneo';
  esPreferencial?: boolean;
  horaLlegadaOffsetMin?: number;
  horaCita?: Date | null;
  documentoPaciente?: string;
}

export async function crearTurno(client: Client, opciones: OpcionesTurno): Promise<{ id: string; codigo: string }> {
  const codigo = `TST-${randomUUID().slice(0, 6).toUpperCase()}`;
  const { rows } = await client.query(
    `insert into public.turnos
       (codigo, especialidad_id, zona_id, tipo_turno, es_preferencial, estado, documento_paciente, nombre_paciente, hora_llegada, hora_cita)
     values
       ($1, $2, $3, $4, $5, $6, $7, 'Paciente de Prueba', now() + ($8 || ' minutes')::interval, $9)
     returning id, codigo`,
    [
      codigo,
      opciones.especialidadId,
      opciones.zonaId,
      opciones.tipoTurno ?? 'espontaneo',
      opciones.esPreferencial ?? false,
      opciones.estado ?? 'en_espera',
      opciones.documentoPaciente ?? '1000000000',
      opciones.horaLlegadaOffsetMin ?? 0,
      opciones.horaCita ?? null,
    ],
  );
  return rows[0];
}

export async function obtenerTurno(client: Client, id: string) {
  const { rows } = await client.query(`select * from public.turnos where id = $1`, [id]);
  return rows[0];
}
