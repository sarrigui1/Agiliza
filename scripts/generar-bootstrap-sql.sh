#!/usr/bin/env bash
# Regenera supabase/bootstrap/agiliza_bootstrap_completo.sql concatenando todas las
# migraciones de supabase/migrations/ en orden. Correr cada vez que se agregue una
# migración nueva (ver docs/MANUAL_INSTALACION_IMPLEMENTACION.md, sección 4).
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="supabase/bootstrap/agiliza_bootstrap_completo.sql"

{
  echo "-- ====================================================================================="
  echo "-- AGILIZA — Bootstrap completo de base de datos para cliente nuevo"
  echo "-- Concatenación de supabase/migrations/*.sql en orden, generada automáticamente por"
  echo "-- scripts/generar-bootstrap-sql.sh."
  echo "-- NO editar este archivo a mano — para cambios, edita las migraciones individuales en"
  echo "-- supabase/migrations/ y vuelve a correr ese script (ver docs/MANUAL_INSTALACION_IMPLEMENTACION.md,"
  echo "-- sección 4)."
  echo "--"
  echo "-- Uso: pega el contenido completo de este archivo UNA SOLA VEZ en el SQL Editor de un"
  echo "-- proyecto Supabase nuevo. Reemplaza correr las migraciones una por una."
  echo "-- ====================================================================================="
  echo ""
  for f in supabase/migrations/*.sql; do
    n=$(basename "$f")
    echo ""
    echo "-- ------------------------------------------------------------------------------------"
    echo "-- Origen: supabase/migrations/$n"
    echo "-- ------------------------------------------------------------------------------------"
    cat "$f"
    echo ""
  done
} > "$OUT"

echo "Generado $OUT ($(grep -c '^-- Origen:' "$OUT") migraciones)."
