# FlowQ (Agiliza) — Documento Técnico de Arquitectura

Sistema de Llamado y Gestión de Turnos en tiempo real. Este documento describe el stack, la arquitectura, el modelo de datos, la seguridad y las recomendaciones operativas. Para instalar el sistema paso a paso, ver [`MANUAL_INSTALACION_IMPLEMENTACION.md`](./MANUAL_INSTALACION_IMPLEMENTACION.md); para el uso diario por rol, ver [`MANUAL_USUARIOS.md`](./MANUAL_USUARIOS.md).

---

## 1. Resumen del Sistema

FlowQ gestiona el flujo completo de atención al público: desde el check-in de un paciente/cliente (con cita previa o espontáneo), pasando por la cola de espera, el llamado y la atención en un punto físico (consultorio, caja, módulo), hasta el cierre administrativo de la jornada. Incluye una pantalla pública de TV con actualización en tiempo real, un panel operativo para agentes, y un panel administrativo con configuración, supervisión, gestión de infraestructura y analítica ejecutiva.

## 2. Stack Tecnológico

| Capa | Tecnología | Versión | Rol |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.2.11 | RSC, Server Actions, Route Handlers, Turbopack |
| UI | React | 19.2 | Client/Server Components |
| Lenguaje | TypeScript | 5.x | Tipado estricto en todo el proyecto |
| Estilos | Tailwind CSS | v4 (`@theme` en `globals.css`) | Design system "Kinetic Neon Enterprise" (dark-mode fijo) |
| Iconografía | lucide-react | 1.25 | Iconos en toda la UI |
| Utilidades CSS | clsx + tailwind-merge | — | Helper `cn()` en `src/lib/utils.ts` |
| Backend / DB | Supabase (Postgres) | — | Base de datos, autenticación, tiempo real, funciones RPC |
| Autenticación | Supabase Auth (email/password) | — | `@supabase/ssr` para sesión basada en cookies |
| Tiempo real | Supabase Realtime (`postgres_changes`) | — | WebSockets sobre `turnos` y `llamados` |
| Hosting | Vercel | — | Deploy continuo desde `main`, Cron Jobs |
| Cron | Vercel Cron + Route Handler | — | Cierre de jornada nocturno |

**Nota:** `framer-motion` está instalado en `package.json` pero no se usa actualmente en ningún componente. Se puede remover para reducir el bundle, o queda disponible si se decide agregar animaciones más adelante.

## 3. Arquitectura General

```
┌─────────────┐      RSC + Server Actions       ┌──────────────────────┐
│  Navegador  │ ◄──────────────────────────────► │   Next.js (Vercel)   │
│ (5 vistas + │      Realtime (WebSocket)        │  App Router / Node   │
│  TV pública)│ ◄──────────────────────────────► │  Runtime             │
└─────────────┘                                  └──────────┬───────────┘
                                                             │ anon / authenticated
                                                             │ (RLS aplica siempre)
                                                             ▼
                                                  ┌──────────────────────┐
                                                  │   Supabase Postgres  │
                                                  │  Tablas + RLS + RPC  │
                                                  │  Realtime publication│
                                                  └──────────┬───────────┘
                                                             ▲
                                                  service_role (bypassa RLS)
                                                             │
                                                  ┌──────────┴───────────┐
                                                  │  Vercel Cron Job     │
                                                  │  /api/cron/cierre-   │
                                                  │  jornada (CRON_SECRET)│
                                                  └──────────────────────┘
```

**Principio de diseño central:** casi ninguna mutación de datos se hace con `update()`/`insert()` directo desde el cliente. Las transiciones de estado de un turno (llamar, re-llamar, iniciar atención, finalizar, marcar ausente, derivar, salto de cola) pasan por **funciones RPC de Postgres (`SECURITY DEFINER`)** que garantizan atomicidad (con `pg_advisory_xact_lock` + `FOR UPDATE SKIP LOCKED`) y aplican las reglas de negocio (algoritmo de cola, intercalado preferencial, límites de ausencia) del lado del servidor de base de datos, no en la aplicación. Las excepciones son los CRUD de catálogo (zonas, servicios, puntos de atención, configuración global), que sí usan `update()`/`insert()` directo porque ahí la única regla es "rol admin/supervisor puede escribir", ya cubierta por RLS.

