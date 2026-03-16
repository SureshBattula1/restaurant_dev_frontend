import { Component, Input, Output, EventEmitter, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuCardItem } from '../../../../core/services/menu-card.service';
import { gsap } from 'gsap';

@Component({
  selector: 'app-modern-food-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modern-food-card.component.html',
  styleUrls: ['./modern-food-card.component.css']
})
export class ModernFoodCardComponent implements AfterViewInit {
  @Input() item!: MenuCardItem;
  @Output() order = new EventEmitter<MenuCardItem>();

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const card = this.el.nativeElement;
    const img = card.querySelector('.modern-img');
    card.addEventListener('mouseenter', () => {
      gsap.to(card, { y: -8, duration: 0.4, ease: 'power2.out' });
      gsap.to(card, { boxShadow: '0 16px 48px rgba(28, 25, 23, 0.1)', duration: 0.35 });
      if (img) gsap.to(img, { scale: 1.06, duration: 0.5, ease: 'power2.out' });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { y: 0, duration: 0.35 });
      gsap.to(card, { boxShadow: '0 6px 24px rgba(28, 25, 23, 0.08)', duration: 0.3 });
      if (img) gsap.to(img, { scale: 1, duration: 0.35 });
    });
  }

  onOrder(): void {
    this.order.emit(this.item);
  }
}
