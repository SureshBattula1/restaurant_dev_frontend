import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero-section.component.html',
  styleUrls: ['./hero-section.component.css']
})
export class HeroSectionComponent {
  @Input() restaurantName = 'Our Restaurant';
  @Input() tagline = 'Exquisite dining experience';
  @Output() reserveClick = new EventEmitter<void>();
}
