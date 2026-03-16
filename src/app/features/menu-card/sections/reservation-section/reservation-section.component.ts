import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reservation-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-section.component.html',
  styleUrls: ['./reservation-section.component.css']
})
export class ReservationSectionComponent {
  @Output() reserveClick = new EventEmitter<void>();
}
