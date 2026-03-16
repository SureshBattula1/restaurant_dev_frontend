import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gallery-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery-section.component.html',
  styleUrls: ['./gallery-section.component.css']
})
export class GallerySectionComponent {
  placeholders = [1, 2, 3, 4, 5, 6];
}
