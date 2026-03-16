import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuCardItem } from '../../../../core/services/menu-card.service';

@Component({
  selector: 'app-minimal-cafe-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './minimal-cafe-card.component.html',
  styleUrls: ['./minimal-cafe-card.component.css']
})
export class MinimalCafeCardComponent {
  @Input() item!: MenuCardItem;
  @Output() order = new EventEmitter<MenuCardItem>();

  onOrder(): void {
    this.order.emit(this.item);
  }

  getIcon(): string {
    if (this.item.vegetarian) return '🥗';
    if (this.item.spicy) return '🌶️';
    return '🍽️';
  }
}
