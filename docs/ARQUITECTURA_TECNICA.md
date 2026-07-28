# Agiliza — Documento Técnico de Arquitectura

Sistema de Llamado y Gestión de Turnos en tiempo real. Este documento describe el stack, la arquitectura, el modelo de datos, la seguridad, las integraciones externas y las recomendaciones operativas. Para instalar el sistema paso a paso, ver [`MANUAL_INSTALACION_IMPLEMENTACION.md`](./MANUAL_INSTALACION_IMPLEMENTACION.md); para el uso diario por rol, ver [`MANUAL_USUARIOS.md`](./MANUAL_USUARIOS.md).

---

## 1. Resumen del Sistema

Agiliza gestiona el flujo completo de atención al público: desde el check-in de un paciente/cliente (con cita previa, espontáneo, o con lectura de cédula colombiana), pasando por la cola de espera, el llamado y la atención en un punto físico (consultorio, caja, módulo), hasta el cierre administrativo de la jornada. Incluye una pantalla pública de TV con actualización en tiempo real (con indicador real de conexión y degradación controlada ante cortes de internet), notificaciones al paciente por WhatsApp, un panel operativo para agentes, y un panel administrativo con configuración, supervisión, gestión de infraestructura, analítica ejecutiva y monitoreo de errores.

## 2. Stack Tecnológico

| Capa | Tecnología | Versión | Rol |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.2.11 | RSC, Server Actions, Route Handlers, Turbopack |
| UI | React | 19.2 | Client/Server Components |
| Lenguaje | TypeScript | 5.x | Tipado estricto en todo el proyecto |
| Estilos | Tailwind CSS | v4 (`@theme` en `globals.css`) | Design system "Kinetic Neon Enterprise", con tema Oscuro (por defecto) y Claro configurables |
| Iconografía | lucide-react | 1.25 | Iconos en toda la UI |
| Utilidades CSS | clsx + tailwind-merge | — | Helper `cn()` en `src/lib/utils.ts` |
| Backend / DB | Supabase (Postgres) | — | Base de datos, autenticación, tiempo real, funciones RPC |
| Autenticación | Supabase Auth (email/password) | — | `@supabase/ssr` para sesión basada en cookies |
| Tiempo real | Supabase Realtime (`postgres_changes`) | — | WebSockets sobre `turnos` y `llamados`, con estado de conexión expuesto a la UI |
| Lectura de cédula | `@zxing/browser` + `@zxing/library` | 0.2.1 / 0.23.0 | Lectura de código de barras PDF417 (cédula colombiana) por cámara; lector físico USB/Bluetooth se lee como teclado (sin librería) |
| Notificaciones | Twilio (WhatsApp Business API) | — | Avisos al paciente — ver Sección 9 |
| Monitoreo de errores | `@sentry/nextjs` | 10.x | Captura de excepciones cliente/servidor/edge — ver Sección 9 |
| Pruebas | Vitest + `pg` (dev) | 4.x / 8.x | Unitarias + integración real de RPCs — ver Sección 10 |
| Hosting | Vercel | — | Deploy continuo desde `main`, Cron Jobs |
| Cron | Vercel Cron + Route Handler | — | Cierre de jornada nocturno |

**Nota:** `framer-motion` está instalado en `package.json` pero no se usa actualmente en ningún componente. Se puede remover para reducir el bundle, o queda disponible si se decide agregar animaciones más adelante.

## 3. Arquitectura General

