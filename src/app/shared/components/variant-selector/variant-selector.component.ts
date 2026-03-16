import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MenuItemVariant } from '../../../core/services/pos.service';

@Component({
  selector: 'app-variant-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './variant-selector.component.html',
  styleUrl: './variant-selector.component.css'
})
export class VariantSelectorComponent implements OnInit, OnChanges {
  @Input() item: any;
  @Input() variants: MenuItemVariant[] = [];
  @Input() show: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() selected = new EventEmitter<{ variant: MenuItemVariant | null; quantity: number }>();

  selectedVariant: MenuItemVariant | null = null;
  quantity: number = 1;

  ngOnInit(): void {
    this.initializeVariants();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['variants'] || changes['item']) {
      this.initializeVariants();
    }
    if (changes['show'] && changes['show'].currentValue === true) {
      // Reset quantity when modal opens
      this.quantity = 1;
    }
  }

  initializeVariants(): void {
    // Use variants from input, or fallback to item.variants
    const availableVariants = this.getAvailableVariants();
    
    if (availableVariants.length > 0) {
      const defaultVariant = availableVariants.find((v: MenuItemVariant) => v.is_default) || availableVariants[0];
      this.selectedVariant = defaultVariant;
    } else {
      this.selectedVariant = null;
    }
  }

  getAvailableVariants(): MenuItemVariant[] {
    // Use variants from input, or fallback to item.variants
    return (this.variants && this.variants.length > 0) 
      ? this.variants 
      : (this.item?.variants || []);
  }

  selectVariant(variant: MenuItemVariant): void {
    this.selectedVariant = variant;
  }

  increaseQuantity(): void {
    this.quantity += 1;
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity -= 1;
    }
  }

  addToCart(): void {
    this.selected.emit({
      variant: this.selectedVariant,
      quantity: this.quantity
    });
    this.closeModal();
  }

  closeModal(): void {
    this.close.emit();
  }

  getPrice(): number {
    if (this.selectedVariant) {
      return this.selectedVariant.price;
    }
    return this.item?.selling_price || 0;
  }

  getTotalPrice(): number {
    return this.getPrice() * this.quantity;
  }
}
