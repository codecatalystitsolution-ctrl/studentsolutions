import { Injectable } from '@angular/core';

export interface UserPdfReportData {
  title: string;
  referenceId: string;
  generatedAt: string;
  profile: {
    fullName: string;
    email: string;
    role: string;
    status: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
    pincode?: string;
    institution?: string;
    course?: string;
    studentId?: string;
    serviceArea?: string;
    createdAt?: string;
  };
  sections: Array<{
    title: string;
    rows: Array<{ label: string; value: string | number }>;
  }>;
  tables?: Array<{
    title: string;
    headers: string[];
    rows: string[][];
  }>;
}

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  /**
   * Generates and triggers a print/save-as-PDF document for user records.
   */
  exportReport(data: UserPdfReportData): boolean {
    if (typeof window === 'undefined') return false;

    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (!printWindow) return false;

    const sectionsHtml = data.sections
      .map(
        sec => `
        <div class="report-section">
          <h3>${this.escape(sec.title)}</h3>
          <div class="meta-grid">
            ${sec.rows
              .map(
                r => `
              <div class="meta-item">
                <span class="meta-label">${this.escape(r.label)}:</span>
                <span class="meta-value">${this.escape(String(r.value ?? 'N/A'))}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
      )
      .join('');

    const tablesHtml = (data.tables || [])
      .map(
        tbl => `
        <div class="report-section">
          <h3>${this.escape(tbl.title)}</h3>
          ${
            tbl.rows.length === 0
              ? '<p class="empty-text">No records recorded.</p>'
              : `
            <table class="report-table">
              <thead>
                <tr>
                  ${tbl.headers.map(h => `<th>${this.escape(h)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${tbl.rows
                  .map(
                    row => `
                  <tr>
                    ${row.map(cell => `<td>${this.escape(cell)}</td>`).join('')}
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          `
          }
        </div>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${this.escape(data.title)} - ${this.escape(data.referenceId)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 2.5rem;
            line-height: 1.5;
            font-size: 13px;
          }
          .report-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 1.25rem;
            margin-bottom: 1.75rem;
          }
          .brand-title {
            font-size: 22px;
            font-weight: 800;
            color: #1e1b4b;
            margin: 0 0 4px 0;
          }
          .brand-subtitle {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .report-meta {
            text-align: right;
            font-size: 11px;
            color: #64748b;
          }
          .report-meta strong {
            display: block;
            font-size: 13px;
            color: #0f172a;
          }
          .report-section {
            margin-bottom: 1.75rem;
          }
          .report-section h3 {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #4f46e5;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin: 0 0 10px 0;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px 16px;
          }
          .meta-item {
            display: flex;
            font-size: 12px;
          }
          .meta-label {
            width: 140px;
            font-weight: 600;
            color: #475569;
          }
          .meta-value {
            flex: 1;
            color: #0f172a;
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 8px;
          }
          .report-table th, .report-table td {
            border: 1px solid #cbd5e1;
            padding: 7px 10px;
            text-align: left;
          }
          .report-table th {
            background-color: #f1f5f9;
            font-weight: 700;
            color: #334155;
          }
          .report-table tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .empty-text {
            color: #94a3b8;
            font-style: italic;
          }
          .report-footer {
            margin-top: 2.5rem;
            border-top: 1px solid #e2e8f0;
            padding-top: 1rem;
            font-size: 11px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
          }
          @media print {
            body { padding: 1rem; }
            @page { margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div>
            <div class="brand-title">FileCrafters Academic Services</div>
            <div class="brand-subtitle">Authorized System Records</div>
          </div>
          <div class="report-meta">
            <strong>${this.escape(data.title)}</strong>
            <span>Ref: ${this.escape(data.referenceId)}</span><br>
            <span>Generated: ${this.escape(data.generatedAt)}</span>
          </div>
        </div>

        ${sectionsHtml}
        ${tablesHtml}

        <div class="report-footer">
          <span>Confidentiality Notice: This document contains authorized administrative records.</span>
          <span>FileCrafters Platform</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    return true;
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
