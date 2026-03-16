import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuCardItem } from '../../../../core/services/menu-card.service';
import { ModernFoodCardComponent } from '../modern-food-card/modern-food-card.component';

@Component({
  selector: 'app-horizontal-food-slider',
  standalone: true,
  imports: [CommonModule, ModernFoodCardComponent],
  templateUrl: './horizontal-food-slider.component.html',
  styleUrls: ['./horizontal-food-slider.component.css']
})
export class HorizontalFoodSliderComponent {
  @Input() items: MenuCardItem[] = [];
  @Output() order = new EventEmitter<MenuCardItem>();
  @ViewChild('scrollEl') scrollEl?: ElementRef<HTMLElement>;

  onOrder(item: MenuCardItem): void {
    this.order.emit(item);
  }

  scroll(direction: 'left' | 'right'): void {
    const el = this.scrollEl?.nativeElement;
    if (!el) return;
    const step = 320;
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  }
}
