# FlowQ (Agiliza) — Manual de Instalación e Implementación

Guía paso a paso para poner en marcha una instancia nueva de FlowQ, desde el proyecto de Supabase vacío hasta el sistema desplegado y configurado en producción. Para el modelo de datos, la arquitectura y las decisiones de seguridad, ver [`ARQUITECTURA_TECNICA.md`](./ARQUITECTURA_TECNICA.md). Para el uso diario del sistema por rol, ver [`MANUAL_USUARIOS.md`](./MANUAL_USUARIOS.md).

---

## 1. Requisitos Previos

- Node.js 20+ y npm.
- Una cuenta de [Supabase](https://supabase.com) (plan gratuito es suficiente para empezar).
- Una cuenta de [Vercel](https://vercel.com) (para el despliegue y el Cron Job de cierre de jornada).
- Git.

---

## 2. Crear el Proyecto en Supabase

1. Crear un nuevo proyecto en el dashboard de Supabase (elegir región cercana a los usuarios finales).
2. Anotar, desde **Project Settings → API**:
   - **Project URL** (`https://<ref>.supabase.co`)
   - **anon / publishable key**
   - **service_role key** (⚠️ nunca compartir ni exponer al navegador)

---

## 3. Clonar el Repositorio e Instalar Dependencias

```bash
git clone https://github.com/sarrigui1/Agiliza.git
cd Agiliza
npm install
cp .env.local.example .env.local
```

Completar `.env.local` con los valores del paso anterior:

```
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # solo servidor, nunca exponer
CRON_SECRET=<string aleatorio largo>            # generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Ejecutar las Migraciones SQL

En el **SQL Editor** de Supabase (o vía `supabase db push` si el proyecto está enlazado con la CLI), ejecutar los archivos de `supabase/migrations/` **en este orden exacto** — cada uno depende de que el anterior ya haya corrido:

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `0001_init_schema.sql` | Esquema base: enums, tablas (`perfiles`, `especialidades`, `zonas`, `puntos_atencion`, `turnos`, `llamados`, `configuraciones_globales`, `auditoria`). |
| 2 | `0002_rls_policies.sql` | Habilita RLS en todas las tablas y define las políticas de acceso por rol. |
| 3 | `0003_fn_llamar_siguiente_turno.sql` | RPC de selección atómica del siguiente turno + enmascarado de privacidad. |
| 4 | `0004_rpc_operativas.sql` | RPCs: re-llamar, marcar ausente, derivar, salto de cola autorizado, generar código de ticket. |
| 5 | `0005_fn_confirmar_checkin.sql` | RPC de confirmación de check-in (`programado → en_espera`). |
| 6 | `0006_rpc_atencion.sql` | RPCs de inicio/fin de atención. |
| 7 | `0007_realtime_publication.sql` | Agrega `turnos` y `llamados` a la publicación de Supabase Realtime (sin esto, el tiempo real no emite eventos aunque RLS esté bien configurado). |
| 8 | `0008_fn_cerrar_jornada.sql` | RPC de cierre de jornada nocturno (solo invocable con `service_role`). |
| 9 | `0009_zonas_activo.sql` | Agrega la columna `activo` a `zonas`. |
| 10 | `0010_zonas_lectura_publica.sql` | Permite lectura anónima de `zonas` (la necesita el TV Display, que corre sin sesión). |
| 11 | `0011_analytics.sql` | Índices + RPCs de analítica ejecutiva (dashboard/reportes). |
| 12 | `0012_modo_audio_tv.sql` | Columna `modo_audio_tv` + lectura pública de `configuraciones_globales`. |
| 13 | `0013_especialidades_lectura_publica.sql` | Permite lectura anónima de `especialidades` activas (la necesita `/checkin`, que también corre sin sesión). |
| 14 | `0014_citas_programadas.sql` | Columna `permitir_citas_programadas` (activa/desactiva el módulo de agenda). |

> **Regla general para el futuro:** cualquier tabla nueva que deba ser leída por una pantalla pública sin sesión (`/display`, `/checkin`) necesita una política RLS explícita para el rol `anon` — no basta con crear la tabla y confiar en el comportamiento por defecto. Ver la sección de Troubleshooting más abajo.

---

## 5. Cargar Datos Base (Catálogo de Ejemplo)

Ejecutar `supabase/seed.sql` en el SQL Editor. Crea zonas, especialidades y puntos de atención de ejemplo — editables después desde `/admin/infraestructura`. Es opcional pero recomendado para no arrancar con el sistema completamente vacío.

---

## 6. Crear el Primer Usuario Administrador

Este es el **único** usuario que debe crearse manualmente fuera de la aplicación — todos los siguientes (supervisores, agentes, recepción, u otros administradores) se crean después directamente desde `/admin/usuarios` dentro del propio sistema.

1. En el Dashboard de Supabase: **Authentication → Users → Add User**.
2. Completar email y contraseña, y marcar **"Auto Confirm User"** (no hay servidor de correo configurado para confirmar la cuenta por email).
3. Copiar el **UUID** del usuario recién creado.
4. En el SQL Editor, ejecutar:

```sql
insert into public.perfiles (id, nombre_completo, rol)
values ('<uuid-copiado>', 'Administrador FlowQ', 'admin');
```

(`supabase/seed_perfiles.template.sql` trae este mismo patrón de ejemplo, incluyendo cómo crear también un agente y una cuenta de recepción si se prefiere sembrarlos todos por SQL en vez de usar `/admin/usuarios` luego).

---

## 7. Correr en Local

```bash
npm run dev
```

Abrir `http://localhost:3000/login` e iniciar sesión con el administrador creado en el paso 6. Debería aterrizar en `/admin/settings`.

---

## 8. Despliegue en Vercel

1. **Add New Project** en Vercel, importando el repositorio de GitHub.
2. En **Settings → Environment Variables**, cargar las mismas 4 variables de `.env.local` (para los entornos Production, Preview y Development):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
3. Deploy.
4. El Cron Job (`vercel.json`, `0 5 * * *` = medianoche hora Colombia/UTC-5) queda activo automáticamente — no requiere configuración manual, y corre en el plan Hobby (gratuito) al ser una sola ejecución diaria. Si el despliegue se usa en otro huso horario, recalcular el offset en `vercel.json`.
5. Verificar el endpoint del cron: debe responder `401` sin el header `Authorization: Bearer <CRON_SECRET>`, y `200` con él.

---

## 9. Configuración Inicial Dentro de la App

Ya con el administrador logueado en producción, antes de dar el sistema por operativo:

- [ ] **`/admin/infraestructura`** — revisar/editar las zonas, especialidades y puntos de atención cargados por el seed (o crear los reales de la sede), y asignar un agente a cada punto.
- [ ] **`/admin/usuarios`** — crear las cuentas reales de supervisores, agentes y recepción (reemplazando cualquier cuenta de prueba sembrada por SQL).
- [ ] **`/admin/settings`** — revisar las 5 tarjetas de configuración:
  - Algoritmo de cola e intercalado preferencial.
  - Tiempos/tolerancia, y si la sede usará el **Módulo de Citas Programadas** (apagado por defecto — actívalo solo si de verdad se van a registrar citas en `/admin/citas`).
  - Gestión de ausencias.
  - Privacidad en TV (cómo se muestra la identidad del paciente) y **Audio de Sala** (Tono / Voz / Tono + Voz).
- [ ] **Dispositivo de `/checkin`** — iniciar sesión una sola vez en ese navegador/tótem con una cuenta de rol `recepcion` (ver Troubleshooting: "Sesión no válida para registrar el turno").
- [ ] **Dispositivo de `/display?zone=<código>`** — abrir la URL con el código de zona real; si es un TV controlado por control remoto (sin touch), presionar cualquier tecla del remoto una vez para activar el audio.

---

## 10. Aplicar Migraciones Futuras

Cada vez que el repositorio incorpore una migración nueva (`00NN_descripcion.sql`), ejecutarla **una sola vez** en el SQL Editor de Supabase, en orden, antes o después de desplegar el código que la usa (el código siempre está escrito para degradar de forma segura si la columna/tabla todavía no existe — pero la funcionalidad nueva no queda activa hasta correr la migración).

---

## 11. Troubleshooting Común

**"Sesión no válida para registrar el turno" en `/checkin`.**
`/checkin` es visible sin sesión, pero *registrar* un turno requiere una sesión de fondo con rol `recepcion`, `admin` o `supervisor` (política RLS `turnos_insert_recepcion`). Solución: iniciar sesión una vez en ese navegador/dispositivo con una cuenta de rol `recepcion` en `/login`; la sesión queda guardada en cookies y no hay que repetirlo.

**Una pantalla pública (`/display`, `/checkin`) muestra datos vacíos aunque existan en la base.**
Síntoma clásico de una política RLS que solo permite `authenticated` en una tabla que una ruta pública necesita leer sin sesión. RLS no lanza error al bloquear — simplemente no devuelve filas. Revisar que la tabla tenga una política para el rol `anon` (ver migraciones `0010`, `0012`, `0013` como referencia del patrón) y el `grant select ... to anon` correspondiente.

**El TV Display no suena, o aparece "Deployment not found".**
Si el dispositivo es un Android TV / Google TV controlado por control remoto (sin touch), cualquier tecla del remoto activa el audio (no hace falta un tap exacto). Si aparece "Deployment not found", verificar que la URL guardada en ese navegador sea el dominio de producción estable, no una URL de *preview deployment* de Vercel (esas caducan con cada commit nuevo).

**El tiempo real (Realtime) no actualiza `/display` ni `/workspace`.**
Confirmar que `turnos` y `llamados` estén en la publicación `supabase_realtime` (migración `0007`) — es un paso independiente de RLS y se olvida fácilmente al agregar tablas nuevas al tiempo real.

**Quiero rotar `CRON_SECRET` o `SUPABASE_SERVICE_ROLE_KEY`.**
Generar el nuevo valor, actualizarlo en Vercel → Environment Variables, y hacer un redeploy. Tratar ambos como contraseñas — no compartirlos por chat/email sin cifrar.

---

## 12. Estructura de Carpetas (resumen)

```
src/
├── app/                    # Rutas (App Router)
│   ├── admin/              # settings, supervisor, infraestructura, dashboard, reportes, citas, usuarios
│   ├── api/cron/           # Route Handler del cierre de jornada
│   ├── checkin/, display/, workspace/, login/
├── actions/                # Server Actions (checkin, citas, workspace, settings, infrastructure, analytics, reports, usuarios)
├── components/
│   ├── ui/                 # Button, Card, Modal, Badge, Toggle, RadioCard, NumericKeypad
│   ├── charts/              # StatTile, TrendBarChart, DemandHeatmap
│   └── shared/              # SignOutButton
├── hooks/                  # useRealtimeTurnos, useRealtimeCalls, useClock, useElapsedTime, useTicketAudio, useTick
├── lib/
│   ├── supabase/            # client.ts, server.ts, admin.ts
│   ├── voiceMessage.ts, autoFitText.ts, dateRanges.ts, utils.ts
├── types/                   # database.ts (tipos generados a mano), domain.ts
└── proxy.ts                 # Control de acceso por rol (ex-middleware.ts)

supabase/
├── migrations/               # 0001..0014, en orden estricto
├── seed.sql, seed_perfiles.template.sql
```
