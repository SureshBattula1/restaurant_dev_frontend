import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuCardCategory } from '../../../../core/services/menu-card.service';

@Component({
  selector: 'app-category-filter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-filter.component.html',
  styleUrls: ['./category-filter.component.css']
})
export class CategoryFilterComponent {
  @Input() categories: MenuCardCategory[] = [];
  @Input() selectedCategory: MenuCardCategory | null = null;
  @Output() categoryChange = new EventEmitter<MenuCardCategory | null>();

  selectCategory(cat: MenuCardCategory | null): void {
    this.categoryChange.emit(cat);
  }
}