```
┌─────────────┐      RSC + Server Actions       ┌──────────────────────┐
│  Navegador  │ ◄──────────────────────────────► │   Next.js (Vercel)   │
│ (6 vistas + │      Realtime (WebSocket)        │  App Router / Node   │
│  TV pública)│ ◄──────────────────────────────► │  Runtime             │
└─────────────┘                                  └──────────┬───────────┘
      │                                                      │ anon / authenticated
      │ errores JS                                           │ (RLS aplica siempre)
      ▼                                                      ▼
┌─────────────┐                                  ┌──────────────────────┐
│   Sentry    │ ◄────────── errores server ────── │   Supabase Postgres  │
│ (DSN público)│                                  │  Tablas + RLS + RPC  │
└─────────────┘                                  │  Realtime publication│
                                                  └──────────┬───────────┘
                                                             ▲
                                                  service_role (bypassa RLS)
                                                             │
                            ┌────────────────────────────────┴───────────────────────┐
                            │                                                        │
                 ┌──────────┴───────────┐                              ┌─────────────┴──────────┐
                 │  Vercel Cron Job     │                              │  after() (Next.js)      │
                 │  /api/cron/cierre-   │                              │  dispararNotificacion() │
                 │  jornada (CRON_SECRET)│                              │  → Twilio WhatsApp API  │
                 └──────────────────────┘                              └─────────────┬───────────┘
                                                                                       │ StatusCallback
                                                                          ┌────────────┴────────────┐
                                                                          │ /api/webhooks/twilio/    │
                                                                          │ status (firma HMAC-SHA1) │
                                                                          └──────────────────────────┘
```

**Principio de diseño central:** casi ninguna mutación de datos se hace con `update()`/`insert()` directo desde el cliente. Las transiciones de estado de un turno (llamar, re-llamar, iniciar atención, finalizar, marcar ausente, derivar, salto de cola, confirmar check-in) pasan por **funciones RPC de Postgres (`SECURITY DEFINER`)** que garantizan atomicidad (con `pg_advisory_xact_lock` + `FOR UPDATE SKIP LOCKED`) y aplican las reglas de negocio (algoritmo de cola, intercalado preferencial, límites de ausencia) del lado del servidor de base de datos, no en la aplicación. Las excepciones son los CRUD de catálogo (zonas, servicios, puntos de atención, configuración global, configuración de notificaciones), que sí usan `update()`/`insert()` directo porque ahí la única regla es "rol admin/supervisor puede escribir", ya cubierta por RLS.

**Notificaciones como efecto secundario, no bloqueante:** el envío de WhatsApp se dispara con `after()` de `next/server` *después* de responder al usuario (ver `src/actions/checkin.ts`, `src/actions/workspace.ts`) — un check-in o un llamado nunca esperan a que Twilio responda, y si Twilio falla o está mal configurado, el flujo de turnos sigue funcionando igual.

## 4. Modelo de Datos

### Tablas principales (`supabase/migrations/0001_init_schema.sql` en adelante)

| Tabla | Propósito |
|---|---|
| `perfiles` | Extiende `auth.users` con `rol` (`admin`\|`supervisor`\|`agente`\|`recepcion`) y `nombre_completo`. |
| `especialidades` | Servicios/especialidades (ej. Cardiología), con `codigo` = prefijo de ticket (ej. `CAR`). |
| `zonas` | Ubicaciones físicas (ej. "Piso 2"), con `codigo` usado en la URL pública del TV (`/display?zone=piso2`). |
| `puntos_atencion` | Consultorios/cajas/módulos. Pertenecen a una zona y una especialidad; tienen `estado` (`fuera_de_linea`\|`disponible`\|`atendiendo`\|`pausado`). |
| `agentes_puntos_atencion` | Asignación agente ↔ punto de atención (quién es responsable de operarlo). |
| `configuraciones_globales` | Fila única (`id=1`) con las reglas de negocio editables: algoritmo de cola, tolerancias, límite de ausencias, formato de privacidad TV, modo de audio TV, si Citas Programadas/Lectura de Cédula están activas, intercalado, **tema visual** (oscuro/claro), **texto informativo del TV**, **política de tratamiento de datos** (Habeas Data). |
| `turnos` | El ticket del paciente. Contiene PII (`documento_paciente`, `nombre_paciente`, **`telefono_paciente`** opcional) — nunca se expone a `anon`. Incluye **`acepto_tratamiento_datos`** / **`fecha_consentimiento_datos`** (Habeas Data). Estado (`estado_turno`): `programado → en_espera → llamado → en_atencion → finalizado`, con ramas `cancelado`, `ausente → reingresado`. |
| `llamados` | Log de eventos de llamado, **ya anonimizado** en el momento de insertarse (`etiqueta_publica`). Es la fuente de datos del TV Display — nunca contiene PII. |
| `auditoria` | Trazabilidad de saltos de cola, cierres de jornada, ausencias, check-ins confirmados, etc. |
| `notificaciones_configuracion` | Fila única (`id=1`). Switch maestro + toggle por evento + costeo (USD/COP + TRM) del motor de WhatsApp. **No contiene credenciales de Twilio** — esas viven en variables de entorno (ver Sección 9.1). |
| `notificaciones_log` | Bitácora/auditoría de cada intento de envío de WhatsApp: evento, teléfono, estado (`pendiente`→`enviado`→`entregado`/`leido`/`fallido`), costo estimado, SID de Twilio, error si lo hubo. |

