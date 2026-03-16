import { Component, Input, Output, EventEmitter, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuCardItem } from '../../../../core/services/menu-card.service';
import { gsap } from 'gsap';

@Component({
  selector: 'app-floating-glass-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-glass-card.component.html',
  styleUrls: ['./floating-glass-card.component.css']
})
export class FloatingGlassCardComponent implements AfterViewInit {
  @Input() item!: MenuCardItem;
  @Output() order = new EventEmitter<MenuCardItem>();

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const card = this.el.nativeElement;
    card.addEventListener('mouseenter', () => {
      gsap.to(card, { y: -6, scale: 1.02, duration: 0.4, ease: 'power2.out' });
      gsap.to(card, { boxShadow: '0 16px 48px rgba(28, 25, 23, 0.1)', duration: 0.35 });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { y: 0, scale: 1, duration: 0.35 });
      gsap.to(card, { boxShadow: '0 8px 32px rgba(28, 25, 23, 0.06)', duration: 0.3 });
    });
  }

  onOrder(): void {
    this.order.emit(this.item);
  }
}
