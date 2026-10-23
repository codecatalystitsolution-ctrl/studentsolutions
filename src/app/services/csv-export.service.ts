import { Injectable } from '@angular/core';

export interface CsvColumn<T = any> {
  key: string;
  label: string;
  format?: (value: any, row: T) => string | number | null | undefined;
}

@Injectable({ providedIn: 'root' })
export class CsvExportService {
  /**
   * Sanitizes a cell string value to prevent CSV Formula Injection (CWE-1236).
   * If a value begins with =, +, -, @, tab, or carriage return, it is prefixed with a single quote.
   */
  sanitizeCellValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    const str = String(value).trim();
    if (str.length === 0) {
      return '';
    }

    // Dangerous formula trigger characters
    const firstChar = str.charAt(0);
    const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
    let safeStr = str;

    if (dangerousChars.includes(firstChar)) {
      safeStr = `'${str}`;
    }

    // Escape double quotes and enclose in quotes if it contains commas, quotes, or newlines
    if (safeStr.includes('"') || safeStr.includes(',') || safeStr.includes('\n') || safeStr.includes('\r')) {
      return `"${safeStr.replace(/"/g, '""')}"`;
    }

    return safeStr;
  }

  /**
   * Exports an array of typed records to a downloadable CSV file.
   */
  exportToCsv<T>(filename: string, columns: CsvColumn<T>[], records: T[]): boolean {
    if (!records || !columns || columns.length === 0) {
      return false;
    }

    const headerRow = columns.map(col => this.sanitizeCellValue(col.label)).join(',');
    const rows: string[] = [headerRow];

    for (const record of records) {
      const rowValues = columns.map(col => {
        let val: any;
        if (col.format) {
          val = col.format((record as any)[col.key], record);
        } else {
          val = (record as any)[col.key];
        }
        return this.sanitizeCellValue(val);
      });
      rows.push(rowValues.join(','));
    }

    const csvContent = '\uFEFF' + rows.join('\r\n'); // Add UTF-8 BOM for Excel compatibility
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

    if (typeof window !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', cleanFilename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }

    return false;
  }
}
