'use client';

import { useState, useTransition } from 'react';
import { CalendarCheck, UserPlus, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { useClock } from '@/hooks/useClock';
import { buscarTurnoProgramado, confirmarCheckIn, crearTurnoEspontaneo } from '@/actions/checkin';
import type { Especialidad, Zona } from '@/types/database';
import type { CitaEncontrada, TurnoConEstimado } from '@/types/domain';
import { TicketModal } from './TicketModal';

type Paso = 'landing' | 'cita-documento' | 'cita-resultados' | 'espontaneo';

interface CheckinFlowProps {
  especialidades: Especialidad[];
  zonas: Zona[];
  permitirCitasProgramadas: boolean;
}

export function CheckinFlow({ especialidades, zonas, permitirCitasProgramadas }: CheckinFlowProps) {
  const pasoInicial: Paso = permitirCitasProgramadas ? 'landing' : 'espontaneo';
  const [paso, setPaso] = useState<Paso>(pasoInicial);
  const [documento, setDocumento] = useState('');
  const [citas, setCitas] = useState<CitaEncontrada[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TurnoConEstimado | null>(null);
  const [isPending, startTransition] = useTransition();
  const { hora, fecha } = useClock();

  function reiniciar() {
    setPaso(pasoInicial);
    setDocumento('');
    setCitas([]);
    setError(null);
  }

  function buscarCita() {
    setError(null);
    startTransition(async () => {
      const res = await buscarTurnoProgramado(documento);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCitas(res.data);
      setPaso('cita-resultados');
    });
  }

  function confirmarCita(turnoId: string) {
    setError(null);
    startTransition(async () => {
      const res = await confirmarCheckIn(turnoId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTicket(res.data);
    });
  }

  const nombreEspecialidad = (id: string) => especialidades.find((e) => e.id === id)?.nombre ?? id;

  return (
    <main className="flex h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border px-16 py-6">
        <div className="flex items-center gap-4">
          <p className="text-2xl font-extrabold tracking-tight text-primary">ADMISIONES</p>
          <Badge tone="primary">En Línea</Badge>
        </div>
        <div className="text-right">
          <p className="font-mono text-xl text-text">{hora}</p>
          <p className="text-xs uppercase text-muted">{fecha}</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-16 py-10">
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {paso === 'landing' && (
          <div className="grid w-full max-w-4xl grid-cols-2 gap-8">
            <OpcionCard
              icon={<CalendarCheck className="size-8 text-primary" />}
              iconBg="bg-primary/10"
              titulo="Tengo Cita Programada"
              descripcion="Validación rápida para pacientes con reserva previa."
              onClick={() => setPaso('cita-documento')}
            />
            <OpcionCard
              icon={<UserPlus className="size-8 text-secondary" />}
              iconBg="bg-secondary/10"
              titulo="Turno Espontáneo"
              descripcion="Atención sin cita para servicios generales y consultas."
              onClick={() => setPaso('espontaneo')}
            />
          </div>
        )}

        {paso === 'cita-documento' && (
          <div className="w-full">
            <BotonVolver onClick={reiniciar} />
            <NumericKeypad
              value={documento}
              onChange={setDocumento}
              onConfirm={buscarCita}
              confirmLoading={isPending}
              confirmDisabled={documento.length < 5}
              label="Ingrese su número de documento o cédula"
            />
            {error && (
              <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted">¿Deseas solicitar un turno espontáneo en su lugar?</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    setPaso('espontaneo');
                  }}
                >
                  Solicitar Turno Espontáneo
                </Button>
              </div>
            )}
          </div>
        )}

        {paso === 'cita-resultados' && (
          <div className="w-full max-w-2xl">
            <BotonVolver onClick={reiniciar} />
            <h2 className="mb-6 text-center text-2xl font-semibold text-text">Citas encontradas</h2>
            <div className="flex flex-col gap-4">
              {citas.map((cita) => (
                <div
                  key={cita.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-6 py-4"
                >
                  <div>
                    <p className="text-lg font-semibold text-text">{nombreEspecialidad(cita.especialidad_id)}</p>
                    <p className="font-mono text-sm text-muted">
                      {cita.hora_cita ? new Date(cita.hora_cita).toLocaleString('es-CO') : 'Sin hora asignada'}
                    </p>
                    {cita.fuera_de_horario && (
                      <Badge tone="warning" className="mt-2">
                        Fuera de la ventana configurada
                      </Badge>
                    )}
                  </div>
                  <Button onClick={() => confirmarCita(cita.id)} loading={isPending}>
                    Confirmar Llegada
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {paso === 'espontaneo' && (
          <EspontaneoForm
            especialidades={especialidades}
            zonas={zonas}
            onCancelar={reiniciar}
            onCreado={(t) => setTicket(t)}
          />
        )}
      </div>

      <footer className="border-t border-primary bg-surface px-16 py-3 text-center font-mono text-xs uppercase tracking-widest text-muted">
        Sistema de Gestión de Turnos — FlowQ &nbsp;|&nbsp; Recuerde tener su documento a la mano
      </footer>

      {ticket && (
        <TicketModal
          turno={ticket}
          onClose={() => {
            setTicket(null);
            reiniciar();
          }}
        />
      )}
    </main>
  );
}

function OpcionCard({
  icon,
  iconBg,
  titulo,
  descripcion,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  titulo: string;
  descripcion: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-6 rounded-lg border border-border bg-surface p-10 text-left transition hover:border-primary/60 active:scale-[0.99]"
    >
      <span className={`flex size-16 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>
      <span>
        <span className="block text-2xl font-bold text-text">{titulo}</span>
        <span className="mt-2 block text-muted">{descripcion}</span>
      </span>
    </button>
  );
}

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted hover:text-text"
    >
      <ArrowLeft className="size-4" />
      Volver
    </button>
  );
}

function EspontaneoForm({
  especialidades,
  zonas,
  onCancelar,
  onCreado,
}: {
  especialidades: Especialidad[];
  zonas: Zona[];
  onCancelar: () => void;
  onCreado: (t: TurnoConEstimado) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [especialidadId, setEspecialidadId] = useState(especialidades[0]?.id ?? '');
  const [zonaId, setZonaId] = useState(zonas[0]?.id ?? '');
  const [preferencial, setPreferencial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function crear() {
    setError(null);
    startTransition(async () => {
      const res = await crearTurnoEspontaneo({
        nombre,
        documento,
        especialidadId,
        zonaId,
        esPreferencial: preferencial,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreado(res.data);
    });
  }

  return (
    <div className="w-full max-w-xl">
      <BotonVolver onClick={onCancelar} />
      <h2 className="mb-6 text-2xl font-semibold text-text">Registrar turno espontáneo</h2>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-4">
        <Campo label="Nombre completo">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
            placeholder="Juan Pérez"
          />
        </Campo>
        <Campo label="Documento">
          <input
            value={documento}
            onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
            placeholder="1020304050"
            inputMode="numeric"
          />
        </Campo>
        <Campo label="Especialidad">
          <select
            value={especialidadId}
            onChange={(e) => setEspecialidadId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          >
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Zona">
          <select
            value={zonaId}
            onChange={(e) => setZonaId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          >
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Toggle
          checked={preferencial}
          onChange={setPreferencial}
          label="Turno preferencial (Ley)"
          description="Adultos mayores, embarazadas, discapacidad."
        />

        <Button
          size="lg"
          className="mt-2"
          onClick={crear}
          loading={isPending}
          disabled={!nombre || documento.length < 5 || !especialidadId || !zonaId}
        >
          Generar Ticket
        </Button>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">{label}</span>
      {children}
    </label>
  );
}
