'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { exportarTurnosDetalladoCSV } from '@/actions/reports';

interface ExportButtonsProps {
  desde: string;
  hasta: string;
  rango: string;
}

export function ExportButtons({ desde, hasta, rango }: ExportButtonsProps) {
  const [isPending, startTransition] = useTransition();

  function descargarCsv() {
    startTransition(async () => {
      const res = await exportarTurnosDetalladoCSV(new Date(desde), new Date(hasta));
      if (!res.ok) return;

      const blob = new Blob([`﻿${res.data}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowq_turnos_${desde.slice(0, 10)}_${hasta.slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const paramsReporte = new URLSearchParams({ rango, desde, hasta }).toString();

  return (
    <div className="flex gap-3">
      <Link href={`/admin/reportes?${paramsReporte}`} target="_blank">
        <Button variant="ghost">
          <FileText className="size-4" />
          Exportar PDF Ejecutivo
        </Button>
      </Link>
      <Button variant="ghost" onClick={descargarCsv} loading={isPending}>
        <Download className="size-4" />
        Descargar CSV
      </Button>
    </div>
  );
}
