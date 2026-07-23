# FlowQ (Agiliza) — Manual de Usuario

Manual de uso del Sistema de Llamado y Gestión de Turnos, organizado por rol. Cada persona ve únicamente las pantallas que le corresponden según su usuario.

---

## Cómo iniciar sesión

1. Entrar a la dirección web del sistema (ej. `https://agiliza-sooty.vercel.app/login`).
2. Ingresar el **usuario/email** y la **contraseña**.
3. Presionar **Iniciar Sesión**.
4. El sistema lo llevará automáticamente a la pantalla que le corresponde según su rol — no es necesario recordar una URL distinta para cada rol.

Para salir, use el botón **Cerrar Sesión** que aparece en la parte superior de cada pantalla interna.

> Si al entrar a una sección el sistema lo redirige a otra pantalla distinta a la que esperaba, es porque su usuario no tiene permiso sobre esa sección — no es un error, es el control de acceso funcionando correctamente. Contacte a un administrador si necesita más permisos.

---

## 1. Rol: Recepción — Admisión / Check-In

**Pantalla:** `/checkin` (normalmente un tótem o tablet dedicado en el punto de recepción).

Esta pantalla tiene dos flujos posibles:

### A. Paciente/cliente con cita programada

1. Tocar **"Tengo Cita Programada"**.
2. Ingresar el número de documento en el teclado numérico en pantalla.
3. Tocar **Confirmar**.
4. El sistema muestra la(s) cita(s) encontradas con la especialidad y la hora. Si la cita está fuera del horario permitido, se mostrará una advertencia "Fuera de la ventana configurada" (igual se puede confirmar la llegada).
5. Tocar **Confirmar Llegada**.
6. Se genera el ticket — aparece en pantalla grande el código asignado (ej. `CAR-020`). El paciente debe conservarlo; será llamado por pantalla y sonido.
7. La pantalla vuelve automáticamente al inicio después de unos segundos.

### B. Turno espontáneo (sin cita)

1. Tocar **"Turno Espontáneo"**.
2. Completar: **Nombre completo**, **Documento**, **Especialidad**, **Zona**.
3. Si corresponde (adultos mayores, embarazadas, discapacidad), activar el interruptor **"Turno preferencial (Ley)"** — esto le da prioridad en la cola según la configuración del sistema.
4. Tocar **Generar Ticket**.
5. Se muestra el código asignado en pantalla grande.

---

## 2. Rol: Agente / Operador — Panel de Trabajo

**Pantalla:** `/workspace`.

Cada agente ve únicamente la cola de su propio punto de atención (consultorio, caja o módulo asignado).

### Llamar al siguiente turno

- Si no hay ningún turno activo, aparece el botón grande **"Llamar Siguiente"**. Al presionarlo, el sistema selecciona automáticamente el próximo turno según el algoritmo configurado (por hora de cita, por orden de llegada, o híbrido) y respetando la proporción de turnos preferenciales configurada.
- Si no hay nadie esperando, el sistema avisa "No hay turnos en espera en esta cola".

### Mientras atiende un turno

Una vez llamado un turno, aparece su código y un cronómetro. Las acciones disponibles son:

| Botón | Cuándo usarlo |
|---|---|
| **Iniciar Atención** | Cuando el paciente/cliente llega físicamente al punto de atención. Cambia el turno a "en atención" y reinicia el cronómetro. |
| **Re-Llamar** | Si el turno fue llamado pero la persona no se presenta, para repetir el anuncio por pantalla/sonido. Hay un tiempo mínimo de espera entre re-llamados (configurado por el administrador). |
| **Marcar Ausente** | Solo se habilita después de alcanzar el número de intentos de llamado configurado (ej. 3). Si el sistema tiene activado "reingreso penalizado", la persona vuelve automáticamente al final de la fila. |
| **Derivar** | Si el paciente necesita pasar a otra especialidad (ej. de Cardiología a Laboratorio). Finaliza el turno actual y genera uno nuevo en la especialidad elegida. |
| **Finalizar** | Se habilita cuando el turno está "en atención". Marca la atención como completada. |

### Cola de Espera en Vivo

Tabla que se actualiza automáticamente (sin necesidad de recargar la página) mostrando: posición, código de turno, categoría (cita programada / demanda espontánea / preferencial), hora de llegada y minutos de espera.

### Panel de Rendimiento

Muestra, en tiempo real: cuántos turnos se han atendido hoy, el tiempo promedio de atención (TPA), y cuántas personas están esperando en este momento.

---

## 3. Rol: Administrador

El administrador tiene acceso a 5 secciones, todas accesibles desde el menú superior.

### 3.1 Configuración (`/admin/settings`)

Reglas de negocio globales del sistema, organizadas en 4 tarjetas:

- **Algoritmo y Ordenamiento:** elegir cómo se ordena la cola (por hora de cita, por orden de llegada, o híbrido) y la proporción de intercalado entre turnos preferenciales y normales (ej. 1:2 = uno preferencial por cada dos normales).
- **Tiempos y Tolerancia:** minutos de check-in previo permitido, minutos de tolerancia de retraso, e intervalo (segundos) entre re-llamados.
- **Gestión de Ausencias:** número de intentos de llamado antes de poder marcar "ausente", y si el reingreso a la fila queda penalizado (va al final).
- **Privacidad (TVs):** cómo se muestra la identidad del paciente en la pantalla pública — solo el código del ticket, iniciales + documento parcial, o nombre completo.

Después de cualquier cambio, presionar **Guardar Cambios**.

