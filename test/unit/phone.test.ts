import { describe, it, expect } from 'vitest';
import { formatearTelefonoE164 } from '@/lib/notifications/phone';

describe('formatearTelefonoE164', () => {
  it('agrega +57 a un celular colombiano de 10 dígitos', () => {
    expect(formatearTelefonoE164('3001234567')).toBe('+573001234567');
  });

  it('limpia espacios y guiones antes de formatear', () => {
    expect(formatearTelefonoE164('300 123 4567')).toBe('+573001234567');
    expect(formatearTelefonoE164('300-123-4567')).toBe('+573001234567');
  });

  it('acepta un número de 12 dígitos que ya trae el indicativo 57', () => {
    expect(formatearTelefonoE164('573001234567')).toBe('+573001234567');
  });

  it('respeta un número que ya viene en formato E.164 con "+"', () => {
    expect(formatearTelefonoE164('+573001234567')).toBe('+573001234567');
  });

  it('rechaza un "+" con muy pocos dígitos (probable error de digitación)', () => {
    expect(formatearTelefonoE164('+1234')).toBeNull();
  });

  it('rechaza una cadena vacía o sin dígitos', () => {
    expect(formatearTelefonoE164('')).toBeNull();
    expect(formatearTelefonoE164('   ')).toBeNull();
    expect(formatearTelefonoE164('abc')).toBeNull();
  });

  it('rechaza una longitud de dígitos no reconocida (ni 10 ni 12-con-57)', () => {
    expect(formatearTelefonoE164('12345')).toBeNull();
    expect(formatearTelefonoE164('123456789012345')).toBeNull();
  });

  it('rechaza un número de 12 dígitos que no empieza con 57', () => {
    expect(formatearTelefonoE164('123456789012')).toBeNull();
  });
});
