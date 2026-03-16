import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MenuCardService, MenuCardData, MenuCardCategory, MenuCardLocation } from '../../core/services/menu-card.service';
import { MenuCardRealtimeService } from '../../core/services/menu-card-realtime.service';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { HeroSectionComponent } from './sections/hero-section/hero-section.component';
import { AboutSectionComponent } from './sections/about-section/about-section.component';
import { MenuCardsSectionComponent, CardStyle } from './sections/menu-cards-section/menu-cards-section.component';
import { GallerySectionComponent } from './sections/gallery-section/gallery-section.component';
import { ReservationSectionComponent } from './sections/reservation-section/reservation-section.component';
import { FooterSectionComponent } from './sections/footer-section/footer-section.component';
import { ReservationPopupComponent } from './shared/reservation-popup/reservation-popup.component';
import { GsapRevealDirective } from './directives/gsap-reveal.directive';

@Component({
  selector: 'app-menu-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GsapRevealDirective,
    HeroSectionComponent,
    AboutSectionComponent,
    MenuCardsSectionComponent,
    GallerySectionComponent,
    ReservationSectionComponent,
    FooterSectionComponent,
    ReservationPopupComponent
  ],
  templateUrl: './menu-card.component.html',
  styleUrls: ['./menu-card.component.css']
})
export class MenuCardComponent implements OnInit, OnDestroy {
  data: MenuCardData | null = null;
  selectedCategory: MenuCardCategory | null = null;
  branches: MenuCardLocation[] = [];
  selectedBranchId: number | null = null;
  loading = true;
  error: string | null = null;
  showReservationPopup = false;
  cardStyle: CardStyle = 'grid';
  headerScrolled = false;
  private pollSubscription?: Subscription;
  private realtimeSub?: Subscription;

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.headerScrolled = typeof window !== 'undefined' && window.scrollY > 24;
  }

  constructor(
    private route: ActivatedRoute,
    private menuCardService: MenuCardService,
    private menuCardRealtime: MenuCardRealtimeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const branch = params['branch'] ? parseInt(params['branch'], 10) : null;
      this.selectedBranchId = branch && !isNaN(branch) ? branch : null;
      const style = params['style'] as CardStyle;
      if (['simple', 'grid', 'featured', 'minimal', 'glass', 'slider'].includes(style)) {
        this.cardStyle = style;
      }
      this.loadData();
    });
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
    this.realtimeSub?.unsubscribe();
    this.menuCardRealtime.unsubscribe();
  }

  loadData(): void {
    if (this.selectedBranchId) {
      this.loadMenuCard(this.selectedBranchId);
      this.startPolling(this.selectedBranchId);
    } else {
      this.loading = true;
      this.loadBranches();
    }
  }

  loadBranches(): void {
    this.menuCardService.getBranches().subscribe({
      next: (branches) => {
        this.branches = branches;
        if (branches.length > 0 && !this.selectedBranchId) {
          this.selectedBranchId = branches[0].id;
          this.loadMenuCard(branches[0].id);
          this.startPolling(branches[0].id);
        }
        this.loading = false;
        this.error = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load branches';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadMenuCard(locationId: number, silent = false): void {
    if (!silent) {
      this.loading = true;
    }
    this.error = null;
    this.menuCardService.getMenuCard(locationId).subscribe({
      next: (data) => {
        this.data = data;
        const prevCatId = this.selectedCategory?.id;
        const cat = prevCatId ? data.categories.find(c => c.id === prevCatId) : null;
        this.selectedCategory = cat ?? (data.categories[0] ?? null);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load menu';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onBranchChange(branchId: number | string): void {
    const id = typeof branchId === 'string' ? parseInt(branchId, 10) : branchId;
    const branch = this.branches.find(b => b.id === id);
    if (branch) {
      this.selectedBranchId = branch.id;
      this.pollSubscription?.unsubscribe();
      this.loadMenuCard(branch.id);
      this.startPolling(branch.id);
    }
  }

  selectCategory(cat: MenuCardCategory | null): void {
    this.selectedCategory = cat;
  }

  openReservation(): void {
    this.showReservationPopup = true;
  }

  closeReservation(): void {
    this.showReservationPopup = false;
  }

  onOrder(): void {
    // Order action - could open modal or navigate
  }

  retry(): void {
    this.error = null;
    this.loading = true;
    this.cdr.detectChanges();
    this.loadData();
  }

  private startPolling(locationId: number): void {
    this.menuCardRealtime.subscribe(locationId);
    this.realtimeSub?.unsubscribe();
    this.realtimeSub = this.menuCardRealtime.menuCardUpdated$.subscribe((id) => {
      if (id === locationId) {
        this.loadMenuCard(locationId, true);
      }
    });
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = interval(45000).pipe(
      switchMap(() => this.menuCardService.getMenuCard(locationId))
    ).subscribe({
      next: (data) => {
        if (this.data && data.location.id === this.data.location.id) {
          this.data = data;
          if (this.selectedCategory) {
            this.selectedCategory = data.categories.find(c => c.id === this.selectedCategory!.id) ?? data.categories[0] ?? null;
          }
          this.cdr.detectChanges();
        }
      }
    });
  }
}