### 3.2 Infraestructura (`/admin/infraestructura`)

Gestión de la estructura física y de servicios del sistema, en 3 pestañas:

- **Zonas:** crear/editar zonas (ej. "Piso 2"), y activarlas o desactivarlas. El código de zona es el que se usa en la URL de la pantalla pública de TV.
- **Servicios y Especialidades:** crear/editar servicios (ej. "Cardiología") junto con su prefijo de ticket (ej. `CAR`, que da tickets como `CAR-001`).
- **Puestos / Puntos de Atención:** crear/editar consultorios, cajas o módulos; cada uno pertenece a una zona y un servicio. Desde aquí también se **asigna el agente responsable** de cada punto (menú desplegable en la columna "Agente Responsable") y se puede cambiar su estado (Disponible / Pausado / Fuera de Línea) — el estado "Atendiendo" no se puede cambiar a mano, solo lo controla el propio flujo de atención del agente.

### 3.3 Supervisión Operativa (`/admin/supervisor`)

Vista de monitoreo en vivo:

- **Estatus de Terminales:** una tarjeta por cada punto de atención, con su estado actual (Atendiendo + código del turno, Disponible, En Pausa, Fuera de Línea, o "Saturación" si tiene demasiados turnos esperando), y cuántas personas están en su fila.
- **TPE por Área:** tiempo promedio de espera de hoy, por servicio.
- **Resumen del Día:** total de atendidos y de ausentes.
- Los botones **Reasignar**, **Intervenir** y **Reasignación Masiva** están visibles pero aún no operativos — muestran un aviso de que estarán disponibles en una próxima fase.

### 3.4 Dashboard Ejecutivo (`/admin/dashboard`)

Analítica de negocio con filtro de periodo (**Hoy / Esta Semana / Este Mes / Personalizado**):

- **KPIs principales:** Total Atendidos (con variación vs. el periodo anterior), TPE Promedio (verde si está dentro de la meta, rojo si no), % Cumplimiento de SLA, y Tasa de Ausentismo.
- **Tendencia de Demanda:** gráfico de barras con la evolución diaria de turnos.
- **Horas Pico:** mapa de calor por día de la semana y hora del día — mientras más intenso el verde, más volumen de turnos en ese cruce de día/hora.
- **Comparativa por Servicio:** tabla con atenciones, TPE y TPA de cada especialidad.

Desde aquí también se puede:
- **Exportar PDF Ejecutivo:** abre el resumen de una página lista para imprimir o guardar como PDF.
- **Descargar CSV:** descarga el detalle completo de todos los turnos del periodo seleccionado, para auditoría o análisis externo (Excel, Power BI, etc.).

### 3.5 Reportes (`/admin/reportes`)

Resumen ejecutivo de una sola página (KPIs + tendencia + comparativa por servicio), pensado para imprimir. Presionar **"Imprimir / Guardar como PDF"** y elegir "Guardar como PDF" en el diálogo de impresión del navegador.

---

## 4. Rol: Supervisor

El supervisor tiene el mismo acceso que el administrador a **Supervisión**, **Dashboard** y **Reportes**, y también puede entrar a **Configuración** e **Infraestructura**. Al iniciar sesión, aterriza directamente en **Supervisión Operativa** (a diferencia del administrador, que aterriza en Configuración). El uso de cada pantalla es idéntico al descrito en la sección de Administrador.

---

## 5. Pantalla Pública — TV / Sala de Espera

**Dirección:** `/display?zone=<código-de-zona>` (ej. `/display?zone=piso2`). No requiere usuario ni contraseña — se deja abierta permanentemente en el televisor o monitor de la sala correspondiente.

- La primera vez que carga, pide **tocar la pantalla para activar el sonido** (los navegadores bloquean el audio automático hasta que hay una interacción). Una sola vez es suficiente.
- Muestra el **turno actual** en letras grandes junto al punto de atención al que debe dirigirse, y una lista de los últimos llamados recientes.
- Se actualiza sola en tiempo real — no hace falta recargar la página.
- Cada vez que se llama un nuevo turno, suena un tono y se anuncia por voz.
- El pie de pantalla muestra la zona configurada y la hora actual.

Si aparece el mensaje "Zona no encontrada", significa que el código usado en la URL no coincide con ninguna zona activa — verificar el código correcto en **Infraestructura → Zonas**.

---

## Preguntas Frecuentes

**¿Por qué no veo el botón para marcar un turno como ausente?**
Se habilita solo después de haber re-llamado el turno el número de veces configurado por el administrador (por defecto, 3 intentos).

**¿Por qué el sistema me redirige a otra pantalla apenas inicio sesión?**
Cada rol tiene una pantalla de inicio distinta: administrador → Configuración, supervisor → Supervisión, agente → Panel de Trabajo, recepción → Check-In. Es el comportamiento esperado.

**Inicié sesión con un usuario pero necesito cambiar a otro (por ejemplo, para probar otro rol).**
Debe cerrar sesión primero con el botón **Cerrar Sesión** antes de volver a `/login` — de lo contrario el sistema lo reconoce como ya autenticado y lo regresa a su pantalla habitual.

**¿Qué hago si la pantalla de TV no actualiza los llamados?**
Verificar la conexión a internet del dispositivo. Si el problema persiste, recargar la página una vez — debería reconectarse automáticamente.

**¿Se puede recuperar una contraseña olvidada?**
Actualmente no hay un flujo de "olvidé mi contraseña" en la pantalla de login. Un administrador debe restablecerla desde el panel de Supabase.
