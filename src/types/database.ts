/**
 * FlowQ — Tipos de la base de datos Supabase.
 *
 * Escrito a mano siguiendo el formato de `supabase gen types typescript`.
 * Una vez el proyecto esté enlazado a Supabase (Fase 2), regenerar con:
 *
 *   supabase gen types typescript --project-id <id> > src/types/database.ts
 *
 * y mover los alias de conveniencia (al final de este archivo) a `src/types/domain.ts`.
 */

// ---------------------------------------------------------------------------------------
// Enums (deben coincidir 1:1 con supabase/migrations/0001_init_schema.sql)
// ---------------------------------------------------------------------------------------
export type RolUsuario = 'admin' | 'supervisor' | 'agente' | 'recepcion';

export type EstadoTurno =
  | 'programado'
  | 'en_espera'
  | 'llamado'
  | 'en_atencion'
  | 'finalizado'
  | 'cancelado'
  | 'ausente'
  | 'reingresado';

export type TipoTurno = 'cita_previa' | 'espontaneo';

export type AlgoritmoCola = 'hora_cita' | 'orden_llegada' | 'hibrido';

export type FormatoPrivacidadTv = 'solo_codigo' | 'iniciales_parcial' | 'nombre_completo';

export type EstadoPuntoAtencion = 'fuera_de_linea' | 'disponible' | 'atendiendo' | 'pausado';

export type TipoLlamado = 'inicial' | 're_llamado' | 'prioritario';

