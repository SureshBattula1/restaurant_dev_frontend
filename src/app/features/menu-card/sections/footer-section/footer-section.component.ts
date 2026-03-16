import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer-section.component.html',
  styleUrls: ['./footer-section.component.css']
})
export class FooterSectionComponent {
  @Input() restaurantName = 'Our Restaurant';
  @Input() address = '123 Restaurant Street, City';
  @Input() phone = '+1 234 567 8900';
  @Input() email = 'info@restaurant.com';
}