## 4. Modelo de Datos

### Tablas principales (`supabase/migrations/0001_init_schema.sql`)

| Tabla | Propósito |
|---|---|
| `perfiles` | Extiende `auth.users` con `rol` (`admin`\|`supervisor`\|`agente`\|`recepcion`) y `nombre_completo`. |
| `especialidades` | Servicios/especialidades (ej. Cardiología), con `codigo` = prefijo de ticket (ej. `CAR`). |
| `zonas` | Ubicaciones físicas (ej. "Piso 2"), con `codigo` usado en la URL pública del TV (`/display?zone=piso2`). |
| `puntos_atencion` | Consultorios/cajas/módulos. Pertenecen a una zona y una especialidad; tienen `estado` (`fuera_de_linea`\|`disponible`\|`atendiendo`\|`pausado`). |
| `agentes_puntos_atencion` | Asignación agente ↔ punto de atención (quién es responsable de operarlo). |
| `configuraciones_globales` | Fila única (`id=1`) con las reglas de negocio editables: algoritmo de cola, tolerancias, límite de ausencias, formato de privacidad TV, modo de audio TV (`tono`\|`voz`\|`tono_voz`), si el módulo de Citas Programadas está activo, intercalado preferencial/normal. |
| `turnos` | El ticket del paciente. Contiene PII (`documento_paciente`, `nombre_paciente`) — nunca se expone a `anon`. Estado (`estado_turno`): `programado → en_espera → llamado → en_atencion → finalizado`, con ramas `cancelado`, `ausente → reingresado`. |
| `llamados` | Log de eventos de llamado, **ya anonimizado** en el momento de insertarse (`etiqueta_publica`). Es la fuente de datos del TV Display — nunca contiene PII. |
| `auditoria` | Trazabilidad de saltos de cola, cierres de jornada, ausencias, etc. |

### Separación PII / dato público

`turnos` (con PII) y `llamados` (público, anonimizado) están deliberadamente separadas. El formato de anonimización (`solo_codigo` / `iniciales_parcial` / `nombre_completo`, configurable en `/admin/settings`) se aplica **una sola vez, en el momento del INSERT** (dentro de las RPC de llamado), no en cada lectura — así el TV Display nunca necesita tocar la tabla con datos sensibles.

## 5. Seguridad

- **RLS (Row Level Security)** habilitado en todas las tablas. Política general: cada rol solo puede leer/escribir lo que le corresponde; `turnos` requiere estar `authenticated` con rol de staff; `llamados` y `zonas` son de lectura pública (`anon`) porque no contienen PII y el propio código de zona ya viaja expuesto en la URL del TV.
- **Autenticación:** email + password vía Supabase Auth. Sesión gestionada con cookies (`@supabase/ssr`), refrescada en cada request por `src/proxy.ts`.
- **`src/proxy.ts`** (antes `middleware.ts` — Next.js 16 renombró la convención): aplica control de acceso por rol a nivel de ruta como defensa en profundidad adicional a RLS. Redirige a `/login` si no hay sesión, y a la home del rol si el usuario intenta entrar a una sección que no le corresponde.
- **Service Role Key:** se usa en `src/lib/supabase/admin.ts`, solo server-side. Dos consumidores: el Route Handler del cron, y `src/actions/usuarios.ts` (crear/eliminar cuentas de `auth.users` y leer emails, algo que RLS no puede exponer). Como este cliente bypasea RLS, cada función de `usuarios.ts` valida a mano que quien llama tenga rol `admin` antes de ejecutar nada — nunca se importa desde código que corra en el navegador.
- **`fn_cerrar_jornada`** solo tiene `GRANT EXECUTE` para `service_role` — ningún usuario autenticado, ni siquiera admin, puede invocarla desde el cliente.
- **RPCs de transición de estado** validan explícitamente que el agente esté autorizado sobre la cola del turno (`fn_agente_autorizado_turno`) antes de mutar nada, porque al ser `SECURITY DEFINER` bypasan RLS.

## 6. Tiempo Real

