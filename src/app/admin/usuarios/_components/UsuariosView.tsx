'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, KeyRound, Power, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { crearUsuario, actualizarUsuario, restablecerPassword, type UsuarioConEmail } from '@/actions/usuarios';
import type { RolUsuario } from '@/types/database';

const ROL_LABEL: Record<RolUsuario, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  agente: 'Agente',
  recepcion: 'Recepción',
};

const ROL_TONE: Record<RolUsuario, 'neutral' | 'primary' | 'secondary' | 'warning' | 'danger'> = {
  admin: 'primary',
  supervisor: 'secondary',
  agente: 'neutral',
  recepcion: 'warning',
};

const ROLES: RolUsuario[] = ['admin', 'supervisor', 'agente', 'recepcion'];

interface UsuariosViewProps {
  usuariosIniciales: UsuarioConEmail[];
  errorCarga: string | null;
}

export function UsuariosView({ usuariosIniciales, errorCarga }: UsuariosViewProps) {
  const router = useRouter();
  const [modalCrear, setModalCrear] = useState(false);
  const [usuarioPassword, setUsuarioPassword] = useState<UsuarioConEmail | null>(null);
  const [toast, setToast] = useState<{ mensaje: string; tono: 'exito' | 'error' } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function notificar(mensaje: string, tono: 'exito' | 'error' = 'exito') {
    setToast({ mensaje, tono });
    setTimeout(() => setToast(null), 4000);
  }

  function crear(input: { email: string; password: string; nombreCompleto: string; rol: RolUsuario }) {
    startTransition(async () => {
      const res = await crearUsuario(input);
      if (!res.ok) {
        notificar(res.error, 'error');
        return;
      }
      setModalCrear(false);
      notificar('Usuario creado correctamente.');
      router.refresh();
    });
  }

  function cambiarRol(usuario: UsuarioConEmail, rol: RolUsuario) {
    setPendingId(usuario.id);
    startTransition(async () => {
      const res = await actualizarUsuario(usuario.id, { rol });
      setPendingId(null);
      if (!res.ok) {
        notificar(res.error, 'error');
        return;
      }
      notificar(`Rol de "${usuario.nombre_completo}" actualizado a ${ROL_LABEL[rol]}.`);
      router.refresh();
    });
  }

  function toggleActivo(usuario: UsuarioConEmail) {
    setPendingId(usuario.id);
    startTransition(async () => {
      const res = await actualizarUsuario(usuario.id, { activo: !usuario.activo });
      setPendingId(null);
      if (!res.ok) {
        notificar(res.error, 'error');
        return;
      }
      notificar(`Usuario "${usuario.nombre_completo}" ${res.data.activo ? 'activado' : 'desactivado'}.`);
      router.refresh();
    });
  }

  function guardarPassword(nuevaPassword: string) {
    if (!usuarioPassword) return;
    startTransition(async () => {
      const res = await restablecerPassword(usuarioPassword.id, nuevaPassword);
      if (!res.ok) {
        notificar(res.error, 'error');
        return;
      }
      setUsuarioPassword(null);
      notificar(`Contraseña de "${usuarioPassword.nombre_completo}" actualizada.`);
    });
  }

  return (
    <main className="p-8">
      {toast && (
        <div
          className={cn(
            'fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-6 py-3 text-sm shadow-xl',
            toast.tono === 'exito'
              ? 'border-primary/50 bg-surface text-primary'
              : 'border-danger/50 bg-surface text-danger',
          )}
        >
          {toast.tono === 'exito' ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <AlertTriangle className="size-4" />
          )}
          {toast.mensaje}
        </div>
      )}

      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Panel de Administración</p>
          <h1 className="text-2xl font-bold text-text">Roles y Usuarios</h1>
        </div>
        <Button onClick={() => setModalCrear(true)}>
          <UserPlus className="size-4" />
          Nuevo Usuario
        </Button>
      </header>

      {errorCarga && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" />
          {errorCarga}
        </div>
      )}

      <Card className="p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-6 py-3">Nombre</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Rol</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {usuariosIniciales.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-muted">
                  No hay usuarios registrados.
                </td>
              </tr>
            )}
            {usuariosIniciales.map((usuario) => (
              <tr key={usuario.id}>
                <td className="px-6 py-4 font-medium text-text">{usuario.nombre_completo}</td>
                <td className="px-6 py-4 font-mono text-muted">{usuario.email}</td>
                <td className="px-6 py-4">
                  <select
                    value={usuario.rol}
                    disabled={isPending && pendingId === usuario.id}
                    onChange={(e) => cambiarRol(usuario, e.target.value as RolUsuario)}
                    className="rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-text"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROL_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <Badge tone={ROL_TONE[usuario.rol]} className="ml-2 hidden md:inline-flex">
                    {ROL_LABEL[usuario.rol]}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <Badge tone={usuario.activo ? 'primary' : 'neutral'}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="default" onClick={() => setUsuarioPassword(usuario)}>
                      <KeyRound className="size-3.5" />
                      Contraseña
                    </Button>
                    <Button
                      variant="ghost"
                      size="default"
                      loading={isPending && pendingId === usuario.id}
                      onClick={() => toggleActivo(usuario)}
                    >
                      <Power className="size-3.5" />
                      {usuario.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <NuevoUsuarioModal open={modalCrear} loading={isPending} onClose={() => setModalCrear(false)} onGuardar={crear} />

      <RestablecerPasswordModal
        usuario={usuarioPassword}
        loading={isPending}
        onClose={() => setUsuarioPassword(null)}
        onGuardar={guardarPassword}
      />
    </main>
  );
}

function NuevoUsuarioModal({
  open,
  loading,
  onClose,
  onGuardar,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onGuardar: (input: { email: string; password: string; nombreCompleto: string; rol: RolUsuario }) => void;
}) {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario>('agente');

  function cerrar() {
    setNombreCompleto('');
    setEmail('');
    setPassword('');
    setRol('agente');
    onClose();
  }

  return (
    <Modal open={open} onClose={cerrar} title="Nuevo Usuario">
      <div className="flex flex-col gap-4">
        <Campo label="Nombre completo">
          <input
            value={nombreCompleto}
            onChange={(e) => setNombreCompleto(e.target.value)}
            placeholder="María González"
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          />
        </Campo>
        <Campo label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@sede.com"
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          />
        </Campo>
        <Campo label="Contraseña Temporal">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          />
        </Campo>
        <Campo label="Rol">
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as RolUsuario)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROL_LABEL[r]}
              </option>
            ))}
          </select>
        </Campo>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            disabled={!nombreCompleto || !email.includes('@') || password.length < 8}
            onClick={() => onGuardar({ nombreCompleto, email, password, rol })}
          >
            Crear Usuario
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RestablecerPasswordModal({
  usuario,
  loading,
  onClose,
  onGuardar,
}: {
  usuario: UsuarioConEmail | null;
  loading: boolean;
  onClose: () => void;
  onGuardar: (nuevaPassword: string) => void;
}) {
  const [password, setPassword] = useState('');

  function cerrar() {
    setPassword('');
    onClose();
  }

  return (
    <Modal open={!!usuario} onClose={cerrar} title={`Restablecer Contraseña — ${usuario?.nombre_completo ?? ''}`}>
      <div className="flex flex-col gap-4">
        <Campo label="Nueva Contraseña">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          />
        </Campo>
        <div className="mt-2 flex justify-end gap-3">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            disabled={password.length < 8}
            onClick={() => onGuardar(password)}
          >
            Actualizar Contraseña
          </Button>
        </div>
      </div>
    </Modal>
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
