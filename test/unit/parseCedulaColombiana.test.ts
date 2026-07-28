import { describe, it, expect } from 'vitest';
import { parseCedulaColombiana } from '@/lib/parseCedulaColombiana';

describe('parseCedulaColombiana', () => {
  it('parsea un registro completo (documento + 2 apellidos + 2 nombres)', () => {
    const resultado = parseCedulaColombiana('PRE@1234567890@PEREZ@GOMEZ@JUAN@CARLOS');

    expect(resultado).toEqual({
      numeroDocumento: '1234567890',
      primerApellido: 'PEREZ',
      segundoApellido: 'GOMEZ',
      primerNombre: 'JUAN',
      segundoNombre: 'CARLOS',
      nombreCompleto: 'JUAN CARLOS PEREZ GOMEZ',
    });
  });

  it('parsea un registro sin segundo nombre (layout con solo 3 campos tras el documento)', () => {
    const resultado = parseCedulaColombiana('1234567890@PEREZ@GOMEZ@JUAN');

    expect(resultado).not.toBeNull();
    expect(resultado!.segundoNombre).toBe('');
    expect(resultado!.nombreCompleto).toBe('JUAN PEREZ GOMEZ');
  });

  it('encuentra el documento aunque no sea el primer campo', () => {
    const resultado = parseCedulaColombiana('CODIGOCONTROL@1020304050@RUIZ@GOMEZ@CARLOS');

    expect(resultado?.numeroDocumento).toBe('1020304050');
    expect(resultado?.nombreCompleto).toBe('CARLOS RUIZ GOMEZ');
  });

  it('recorta espacios en cada campo', () => {
    const resultado = parseCedulaColombiana('  1234567890 @ PEREZ @ GOMEZ @ JUAN ');

    expect(resultado?.numeroDocumento).toBe('1234567890');
    expect(resultado?.primerApellido).toBe('PEREZ');
    expect(resultado?.nombreCompleto).toBe('JUAN PEREZ GOMEZ');
  });

  it('devuelve null si no hay ningún campo puramente numérico de 5-15 dígitos', () => {
    expect(parseCedulaColombiana('PEREZ@GOMEZ@JUAN')).toBeNull();
  });

  it('devuelve null para un número demasiado corto (menos de 5 dígitos)', () => {
    expect(parseCedulaColombiana('1234@PEREZ@GOMEZ@JUAN')).toBeNull();
  });

  it('devuelve null si el documento se encuentra pero no hay ningún nombre después', () => {
    expect(parseCedulaColombiana('1234567890')).toBeNull();
  });

  it('devuelve null para una entrada vacía o solo espacios', () => {
    expect(parseCedulaColombiana('')).toBeNull();
    expect(parseCedulaColombiana('   ')).toBeNull();
  });

  it('ignora campos vacíos entre arrobas dobles', () => {
    const resultado = parseCedulaColombiana('1234567890@@PEREZ@@JUAN');

    // Los campos vacíos se filtran antes de indexar, así que apellido2 real es 'JUAN'
    // se corre a la posición de nombre1 — documenta el comportamiento real del parser.
    expect(resultado?.numeroDocumento).toBe('1234567890');
    expect(resultado?.primerApellido).toBe('PEREZ');
  });
});
