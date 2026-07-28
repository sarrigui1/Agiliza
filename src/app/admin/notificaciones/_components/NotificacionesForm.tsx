'use client';

import { useState, useTransition } from 'react';
import { Save, CheckCircle2, MessageCircle, Send, DollarSign, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import {
  actualizarConfiguracionNotificaciones,
  enviarNotificacionPrueba,
  obtenerReporteCostos,
  type ReporteCostos,
} from '@/actions/notifications';
import type { NotificacionesConfiguracion } from '@/types/database';

const ETIQUETAS_EVENTO: Record<string, string> = {
  checkin_exitoso: 'Check-in exitoso',
  pre_llamado: 'Aviso previo (N turnos antes)',
  llamado_modulo: 'Llamado al módulo',
  recordatorio_cita: 'Recordatorio de cita',
  encuesta_post_atencion: 'Encuesta post-atención',
};

function CampoNumerico({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">{label}</span>
      <input
        type="number"
        min={0}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-text"
      />
    </label>
  );
}

export function NotificacionesForm({
  configuracionInicial,
  reporteInicial,
}: {
  configuracionInicial: NotificacionesConfiguracion;
  reporteInicial: ReporteCostos | null;
}) {
  const [draft, setDraft] = useState(configuracionInicial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardadoEn, setGuardadoEn] = useState<number | null>(null);

  const [telefonoPrueba, setTelefonoPrueba] = useState('');
  const [enviandoPrueba, startPrueba] = useTransition();
  const [resultadoPrueba, setResultadoPrueba] = useState<{ ok: boolean; mensaje: string } | null>(null);

  const [reporte, setReporte] = useState(reporteInicial);
  const [cargandoReporte, startReporte] = useTransition();

  function patch(cambios: Partial<NotificacionesConfiguracion>) {
    setDraft((prev) => ({ ...prev, ...cambios }));
    setGuardadoEn(null);
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const { id, updated_at, actualizado_por, ...editable } = draft;
      void id;
      void updated_at;
      void actualizado_por;

      const res = await actualizarConfiguracionNotificaciones(editable);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft(res.data);
      setGuardadoEn(Date.now());
    });
  }

  function enviarPrueba() {
    setResultadoPrueba(null);
    startPrueba(async () => {
      const res = await enviarNotificacionPrueba(telefonoPrueba);
      if (!res.ok) {
        setResultadoPrueba({ ok: false, mensaje: res.error });
        return;
      }
      setResultadoPrueba({ ok: true, mensaje: `Enviado (SID: ${res.data.sid}).` });
    });
  }

  function actualizarReporte() {
    startReporte(async () => {
      const res = await obtenerReporteCostos(30);
      if (res.ok) setReporte(res.data);
    });
  }

  return (
    <main className="p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">NOTIFICACIONES WHATSAPP</h1>
        <div className="flex items-center gap-4">
          {guardadoEn && (
            <span className="flex items-center gap-1 text-sm text-primary">
              <CheckCircle2 className="size-4" />
              Cambios guardados
            </span>
          )}
          {error && <span className="text-sm text-danger">{error}</span>}
          <Button onClick={guardar} loading={isPending}>
            <Save className="size-4" />
            Guardar Cambios
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>
            <MessageCircle className="size-5 text-primary" />
            Interruptor Maestro
          </CardTitle>
          <Toggle
            checked={draft.habilitado}
            onChange={(v) => patch({ habilitado: v })}
            label="Motor de notificaciones activo"
            description="Si está apagado, ningún evento envía WhatsApp sin importar los toggles de abajo. Apagado por defecto."
          />
          {!draft.habilitado && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Con el interruptor maestro apagado, el resto de esta pantalla no tiene efecto — es la forma más rápida
              de desactivar todos los envíos sin perder la configuración.
            </div>
          )}

          <p className="mb-3 mt-6 font-mono text-xs uppercase tracking-widest text-muted">Eventos</p>
          <div className="flex flex-col gap-4">
            <Toggle
              checked={draft.notificar_checkin}
              onChange={(v) => patch({ notificar_checkin: v })}
              label={ETIQUETAS_EVENTO.checkin_exitoso}
              description="Al registrar el turno en Check-In, si el paciente dejó un teléfono. Conectado."
            />
            <Toggle
              checked={draft.notificar_llamado}
              onChange={(v) => patch({ notificar_llamado: v })}
              label={ETIQUETAS_EVENTO.llamado_modulo}
              description="Cuando un agente llama el turno desde /workspace. Conectado."
            />
            <Toggle
              checked={draft.notificar_pre_llamado}
              onChange={(v) => patch({ notificar_pre_llamado: v })}
              label={ETIQUETAS_EVENTO.pre_llamado}
              description="Aviso cuando falten N turnos por delante. Configurable, disparo pendiente de implementar."
              disabled
            />
            <Toggle
              checked={draft.notificar_recordatorio_cita}
              onChange={(v) => patch({ notificar_recordatorio_cita: v })}
              label={ETIQUETAS_EVENTO.recordatorio_cita}
              description="Recordatorio antes de una cita programada. Requiere un job programado — pendiente de implementar."
              disabled
            />
            <Toggle
              checked={draft.notificar_encuesta}
              onChange={(v) => patch({ notificar_encuesta: v })}
              label={ETIQUETAS_EVENTO.encuesta_post_atencion}
              description="Encuesta de satisfacción tras la atención. Requiere un job programado — pendiente de implementar."
              disabled
            />
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>
              <DollarSign className="size-5 text-primary" />
              Costeo y Umbrales
            </CardTitle>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico
                label="Umbral pre-llamado (turnos)"
                value={draft.umbral_pre_llamado}
                onChange={(v) => patch({ umbral_pre_llamado: v })}
              />
              <CampoNumerico
                label="Delay encuesta (min)"
                value={draft.minutos_delay_encuesta}
                onChange={(v) => patch({ minutos_delay_encuesta: v })}
              />
              <CampoNumerico
                label="Costo sesión (USD)"
                value={draft.costo_sesion_utilidad_usd}
                onChange={(v) => patch({ costo_sesion_utilidad_usd: v })}
                step={0.0001}
              />
              <CampoNumerico
                label="TRM (COP/USD)"
                value={draft.trm_cop}
                onChange={(v) => patch({ trm_cop: v })}
              />
            </div>
            <p className="mt-3 text-xs text-muted">
              El costo por evento se estima como Costo sesión (USD) × TRM en el momento del envío, y queda registrado
              en la bitácora — es un valor de referencia configurable por usted, no una consulta en vivo a Twilio.
            </p>
          </Card>

          <Card>
            <CardTitle>
              <Send className="size-5 text-primary" />
              Probar Conexión con Twilio
            </CardTitle>
            <p className="mb-4 text-sm text-muted">
              Envía un mensaje de prueba directo (no pasa por los toggles de arriba) para confirmar que las
              credenciales de Twilio configuradas en el servidor funcionan.
            </p>
            <div className="flex gap-2">
              <input
                value={telefonoPrueba}
                onChange={(e) => setTelefonoPrueba(e.target.value)}
                placeholder="3001234567"
                className="flex-1 rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-text"
              />
              <Button onClick={enviarPrueba} loading={enviandoPrueba} disabled={telefonoPrueba.trim().length < 7}>
                Enviar Prueba
              </Button>
            </div>
            {resultadoPrueba && (
              <p className={`mt-3 text-sm ${resultadoPrueba.ok ? 'text-primary' : 'text-danger'}`}>
                {resultadoPrueba.mensaje}
              </p>
            )}
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="mb-0">
              <DollarSign className="size-5 text-primary" />
              Reporte de Costos (últimos 30 días)
            </CardTitle>
            <Button variant="outline" onClick={actualizarReporte} loading={cargandoReporte}>
              Actualizar
            </Button>
          </div>

          {!reporte || reporte.totalMensajes === 0 ? (
            <p className="text-sm text-muted">Sin mensajes registrados en este período.</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-4 gap-4">
                <ResumenTile label="Total mensajes" valor={String(reporte.totalMensajes)} />
                <ResumenTile label="Fallidos" valor={String(reporte.totalFallidos)} tono={reporte.totalFallidos > 0 ? 'danger' : undefined} />
                <ResumenTile label="Costo total (USD)" valor={`$${reporte.totalCostoUsd.toFixed(4)}`} />
                <ResumenTile label="Costo total (COP)" valor={`$${Math.round(reporte.totalCostoCop).toLocaleString('es-CO')}`} />
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-xs uppercase tracking-widest text-muted">
                    <th className="py-2">Evento</th>
                    <th className="py-2">Enviados</th>
                    <th className="py-2">Fallidos</th>
                    <th className="py-2">Costo USD</th>
                    <th className="py-2">Costo COP</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.porEvento.map((fila) => (
                    <tr key={fila.tipoEvento} className="border-b border-border/50">
                      <td className="py-2 text-text">{ETIQUETAS_EVENTO[fila.tipoEvento] ?? fila.tipoEvento}</td>
                      <td className="py-2 text-text">{fila.cantidad}</td>
                      <td className="py-2 text-text">{fila.fallidos}</td>
                      <td className="py-2 text-text">${fila.costoUsd.toFixed(4)}</td>
                      <td className="py-2 text-text">${Math.round(fila.costoCop).toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}

function ResumenTile({ label, valor, tono }: { label: string; valor: string; tono?: 'danger' }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className={`text-xl font-bold ${tono === 'danger' ? 'text-danger' : 'text-text'}`}>{valor}</p>
    </div>
  );
}
