'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Radar, Building2, LayoutDashboard, FileBarChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/shared/SignOutButton';

const LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/settings', label: 'Configuración', icon: Settings },
  { href: '/admin/supervisor', label: 'Supervisión', icon: Radar },
  { href: '/admin/infraestructura', label: 'Infraestructura', icon: Building2 },
  { href: '/admin/reportes', label: 'Reportes', icon: FileBarChart },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between border-b border-border bg-surface px-8 py-3">
      <div className="flex items-center gap-6">
        <span className="font-mono text-xs font-bold tracking-widest text-primary">FLOWQ_ADMIN</span>
        <div className="flex gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const activo = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition',
                  activo ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surface-high hover:text-text',
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
      <SignOutButton />
    </nav>
  );
}
