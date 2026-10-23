import { describe, expect, it } from 'vitest';
import { PdfExportService } from './pdf-export.service';

describe('PdfExportService', () => {
  const service = new PdfExportService();

  it('instantiates and provides report export capability', () => {
    expect(service).toBeTruthy();
  });
});
