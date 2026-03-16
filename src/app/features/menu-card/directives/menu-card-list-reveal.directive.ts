import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  AfterViewInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { gsap } from 'gsap';

const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

@Directive({
  selector: '[appMenuCardListReveal]',
  standalone: true,
})
export class MenuCardListRevealDirective implements AfterViewInit, OnChanges {
  private el = inject(ElementRef<HTMLElement>);

  /** Change when list content changes (e.g. category id + items length) to re-run stagger */
  @Input() appMenuCardListReveal: string | number = '';

  private hasInitialized = false;

  ngAfterViewInit(): void {
    this.hasInitialized = true;
    this.animateList();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.hasInitialized) return;
    const keyChange = changes['appMenuCardListReveal'];
    if (keyChange && !keyChange.firstChange) {
      setTimeout(() => this.animateList(), 0);
    }
  }

  private animateList(): void {
    const host = this.el.nativeElement;
    const children = Array.from(host.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
    if (children.length === 0) return;

    const duration = 0.4;
    const stagger = REDUCED_MOTION ? 0 : 0.04;
    const yOffset = REDUCED_MOTION ? 0 : 16;

    gsap.set(children, { opacity: 0, y: yOffset });
    gsap.to(children, {
      opacity: 1,
      y: 0,
      duration,
      stagger: REDUCED_MOTION ? 0 : stagger,
      ease: 'power2.out',
      overwrite: true,
    });
  }
}
