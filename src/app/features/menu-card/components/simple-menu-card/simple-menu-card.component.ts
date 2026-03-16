import { Component, Input, Output, EventEmitter, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuCardItem } from '../../../../core/services/menu-card.service';
import { gsap } from 'gsap';

@Component({
  selector: 'app-simple-menu-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './simple-menu-card.component.html',
  styleUrls: ['./simple-menu-card.component.css']
})
export class SimpleMenuCardComponent implements AfterViewInit {
  @Input() item!: MenuCardItem;
  @Output() order = new EventEmitter<MenuCardItem>();

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const card = this.el.nativeElement;
    const title = card.querySelector('.simple-title');
    const line = card.querySelector('.simple-underline');
    card.addEventListener('mouseenter', () => {
      if (title) gsap.to(title, { color: '#B8523A', duration: 0.35, ease: 'power2.out' });
      if (line) gsap.fromTo(line, { scaleX: 0, transformOrigin: 'left' }, { scaleX: 1, duration: 0.45, ease: 'power2.out' });
    });
    card.addEventListener('mouseleave', () => {
      if (title) gsap.to(title, { color: '#1C1917', duration: 0.3 });
      if (line) gsap.to(line, { scaleX: 0, duration: 0.3, ease: 'power2.in' });
    });
  }

  onOrder(): void {
    this.order.emit(this.item);
  }
}
