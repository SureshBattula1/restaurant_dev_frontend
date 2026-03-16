import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuCardCategory, MenuCardItem } from '../../../../core/services/menu-card.service';
import { CategoryFilterComponent } from '../../shared/category-filter/category-filter.component';
import { MenuSearchComponent } from '../../shared/menu-search/menu-search.component';
import { SimpleMenuCardComponent } from '../../components/simple-menu-card/simple-menu-card.component';
import { ModernFoodCardComponent } from '../../components/modern-food-card/modern-food-card.component';
import { FeaturedDishCardComponent } from '../../components/featured-dish-card/featured-dish-card.component';
import { MinimalCafeCardComponent } from '../../components/minimal-cafe-card/minimal-cafe-card.component';
import { FloatingGlassCardComponent } from '../../components/floating-glass-card/floating-glass-card.component';
import { HorizontalFoodSliderComponent } from '../../components/horizontal-food-slider/horizontal-food-slider.component';
import { MenuCardListRevealDirective } from '../../directives/menu-card-list-reveal.directive';

export type CardStyle = 'simple' | 'grid' | 'featured' | 'minimal' | 'glass' | 'slider';

@Component({
  selector: 'app-menu-cards-section',
  standalone: true,
  imports: [
    CommonModule,
    MenuCardListRevealDirective,
    CategoryFilterComponent,
    MenuSearchComponent,
    SimpleMenuCardComponent,
    ModernFoodCardComponent,
    FeaturedDishCardComponent,
    MinimalCafeCardComponent,
    FloatingGlassCardComponent,
    HorizontalFoodSliderComponent
  ],
  templateUrl: './menu-cards-section.component.html',
  styleUrls: ['./menu-cards-section.component.css']
})
export class MenuCardsSectionComponent {
  @Input() categories: MenuCardCategory[] = [];
  @Input() selectedCategory: MenuCardCategory | null = null;
  @Input() cardStyle: CardStyle = 'grid';
  @Output() categoryChange = new EventEmitter<MenuCardCategory | null>();
  @Output() order = new EventEmitter<MenuCardItem>();

  searchTerm = '';

  get items(): MenuCardItem[] {
    const cat = this.selectedCategory;
    const items = cat ? cat.items : this.categories.flatMap(c => c.items);
    if (!this.searchTerm.trim()) return items;
    const q = this.searchTerm.toLowerCase();
    return items.filter((i: MenuCardItem) =>
      i.name.toLowerCase().includes(q) ||
      (i.description?.toLowerCase().includes(q))
    );
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
  }
}
