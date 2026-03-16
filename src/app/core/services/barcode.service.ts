import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { Html5Qrcode } from 'html5-qrcode';

@Injectable({
  providedIn: 'root'
})
export class BarcodeService {
  private scanResultSubject = new Subject<string>();
  public scanResult$ = this.scanResultSubject.asObservable();
  private html5QrCode: Html5Qrcode | null = null;
  private isScanning = false;

  async startScanning(elementId: string = 'barcode-scanner'): Promise<void> {
    if (this.isScanning) {
      return;
    }

    try {
      this.html5QrCode = new Html5Qrcode(elementId);
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText: string) => {
          this.scanResultSubject.next(decodedText);
          this.stopScanning();
        },
        (errorMessage: string) => {
          // Ignore scanning errors
        }
      );
      this.isScanning = true;
    } catch (err) {
      console.error('Error starting barcode scanner:', err);
      throw err;
    }
  }

  stopScanning(): void {
    if (this.html5QrCode && this.isScanning) {
      this.html5QrCode.stop().then(() => {
        this.html5QrCode?.clear();
        this.html5QrCode = null;
        this.isScanning = false;
      }).catch((err: any) => {
        console.error('Error stopping scanner:', err);
      });
    }
  }

  scanFromFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.html5QrCode) {
        this.html5QrCode = new Html5Qrcode('barcode-scanner');
      }

      this.html5QrCode.scanFile(file, false)
        .then((decodedText: string) => {
          resolve(decodedText);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  isSupported(): boolean {
    try {
      // Check if camera is available
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    } catch (e) {
      return false;
    }
  }
}