// ---------------------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      perfiles: {
        Row: {
          id: string;
          nombre_completo: string;
          rol: RolUsuario;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          nombre_completo: string;
          rol?: RolUsuario;
          activo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['perfiles']['Insert']>;
        Relationships: [];
      };

      especialidades: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nombre: string;
          activo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['especialidades']['Insert']>;
        Relationships: [];
      };

      zonas: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          descripcion: string | null;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nombre: string;
          descripcion?: string | null;
          activo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['zonas']['Insert']>;
        Relationships: [];
      };

      puntos_atencion: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          zona_id: string;
          especialidad_id: string | null;
          estado: EstadoPuntoAtencion;
          agente_actual_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nombre: string;
          zona_id: string;
          especialidad_id?: string | null;
          estado?: EstadoPuntoAtencion;
          agente_actual_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['puntos_atencion']['Insert']>;
        Relationships: [];
      };

      agentes_puntos_atencion: {
        Row: {
          perfil_id: string;
          punto_atencion_id: string;
        };
        Insert: {
          perfil_id: string;
          punto_atencion_id: string;
        };
        Update: Partial<Database['public']['Tables']['agentes_puntos_atencion']['Insert']>;
        Relationships: [];
      };

      configuraciones_globales: {
        Row: {
          id: number;
          algoritmo_cola: AlgoritmoCola;
          minutos_checkin_previo: number;
          minutos_tolerancia: number;
          segundos_intervalo_rellamado: number;
          limite_llamados_ausencia: number;
          reingreso_penalizado: boolean;
          formato_privacidad_tv: FormatoPrivacidadTv;
          intercalado_preferencial: number;
          intercalado_normal: number;
          updated_at: string;
          actualizado_por: string | null;
        };
        Insert: Partial<Database['public']['Tables']['configuraciones_globales']['Row']> & {
          id?: 1;
        };
        Update: Partial<Database['public']['Tables']['configuraciones_globales']['Row']>;
        Relationships: [];
      };

      turnos: {
        Row: {
          id: string;
          codigo: string;
          especialidad_id: string;
          zona_id: string;
          tipo_turno: TipoTurno;
          es_preferencial: boolean;
          estado: EstadoTurno;
          documento_paciente: string;
          nombre_paciente: string;
          hora_cita: string | null;
          hora_llegada: string;
          punto_atencion_id: string | null;
          hora_llamado: string | null;
          hora_atencion: string | null;
          hora_finalizacion: string | null;
          intentos_llamado: number;
          turno_origen_id: string | null;
          motivo_auditoria: string | null;
          creado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          especialidad_id: string;
          zona_id: string;
          tipo_turno?: TipoTurno;
          es_preferencial?: boolean;
          estado?: EstadoTurno;
          documento_paciente: string;
          nombre_paciente: string;
          hora_cita?: string | null;
          hora_llegada?: string;
          punto_atencion_id?: string | null;
          hora_llamado?: string | null;
          hora_atencion?: string | null;
          hora_finalizacion?: string | null;
          intentos_llamado?: number;
          turno_origen_id?: string | null;
          motivo_auditoria?: string | null;
          creado_por?: string | null;
          created_at?: string;
        };
        // No se declara Update de `estado` para uso directo desde el cliente:
        // las transiciones de estado deben ejecutarse vía RPC (fn_llamar_siguiente_turno, etc).
        Update: Partial<Omit<Database['public']['Tables']['turnos']['Insert'], 'estado'>>;
        Relationships: [];
      };

      llamados: {
        Row: {
          id: string;
          turno_id: string;
          punto_atencion_id: string;
          zona_id: string;
          etiqueta_publica: string;
          etiqueta_punto_atencion: string;
          tipo_llamado: TipoLlamado;
          agente_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          turno_id: string;
          punto_atencion_id: string;
          zona_id: string;
          etiqueta_publica: string;
          etiqueta_punto_atencion: string;
          tipo_llamado?: TipoLlamado;
          agente_id?: string | null;
          created_at?: string;
        };
        Update: never; // tabla append-only (log de eventos)
        Relationships: [];
      };

      auditoria: {
        Row: {
          id: string;
          agente_id: string | null;
          accion: string;
          turno_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          agente_id?: string | null;
          accion: string;
          turno_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };

    Views: Record<string, never>;

    Functions: {
      fn_llamar_siguiente_turno: {
        Args: { p_punto_atencion_id: string; p_agente_id: string };
        Returns: Database['public']['Tables']['turnos']['Row'] | null;
      };
      fn_re_llamar_turno: {
        Args: { p_turno_id: string; p_agente_id: string };
        Returns: Database['public']['Tables']['turnos']['Row'];
      };
      fn_marcar_ausente: {
        Args: { p_turno_id: string; p_agente_id: string };
        Returns: Database['public']['Tables']['turnos']['Row'];
      };
      fn_derivar_turno: {
        Args: {
          p_turno_id: string;
          p_especialidad_destino_id: string;
          p_agente_id: string;
          p_zona_destino_id: string | null;
        };
        Returns: Database['public']['Tables']['turnos']['Row'];
      };
      fn_salto_de_cola_autorizado: {
        Args: {
          p_turno_id: string;
          p_punto_atencion_id: string;
          p_agente_id: string;
          p_motivo: string;
        };
        Returns: Database['public']['Tables']['turnos']['Row'];
      };
      fn_confirmar_checkin: {
        Args: { p_turno_id: string; p_agente_id: string };
        Returns: Database['public']['Tables']['turnos']['Row'];
      };
      fn_iniciar_atencion: {
        Args: { p_turno_id: string; p_punto_atencion_id: string; p_agente_id: string };
        Returns: Database['public']['Tables']['turnos']['Row'];
      };
      fn_finalizar_atencion: {
        Args: { p_turno_id: string; p_punto_atencion_id: string; p_agente_id: string };
        Returns: Database['public']['Tables']['turnos']['Row'];
      };
      fn_generar_codigo_turno: {
        Args: { p_especialidad_id: string };
        Returns: string;
      };
      fn_agente_autorizado_turno: {
        Args: { p_turno_id: string; p_agente_id: string };
        Returns: boolean;
      };
      fn_enmascarar_turno: {
        Args: {
          p_turno: Database['public']['Tables']['turnos']['Row'];
          p_formato: FormatoPrivacidadTv;
        };
        Returns: string;
      };
      fn_rol_actual: {
        Args: Record<string, never>;
        Returns: RolUsuario;
      };
      fn_cerrar_jornada: {
        Args: Record<string, never>;
        Returns: number;
      };
      fn_metricas_ejecutivas: {
        Args: { p_desde: string; p_hasta: string; p_sla_minutos?: number };
        Returns: {
          total_generados: number;
          total_atendidos: number;
          total_ausentes: number;
          tasa_ausentismo: number | null;
          tpe_global_minutos: number | null;
          tpa_global_minutos: number | null;
          cumplimiento_sla: number | null;
        }[];
      };
      fn_heatmap_demanda: {
        Args: { p_desde: string; p_hasta: string };
        Returns: { dia_semana: number; hora: number; cantidad: number }[];
      };
      fn_tendencia_diaria: {
        Args: { p_desde: string; p_hasta: string };
        Returns: { fecha: string; cantidad: number }[];
      };
      fn_rendimiento_por_servicio: {
        Args: { p_desde: string; p_hasta: string };
        Returns: {
          especialidad_id: string;
          nombre_servicio: string;
          total_atenciones: number;
          tpe_minutos: number | null;
          tpa_minutos: number | null;
        }[];
      };
      fn_rendimiento_por_agente: {
        Args: { p_desde: string; p_hasta: string };
        Returns: {
          agente_id: string;
          nombre_agente: string;
          total_atenciones: number;
          tpa_minutos: number | null;
        }[];
      };
    };

    Enums: {
      rol_usuario: RolUsuario;
      estado_turno: EstadoTurno;
      tipo_turno: TipoTurno;
      algoritmo_cola: AlgoritmoCola;
      formato_privacidad_tv: FormatoPrivacidadTv;
      estado_punto_atencion: EstadoPuntoAtencion;
      tipo_llamado: TipoLlamado;
    };
  };
}

// ---------------------------------------------------------------------------------------
// Alias de conveniencia para uso en componentes/hooks (Row shortcuts)
// ---------------------------------------------------------------------------------------
export type Perfil = Database['public']['Tables']['perfiles']['Row'];
export type Especialidad = Database['public']['Tables']['especialidades']['Row'];
export type Zona = Database['public']['Tables']['zonas']['Row'];
export type PuntoAtencion = Database['public']['Tables']['puntos_atencion']['Row'];
export type ConfiguracionGlobal = Database['public']['Tables']['configuraciones_globales']['Row'];
export type Turno = Database['public']['Tables']['turnos']['Row'];
export type Llamado = Database['public']['Tables']['llamados']['Row'];
export type RegistroAuditoria = Database['public']['Tables']['auditoria']['Row'];