- Tablas incluidas en la publicación `supabase_realtime`: `turnos` y `llamados` (ver `0007_realtime_publication.sql`). Sin esto, los canales de Supabase Realtime se suscriben "exitosamente" pero Postgres nunca emite el evento — bug real que se encontró y corrigió durante las pruebas.
- **Cuidado con la carrera de sesión:** `supabase-js` carga la sesión desde las cookies de forma asíncrona y solo después llama internamente a `realtime.setAuth()`. Si un canal se suscribe antes de que eso termine, negocia como `anon` y las políticas RLS descartan todos los eventos en silencio (sin error visible). La solución aplicada en `useRealtimeTurnos`/`useRealtimeCalls` es esperar `await supabase.auth.getSession()` antes de llamar a `.channel().subscribe()`.
- Realtime filtra por una sola columna (`zona_id=eq.<uuid>`); el filtrado adicional por especialidad se hace en el cliente, porque una zona puede tener varias especialidades.

## 7. Rutas y Módulos

| Ruta | Acceso | Módulo |
|---|---|---|
| `/login` | Público | Autenticación |
| `/display?zone=<codigo>` | Público (anon) | TV Display — Módulo 4 |
| `/checkin` | Sesión de dispositivo (rol `recepcion`) | Admisión / Check-In — Módulo 2 |
| `/workspace` | `agente`, `admin`, `supervisor` | Panel del Agente — Módulo 3 |
| `/admin/settings` | `admin`, `supervisor` | Configuración Global — Módulo 1 |
| `/admin/supervisor` | `admin`, `supervisor` | Supervisión Operativa — Módulo 5 |
| `/admin/infraestructura` | `admin`, `supervisor` | Gestión de Zonas/Servicios/Puntos |
| `/admin/citas` | `admin`, `supervisor` | Gestión de Citas del Día (módulo opcional) |
| `/admin/dashboard` | `admin`, `supervisor` | Analytics Ejecutivo |
| `/admin/reportes` | `admin`, `supervisor` | Resumen ejecutivo imprimible (PDF vía navegador) |
| `/admin/usuarios` | `admin` únicamente | Roles y Usuarios (usa Service Role Key) |
| `/api/cron/cierre-jornada` | `CRON_SECRET` (sin sesión) | Cierre de jornada nocturno |

## 8. Funciones RPC (PL/pgSQL)

| Función | Migración | Propósito |
|---|---|---|
| `fn_llamar_siguiente_turno` | 0003 | Selección atómica del siguiente turno según algoritmo + intercalado preferencial. |
| `fn_enmascarar_turno` | 0003 | Aplica el formato de privacidad configurado antes de escribir en `llamados`. |
| `fn_re_llamar_turno` | 0004 | Re-notifica sin cambiar de estado, respetando el intervalo mínimo configurado. |
| `fn_marcar_ausente` | 0004 | Requiere haber alcanzado el límite de llamados; aplica reingreso penalizado. |
| `fn_derivar_turno` | 0004 | Cierra el turno actual y genera uno nuevo en otra especialidad. |
| `fn_salto_de_cola_autorizado` | 0004 | Llama fuera de orden con motivo obligatorio, registrado en `auditoria`. |
| `fn_agente_autorizado_turno` / `fn_generar_codigo_turno` | 0004 | Helpers de autorización y generación de ticket. |
| `fn_confirmar_checkin` | 0005 | Transición `programado → en_espera` tras validar la llegada. |
| `fn_iniciar_atencion` / `fn_finalizar_atencion` | 0006 | Ciclo `llamado → en_atencion → finalizado`; actualizan `puntos_atencion.estado`. |
| `fn_cerrar_jornada` | 0008 | Cancela turnos no atendidos al final del día (solo `service_role`). |
| `fn_metricas_ejecutivas` / `fn_heatmap_demanda` / `fn_tendencia_diaria` / `fn_rendimiento_por_servicio` / `fn_rendimiento_por_agente` | 0011 | Agregaciones del dashboard ejecutivo (corren en Postgres, no traen filas crudas al cliente). |

## 9. Instalación

Ver [`MANUAL_INSTALACION_IMPLEMENTACION.md`](./MANUAL_INSTALACION_IMPLEMENTACION.md) para la guía paso a paso completa (proyecto de Supabase, variables de entorno, las 14 migraciones en orden, primer usuario administrador, y despliegue en Vercel).

## 10. Recomendaciones Operativas

