import { Component, Input, Output, EventEmitter, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuCardItem } from '../../../../core/services/menu-card.service';
import { gsap } from 'gsap';

@Component({
  selector: 'app-featured-dish-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './featured-dish-card.component.html',
  styleUrls: ['./featured-dish-card.component.css']
})
export class FeaturedDishCardComponent implements AfterViewInit {
  @Input() item!: MenuCardItem;
  @Output() order = new EventEmitter<MenuCardItem>();

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const card = this.el.nativeElement;
    card.addEventListener('mouseenter', () => {
      gsap.to(card, { boxShadow: '0 20px 56px rgba(184, 82, 58, 0.22)', duration: 0.4 });
      gsap.to(card, { outline: '2px solid rgba(184, 82, 58, 0.5)', outlineOffset: 3, duration: 0.35 });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { boxShadow: '0 6px 24px rgba(28, 25, 23, 0.1)', duration: 0.35 });
      gsap.to(card, { outline: 'none', outlineOffset: 0, duration: 0.3 });
    });
  }

  onOrder(): void {
    this.order.emit(this.item);
  }
}