### Separación PII / dato público

`turnos` (con PII) y `llamados` (público, anonimizado) están deliberadamente separadas. El formato de anonimización (`solo_codigo` / `iniciales_parcial` / `nombre_completo`, configurable en `/admin/settings`) se aplica **una sola vez, en el momento del INSERT** (dentro de las RPC de llamado), no en cada lectura — así el TV Display nunca necesita tocar la tabla con datos sensibles.

## 5. Seguridad

- **RLS (Row Level Security)** habilitado en todas las tablas. Política general: cada rol solo puede leer/escribir lo que le corresponde; `turnos` requiere estar `authenticated` con rol de staff; `llamados` y `zonas` son de lectura pública (`anon`) porque no contienen PII y el propio código de zona ya viaja expuesto en la URL del TV. `notificaciones_configuracion`/`notificaciones_log` son legibles por `admin`/`supervisor`, pero la escritura del log ocurre siempre con el cliente Service Role (no hay policy de insert/update para `authenticated`).
- **Autenticación:** email + password vía Supabase Auth. Sesión gestionada con cookies (`@supabase/ssr`), refrescada en cada request por `src/proxy.ts`.
- **`src/proxy.ts`** (antes `middleware.ts` — Next.js 16 renombró la convención): aplica control de acceso por rol a nivel de ruta como defensa en profundidad adicional a RLS. Redirige a `/login` si no hay sesión, y a la home del rol si el usuario intenta entrar a una sección que no le corresponde. Rutas públicas: `/login`, `/display`, `/checkin`, `/api/cron`, `/api/webhooks`.
- **Service Role Key:** se usa en `src/lib/supabase/admin.ts`, solo server-side. Consumidores: el Route Handler del cron, `src/actions/usuarios.ts`, y el motor de notificaciones (`src/lib/notifications/dispatch.ts`, el webhook de Twilio). Como este cliente bypasea RLS, cada función que lo usa valida a mano la autorización que corresponda antes de ejecutar nada — nunca se importa desde código que corra en el navegador.
- **`fn_cerrar_jornada`** solo tiene `GRANT EXECUTE` para `service_role` — ningún usuario autenticado, ni siquiera admin, puede invocarla desde el cliente.
- **RPCs de transición de estado** validan explícitamente que el agente esté autorizado sobre la cola del turno (`fn_agente_autorizado_turno`) antes de mutar nada, porque al ser `SECURITY DEFINER` bypasan RLS.
- **Habeas Data (Ley 1581 de 2012):** el paciente debe marcar consentimiento explícito en `/checkin` antes de generar el ticket o confirmar una cita; el texto de la política es editable por sede en `/admin/settings` (trae marcadores `[ENTRE CORCHETES]` que cada cliente debe reemplazar con sus datos reales, idealmente con revisión legal). Ver `supabase/migrations/0018_habeas_data.sql`.
- **Webhook de Twilio:** `/api/webhooks/twilio/status` valida `X-Twilio-Signature` con HMAC-SHA1 sobre el Auth Token (algoritmo oficial de Twilio, ver `src/lib/notifications/twilioSignature.ts`) — no un secreto propio inventado.
- **Credenciales de terceros:** Twilio (Account SID, Auth Token, número de WhatsApp) y Sentry (DSN) viven en variables de entorno, nunca en tablas editables desde el panel admin ni hardcodeadas en el código.

## 6. Tiempo Real

