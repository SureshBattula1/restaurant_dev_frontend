import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportOptions {
  filename?: string;
  sheetName?: string;
  columns?: string[];
  includeHeaders?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor() {}

  exportToCSV(data: any[], columns: { key: string; label: string }[], filename: string = 'export'): void {
    // Create CSV header
    const headers = columns.map(col => col.label);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        columns.map(col => {
          const value = this.getNestedValue(row, col.key);
          // Escape commas and quotes in CSV
          return `"${String(value || '').replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToExcel(data: any[], columns: { key: string; label: string }[], options: ExportOptions = {}): void {
    const filename = options.filename || 'export';
    const sheetName = options.sheetName || 'Sheet1';

    // Prepare data for Excel
    const headers = columns.map(col => col.label);
    const rows = data.map(row => 
      columns.map(col => this.getNestedValue(row, col.key))
    );

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Write file
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  exportToPDF(data: any[], columns: { key: string; label: string }[], options: ExportOptions = {}): void {
    const filename = options.filename || 'export';
    const doc = new jsPDF();

    // Prepare table data
    const headers = columns.map(col => col.label);
    const rows = data.map(row => 
      columns.map(col => {
        const value = this.getNestedValue(row, col.key);
        return value !== null && value !== undefined ? String(value) : '';
      })
    );

    // Add title
    doc.setFontSize(16);
    doc.text(filename, 14, 15);

    // Add table
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    // Save PDF
    doc.save(`${filename}.pdf`);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => {
      if (current && current[prop] !== undefined) {
        return current[prop];
      }
      // Handle array access like 'items.0.name'
      if (prop.includes('[') && prop.includes(']')) {
        const arrayProp = prop.split('[')[0];
        const index = parseInt(prop.split('[')[1].split(']')[0]);
        if (current && current[arrayProp] && Array.isArray(current[arrayProp])) {
          return current[arrayProp][index];
        }
      }
      return null;
    }, obj);
  }

  formatValue(value: any, type?: string): string {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'currency':
        return `₹${Number(value).toFixed(2)}`;
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'number':
        return Number(value).toFixed(2);
      case 'boolean':
        return value ? 'Yes' : 'No';
      default:
        return String(value);
    }
  }
}




