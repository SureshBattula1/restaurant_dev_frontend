import { Directive, ElementRef, Input, OnDestroy, AfterViewInit } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

@Directive({
  selector: '[appGsapReveal]',
  standalone: true
})
export class GsapRevealDirective implements AfterViewInit, OnDestroy {
  @Input() appGsapReveal: 'fadeUp' | 'fadeIn' | 'scale' = 'fadeUp';
  @Input() gsapDelay = 0;
  @Input() gsapDuration = 0.6;
  @Input() gsapStagger = 0;

  private scrollTrigger: ScrollTrigger | null = null;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const el = this.el.nativeElement;
    const reduced = prefersReducedMotion();

    const duration = reduced ? 0.2 : this.gsapDuration;
    const delay = reduced ? 0 : this.gsapDelay;
    const vars: gsap.TweenVars = {
      duration,
      delay,
      ease: 'power3.out',
      overwrite: true
    };
    let fromVars: gsap.TweenVars = { opacity: 0 };
    if (!reduced) {
      switch (this.appGsapReveal) {
        case 'fadeUp': fromVars = { ...fromVars, y: 36 }; break;
        case 'scale': fromVars = { ...fromVars, scale: 0.96 }; break;
      }
    }
    gsap.set(el, fromVars);
    this.scrollTrigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      onEnter: () => {
        gsap.to(el, { ...vars, y: 0, opacity: 1, scale: 1 });
      }
    });
  }

  ngOnDestroy(): void {
    this.scrollTrigger?.kill();
  }
}