- Tablas incluidas en la publicación `supabase_realtime`: `turnos` y `llamados` (ver `0007_realtime_publication.sql`). Sin esto, los canales de Supabase Realtime se suscriben "exitosamente" pero Postgres nunca emite el evento — bug real que se encontró y corrigió durante las pruebas.
- **Cuidado con la carrera de sesión:** `supabase-js` carga la sesión desde las cookies de forma asíncrona y solo después llama internamente a `realtime.setAuth()`. Si un canal se suscribe antes de que eso termine, negocia como `anon` y las políticas RLS descartan todos los eventos en silencio (sin error visible). La solución aplicada en `useRealtimeTurnos`/`useRealtimeCalls` es esperar `await supabase.auth.getSession()` antes de llamar a `.channel().subscribe()`.
- Realtime filtra por una sola columna (`zona_id=eq.<uuid>`); el filtrado adicional por especialidad se hace en el cliente, porque una zona puede tener varias especialidades.
- **Resiliencia offline** (`src/hooks/useRealtimeCalls.ts`, `src/hooks/useNetworkStatus.ts`): el estado real de la suscripción (`conectado`/`reconectando`) y de `navigator.onLine` se exponen a la UI — `/display` nunca borra el último turno conocido al perder conexión (evita pantalla en blanco), y `/checkin` bloquea el envío proactivamente en vez de dejar que la petición falle en silencio. La reconexión del socket en sí la maneja Supabase automáticamente (backoff incorporado); el código solo refleja el estado, no reimplementa el retry.

## 7. Rutas y Módulos

| Ruta | Acceso | Módulo |
|---|---|---|
| `/login` | Público | Autenticación |
| `/display?zone=<codigo>` | Público (anon) | TV Display — Módulo 4 |
| `/checkin` | Sesión de dispositivo (rol `recepcion`) | Admisión / Check-In — Módulo 2 (con lectura de cédula opcional y consentimiento Habeas Data) |
| `/workspace` | `agente`, `admin`, `supervisor` | Panel del Agente — Módulo 3 |
| `/admin/settings` | `admin`, `supervisor` | Configuración Global — Módulo 1 |
| `/admin/supervisor` | `admin`, `supervisor` | Supervisión Operativa — Módulo 5 |
| `/admin/infraestructura` | `admin`, `supervisor` | Gestión de Zonas/Servicios/Puntos |
| `/admin/citas` | `admin`, `supervisor` | Gestión de Citas del Día (módulo opcional) |
| `/admin/dashboard` | `admin`, `supervisor` | Analytics Ejecutivo |
| `/admin/reportes` | `admin`, `supervisor` | Resumen ejecutivo imprimible (PDF vía navegador) |
| `/admin/usuarios` | `admin` únicamente | Roles y Usuarios (usa Service Role Key) |
| `/admin/notificaciones` | `admin`, `supervisor` (envío de prueba solo `admin`) | Motor de Notificaciones WhatsApp |
| `/api/cron/cierre-jornada` | `CRON_SECRET` (sin sesión) | Cierre de jornada nocturno |
| `/api/webhooks/twilio/status` | Firma de Twilio (sin sesión) | Estado de entrega de WhatsApp |

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
| `fn_confirmar_checkin` | 0005, actualizada en 0018 | Transición `programado → en_espera`; desde 0018 también registra el consentimiento de datos en la misma transacción. |
| `fn_iniciar_atencion` / `fn_finalizar_atencion` | 0006 | Ciclo `llamado → en_atencion → finalizado`; actualizan `puntos_atencion.estado`. |
| `fn_cerrar_jornada` | 0008 | Cancela turnos no atendidos al final del día (solo `service_role`). |
| `fn_metricas_ejecutivas` / `fn_heatmap_demanda` / `fn_tendencia_diaria` / `fn_rendimiento_por_servicio` / `fn_rendimiento_por_agente` | 0011 | Agregaciones del dashboard ejecutivo (corren en Postgres, no traen filas crudas al cliente). |

Todas verificadas con tests de integración reales (`test/rpc/`, ver Sección 10) excepto las de derivación/salto de cola/re-llamado/ausencia (0004), que no tienen tests automatizados todavía.

## 9. Integraciones Externas

Todas son opcionales — el sistema funciona sin ninguna de las dos, quedan inertes si falta la credencial correspondiente. Ninguna credencial vive en el código ni en una tabla editable desde el panel; todas son variables de entorno (`.env.local` en desarrollo, Vercel → Environment Variables en producción — **recordar hacer Redeploy después de agregar/cambiar una**, Vercel no las recarga en caliente).

### 9.1 Twilio (WhatsApp)

