import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { createClient } from '@/lib/supabase/server';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Agiliza — Sistema de Llamado y Gestión de Turnos',
  description: 'Gestión de flujo de pacientes en tiempo real.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Preferencia de sede, no del navegador — se fija en /admin/settings y aplica a toda
  // la app (TV, check-in, workspace, panel admin) por igual. Se resuelve server-side
  // para que el HTML ya llegue con el tema correcto, sin parpadeo oscuro→claro al cargar.
  const supabase = await createClient();
  const { data: config } = await supabase
    .from('configuraciones_globales')
    .select('tema_visual')
    .eq('id', 1)
    .maybeSingle();
  const tema = config?.tema_visual ?? 'oscuro';

  return (
    <html
      lang="es"
      data-theme={tema}
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
