import { Injectable } from '@angular/core';
import { toDataURL } from 'qrcode';
import type { QRCodeToDataURLOptions } from 'qrcode';

@Injectable({
  providedIn: 'root'
})
export class QRService {
  async generateQRCode(data: string, options?: Partial<QRCodeToDataURLOptions>): Promise<string> {
    try {
      const defaultOptions: QRCodeToDataURLOptions = {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300,
        ...(options || {})
      };
      const result = await toDataURL(data, defaultOptions);
      return result;
    } catch (err) {
      console.error('Error generating QR code:', err);
      throw err;
    }
  }

  async generateQRCodeForTable(tableNumber: string, baseUrl: string = window.location.origin): Promise<string> {
    const qrData = `${baseUrl}/qr-order?table=${tableNumber}`;
    return this.generateQRCode(qrData, { width: 400 });
  }

  async generateQRCodeForMenu(locationId: number, baseUrl: string = window.location.origin): Promise<string> {
    const qrData = `${baseUrl}/qr-menu?location=${locationId}`;
    return this.generateQRCode(qrData, { width: 400 });
  }

  async downloadQRCode(data: string, filename: string = 'qrcode.png'): Promise<void> {
    const qrDataUrl = await this.generateQRCode(data);
    const link = document.createElement('a');
    link.download = filename;
    link.href = qrDataUrl;
    link.click();
  }
}

