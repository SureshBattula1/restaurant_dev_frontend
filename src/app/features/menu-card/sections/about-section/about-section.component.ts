import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about-section.component.html',
  styleUrls: ['./about-section.component.css']
})
export class AboutSectionComponent {
  @Input() title = 'Our Story';
  @Input() description = 'A culinary journey of passion and excellence. We bring together the finest ingredients and time-honored techniques to create unforgettable dining experiences.';
}
