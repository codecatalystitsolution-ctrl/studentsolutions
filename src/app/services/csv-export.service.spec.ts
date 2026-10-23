import { describe, expect, it } from 'vitest';
import { CsvExportService } from './csv-export.service';

describe('CsvExportService', () => {
  const service = new CsvExportService();

  it('sanitizes formula injection trigger characters (=, +, -, @)', () => {
    expect(service.sanitizeCellValue('=cmd|')).toBe("'=cmd|");
    expect(service.sanitizeCellValue('+1+2')).toBe("'+1+2");
    expect(service.sanitizeCellValue('-5')).toBe("'-5");
    expect(service.sanitizeCellValue('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
  });

  it('escapes quotes and wraps values with commas', () => {
    expect(service.sanitizeCellValue('Hello, World')).toBe('"Hello, World"');
    expect(service.sanitizeCellValue('Item "Special"')).toBe('"Item ""Special"""');
  });

  it('handles null, undefined and empty values safely', () => {
    expect(service.sanitizeCellValue(null)).toBe('');
    expect(service.sanitizeCellValue(undefined)).toBe('');
    expect(service.sanitizeCellValue('')).toBe('');
  });
});