- **Qué hace:** notifica al paciente por WhatsApp cuando su turno queda registrado (check-in exitoso) y cuando lo llaman a un módulo. Motor extensible (`notificaciones_configuracion` ya trae toggles para "aviso previo", "recordatorio de cita" y "encuesta post-atención", pero esos tres eventos **todavía no están conectados** — requieren infraestructura de jobs programados que no se construyó).
- **Código clave:** `src/lib/notifications/` (`twilioWhatsApp.ts` = cliente HTTP directo a la API de Twilio, sin el SDK oficial; `dispatch.ts` = interceptor que revisa el switch maestro/toggles antes de enviar; `templates.ts` = textos de los mensajes; `phone.ts` = formato E.164 Colombia; `twilioSignature.ts` = validación del webhook).
- **Variables de entorno:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, `NEXT_PUBLIC_SITE_URL` (opcional, para que Twilio pueda avisar el estado de entrega vía webhook).
- **Cómo actualizar/rotar:** cambiar los valores en Vercel + `.env.local`, redeploy. Si se cambia de cuenta de Twilio completa, no hace falta tocar código — todo se resuelve por variable de entorno.
- **Panel de control:** `/admin/notificaciones` — switch maestro, toggles por evento, costeo (USD/COP + TRM configurable a mano), botón de prueba, reporte de costos de 30 días.
- **Cuenta Trial vs. producción:** una cuenta Trial de Twilio solo envía a números verificados o unidos al Sandbox de WhatsApp (`join <código>`); para enviar a cualquier paciente real hace falta pasar por la aprobación de WhatsApp Business dentro de Twilio (verificación de negocio vía Meta).

### 9.2 Sentry (monitoreo de errores)

- **Qué hace:** captura excepciones no controladas en cliente, servidor y edge, y las agrupa en "issues" con alerta — sin esto, un error solo se descubre si el cliente llama a avisar.
- **Código clave:** `src/instrumentation.ts` (registra `sentry.server.config.ts`/`sentry.edge.config.ts` según el runtime), `src/instrumentation-client.ts` (init del navegador), y cada `error.tsx` de ruta + `src/app/global-error.tsx` llaman `Sentry.captureException`.
- **Variable de entorno:** `NEXT_PUBLIC_SENTRY_DSN` (pública por diseño — el navegador necesita mandarle datos directo a Sentry).
- **Deliberadamente NO configurado:** Session Replay (grabaría la pantalla de Check-In con PII del paciente), tracing de performance (`tracesSampleRate: 0`), y subida de source maps (requiere `SENTRY_AUTH_TOKEN` + org/project slugs — sin eso, los stack traces en Sentry se ven minificados, no bloqueante).
- **Cómo actualizar:** cambiar `NEXT_PUBLIC_SENTRY_DSN` si se crea un proyecto Sentry nuevo o se rota. Si se quiere activar tracing o source maps más adelante, es una decisión consciente de scope, no una casilla que falta marcar.

### 9.3 Herramientas de desarrollo (no corren en producción)

- **Docker Desktop + Supabase CLI (`npx supabase`):** solo para correr Postgres local y probar las RPCs de verdad (`npm run test:rpc`, ver Sección 10). No es una dependencia de producción — Vercel/Supabase Cloud no usan Docker en absoluto.
- **`pg` (npm):** driver de Postgres usado únicamente por `test/rpc/setup.ts` para conectarse directo a la base local de pruebas. No se usa en ningún código de aplicación (que siempre pasa por `@supabase/supabase-js`).

## 10. Pruebas Automatizadas

