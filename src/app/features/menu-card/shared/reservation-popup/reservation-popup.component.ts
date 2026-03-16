import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reservation-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-popup.component.html',
  styleUrls: ['./reservation-popup.component.css']
})
export class ReservationPopupComponent {
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(e: Event): void {
    if ((e.target as HTMLElement).classList.contains('popup-backdrop')) {
      this.close.emit();
    }
  }
}