- **Backups:** activar Point-in-Time Recovery (PITR) en Supabase si el plan lo permite; como mínimo, backups diarios automáticos.
- **Monitoreo:** revisar el log de `/api/cron/cierre-jornada` en Vercel cada mañana durante las primeras semanas, hasta confirmar que corre de forma estable.
- **Zona horaria del cron:** `vercel.json` está fijado a `0 5 * * *` (UTC) asumiendo Colombia (UTC-5, sin horario de verano). Si el despliegue se usa en otro país/zona horaria, recalcular el offset.
- **`CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY`:** tratar como contraseñas — no compartir por chat/email sin cifrar, rotar si se filtran.
- **Antes de agregar tablas nuevas:** siempre habilitar RLS explícitamente y decidir conscientemente el alcance de cada policy — el bug de `/display` mostrando "zona no encontrada" ocurrió precisamente por una política RLS demasiado restrictiva en una tabla que necesitaba lectura pública.
- **Antes de agregar tablas a lógica de tiempo real:** no olvidar `alter publication supabase_realtime add table ...` — Realtime no funciona automáticamente solo con RLS configurado.
- **Escalamiento:** los índices actuales (`idx_turnos_especialidad_zona_estado`, `idx_turnos_hora_llegada`, etc.) cubren los patrones de consulta actuales. Si el volumen de `turnos` crece significativamente (varios años de histórico), considerar particionar `turnos` por fecha o archivar turnos antiguos a una tabla histórica.
- **`framer-motion`:** está en `package.json` sin uso actual; remover con `npm uninstall framer-motion` si no se planea usar, para reducir el tamaño del bundle.

## 11. Limitaciones Conocidas

Documentadas aquí para que no se den por sorpresa en producción — son omisiones conscientes de alcance, no bugs:

- **Salto de Cola Autorizado** (`fn_salto_de_cola_autorizado` / `saltarColaAutorizado`) existe en el backend pero no tiene botón en la UI del Workspace todavía.
- **Reasignación Masiva** e **Intervenir** en `/admin/supervisor` son botones de UI que muestran un aviso "disponible en la próxima fase" — no hay RPC de reasignación implementada aún.
- **Pausa de agente:** el header del Workspace muestra "Disponible"/"Atendiendo" derivado del turno activo, no hay un toggle manual de pausa todavía.
- **Atribución de rendimiento por agente** (`fn_rendimiento_por_agente`): usa la asignación *actual* en `agentes_puntos_atencion`, no un histórico por turno — si un agente cambió de punto a mitad del periodo consultado, el reparto no es perfectamente preciso. Suficiente para una vista ejecutiva agregada, no para auditoría individual exacta.
- **Recuperación de contraseña:** no hay flujo de autoservicio "¿Olvidó su contraseña?" en `/login`. Un administrador puede asignar una nueva contraseña a cualquier usuario desde `/admin/usuarios` (no requiere entrar al Dashboard de Supabase, a diferencia de antes).

## 12. Estructura de Carpetas (resumen)

```
src/
├── app/                    # Rutas (App Router)
│   ├── admin/              # settings, supervisor, infraestructura, citas, dashboard, reportes, usuarios
│   ├── api/cron/           # Route Handler del cierre de jornada
│   ├── checkin/, display/, workspace/, login/
├── actions/                # Server Actions (checkin, citas, workspace, settings, infrastructure, analytics, reports, usuarios)
├── components/
│   ├── ui/                 # Button, Card, Modal, Badge, Toggle, RadioCard, NumericKeypad
│   ├── charts/             # StatTile, TrendBarChart, DemandHeatmap
│   └── shared/              # SignOutButton
├── hooks/                  # useRealtimeTurnos, useRealtimeCalls, useClock, useElapsedTime, useTicketAudio, useTick
├── lib/
│   ├── supabase/            # client.ts, server.ts, admin.ts (Service Role, usado por cron y por actions/usuarios.ts)
│   ├── voiceMessage.ts, autoFitText.ts, dateRanges.ts, utils.ts
├── types/                   # database.ts (tipos generados a mano), domain.ts
└── proxy.ts                 # Control de acceso por rol (ex-middleware.ts)

supabase/
├── migrations/               # 0001..0014, en orden estricto
├── seed.sql, seed_perfiles.template.sql
```