Ver también [`MANUAL_INSTALACION_IMPLEMENTACION.md`](./MANUAL_INSTALACION_IMPLEMENTACION.md#14-pruebas-automatizadas) para los comandos exactos.

- **`test/unit/`** (`npm test`, sin dependencias externas): lógica TypeScript pura — parser de cédula, aritmética de zona horaria Colombia, formato de teléfono, firma HMAC del webhook de Twilio.
- **`test/rpc/`** (`npm run test:rpc`, requiere Docker + `npx supabase start`): integración real contra las 5 RPCs críticas del ciclo de vida del turno, corriendo sobre Postgres local — no un mock. Cada test corre en una transacción `BEGIN`/`ROLLBACK` aislada (`test/rpc/setup.ts`).
- Cubierto: `fn_llamar_siguiente_turno`, `fn_confirmar_checkin`, `fn_iniciar_atencion`, `fn_finalizar_atencion`, `fn_cerrar_jornada`.
- No cubierto todavía: `fn_re_llamar_turno`, `fn_marcar_ausente`, `fn_derivar_turno`, `fn_salto_de_cola_autorizado`, y ningún test end-to-end de UI (Playwright/Cypress) — las pantallas se verifican manualmente en navegador en cada cambio.

## 11. Instalación

Ver [`MANUAL_INSTALACION_IMPLEMENTACION.md`](./MANUAL_INSTALACION_IMPLEMENTACION.md) para la guía paso a paso completa (proyecto de Supabase, variables de entorno, las 19 migraciones en orden — o el bootstrap de un solo archivo, primer usuario administrador, despliegue en Vercel, y observabilidad).

## 12. Recomendaciones Operativas

- **Backups:** activar Point-in-Time Recovery (PITR) en Supabase si el plan lo permite; como mínimo, backups diarios automáticos.
- **Monitoreo:** con Sentry configurado (Sección 9.2), las alertas llegan solas — igual vale la pena revisar `/admin/notificaciones` (reporte de costos) y el log de `/api/cron/cierre-jornada` en Vercel cada tanto durante las primeras semanas de un cliente nuevo.
- **Monitoreo de uptime:** configurar UptimeRobot o Better Uptime apuntando a `/login` de cada dominio de cliente (5 min de setup, sin cambios de código — ver manual de instalación Sección 15.2).
- **Zona horaria del cron:** `vercel.json` está fijado a `0 5 * * *` (UTC) asumiendo Colombia (UTC-5, sin horario de verano). Si el despliegue se usa en otro país/zona horaria, recalcular el offset.
- **Secretos** (`CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_AUTH_TOKEN`): tratar como contraseñas — no compartir por chat/email sin cifrar, rotar si se filtran. `NEXT_PUBLIC_SENTRY_DSN` es la excepción: está diseñado para ser público.
- **Antes de agregar tablas nuevas:** siempre habilitar RLS explícitamente y decidir conscientemente el alcance de cada policy — el bug de `/display` mostrando "zona no encontrada" ocurrió precisamente por una política RLS demasiado restrictiva en una tabla que necesitaba lectura pública.
- **Antes de agregar tablas a lógica de tiempo real:** no olvidar `alter publication supabase_realtime add table ...` — Realtime no funciona automáticamente solo con RLS configurado.
- **Después de agregar una migración nueva:** correr `bash scripts/generar-bootstrap-sql.sh` para mantener `supabase/bootstrap/agiliza_bootstrap_completo.sql` al día para el próximo cliente.
- **Escalamiento:** los índices actuales cubren los patrones de consulta actuales. Si el volumen de `turnos` crece significativamente (varios años de histórico), considerar particionar `turnos` por fecha o archivar turnos antiguos a una tabla histórica.
- **Modelo de despliegue actual — "boutique", no multi-tenant:** cada cliente tiene su propio proyecto Supabase + deployment Vercel. Es la decisión consciente para el volumen actual de clientes; si el número crece mucho, replantear hacia un esquema multi-tenant (columna `cliente_id` + RLS por tenant) es un cambio de arquitectura grande, no incremental — no empezarlo a medias.
- **`framer-motion`:** está en `package.json` sin uso actual; remover con `npm uninstall framer-motion` si no se planea usar, para reducir el tamaño del bundle.

## 13. Limitaciones Conocidas

Documentadas aquí para que no se den por sorpresa en producción — son omisiones conscientes de alcance, no bugs:

- **Salto de Cola Autorizado** (`fn_salto_de_cola_autorizado` / `saltarColaAutorizado`) existe en el backend pero no tiene botón en la UI del Workspace todavía.
- **Reasignación Masiva** e **Intervenir** en `/admin/supervisor` son botones de UI que muestran un aviso "disponible en la próxima fase" — no hay RPC de reasignación implementada aún.
- **Pausa de agente:** el header del Workspace muestra "Disponible"/"Atendiendo" derivado del turno activo, no hay un toggle manual de pausa todavía.
- **Atribución de rendimiento por agente** (`fn_rendimiento_por_agente`): usa la asignación *actual* en `agentes_puntos_atencion`, no un histórico por turno — si un agente cambió de punto a mitad del periodo consultado, el reparto no es perfectamente preciso. Suficiente para una vista ejecutiva agregada, no para auditoría individual exacta.
- **Recuperación de contraseña:** no hay flujo de autoservicio "¿Olvidó su contraseña?" en `/login`. Un administrador puede asignar una nueva contraseña a cualquier usuario desde `/admin/usuarios`.
- **Notificaciones de "aviso previo", "recordatorio de cita" y "encuesta post-atención":** configurables en `/admin/notificaciones` pero sin disparo real todavía — requieren un mecanismo de jobs programados (vigilar posición en cola, cron de recordatorios) no construido en esta fase.
- **Sin cola local de turnos offline:** a propósito. El código de ticket se genera con un lock atómico en el servidor por especialidad+día — generarlo sin conexión arriesgaría números duplicados o una fila desordenada. Ante un corte total de internet, `/checkin` bloquea el envío con un mensaje claro en vez de intentarlo.
- **Sin rate limiting** en `/checkin` — cualquiera puede, en teoría, generar turnos en ráfaga sin fricción. Pendiente.
- **Sin auto-agendamiento público:** el texto por defecto del TV menciona "agendar cita desde la app", pero hoy las citas solo las crea el staff desde `/admin/citas` — no existe una vista pública de auto-agendamiento para el paciente.
- **Sin impresión física de ticket ni PWA instalable** — pendiente evaluar con cada cliente si lo necesitan.
- **Fallback offline de carga en frío:** si el TV/tótem se reinicia sin internet, muestra el error nativo del navegador (no una pantalla propia de Agiliza) — requiere un Service Worker, deferido junto con el punto de PWA.

## 14. Estructura de Carpetas (resumen)

```
src/
├── app/                       # Rutas (App Router)
│   ├── admin/                 # settings, supervisor, infraestructura, citas, dashboard, reportes, usuarios, notificaciones
│   ├── api/cron/               # Route Handler del cierre de jornada
│   ├── api/webhooks/twilio/    # Route Handler de estado de entrega de WhatsApp
│   ├── checkin/, display/, workspace/, login/   # cada uno con su error.tsx propio
│   └── global-error.tsx        # última red si falla el layout raíz
├── actions/                   # Server Actions (checkin, citas, workspace, settings, infrastructure, analytics, reports, usuarios, notifications)
├── components/
│   ├── ui/                    # Button, Card, Modal, Badge, Toggle, RadioCard, NumericKeypad
│   ├── charts/                 # StatTile, TrendBarChart, DemandHeatmap
│   └── shared/                 # SignOutButton
├── hooks/                     # useRealtimeTurnos, useRealtimeCalls, useClock, useElapsedTime, useTicketAudio, useTick, useNetworkStatus, useBarcodeScannerListener
├── lib/
│   ├── supabase/                # client.ts, server.ts, admin.ts (Service Role)
│   ├── notifications/           # twilioWhatsApp.ts, dispatch.ts, templates.ts, phone.ts, twilioSignature.ts
│   ├── parseCedulaColombiana.ts, voiceMessage.ts, autoFitText.ts, dateRanges.ts, utils.ts
├── types/                      # database.ts (tipos generados a mano), domain.ts
├── instrumentation.ts, instrumentation-client.ts, sentry.server.config.ts, sentry.edge.config.ts
└── proxy.ts                    # Control de acceso por rol (ex-middleware.ts)

supabase/
├── migrations/                  # 0001..0019, en orden estricto
├── bootstrap/                   # agiliza_bootstrap_completo.sql — todas las migraciones concatenadas
├── seed.sql, seed_perfiles.template.sql
└── config.toml                  # proyecto Supabase CLI, para `supabase start` local (tests de integración)

test/
├── unit/                        # lógica pura, sin dependencias externas
└── rpc/                         # integración real contra Postgres local (requiere Docker)

scripts/
└── generar-bootstrap-sql.sh     # regenera supabase/bootstrap/ tras agregar una migración
```
