import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuItemService } from '../../core/services/menu-item.service';
import { PosService } from '../../core/services/pos.service';
import { QRService } from '../../core/services/qr.service';
import { NotificationService } from '../../core/services/notification.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-qr-menu',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatBadgeModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './qr-menu.component.html',
  styleUrls: ['./qr-menu.component.css']
})
export class QrMenuComponent implements OnInit {
  items: any[] = [];
  categories: any[] = [];
  selectedCategory: any = null;
  cart: any[] = [];
  tableNumber: string = '';
  locationId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuItemService: MenuItemService,
    private posService: PosService,
    private qrService: QRService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.tableNumber = params['table'] || '';
      this.locationId = params['location'] ? parseInt(params['location']) : null;
      this.loadMenu();
    });
  }

  loadMenu(): void {
    this.menuItemService.getMenuItems().subscribe({
      next: (response) => {
        this.items = response.data || response;
        this.loadCategories();
      },
      error: (err) => {
        console.error('Error loading menu:', err);
      }
    });
  }

  loadCategories(): void {
    const categoryMap = new Map();
    this.items.forEach(item => {
      if (item.category) {
        if (!categoryMap.has(item.category.id)) {
          categoryMap.set(item.category.id, item.category);
        }
      }
    });
    this.categories = Array.from(categoryMap.values());
  }

  selectCategory(category: any): void {
    this.selectedCategory = category;
  }

  addToCart(item: any): void {
    const existingItem = this.cart.find(c => c.id === item.id);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.cart.push({
        ...item,
        quantity: 1
      });
    }
    this.notification.success(`${item.name} added to cart`);
  }

  removeFromCart(item: any): void {
    const index = this.cart.findIndex(c => c.id === item.id);
    if (index > -1) {
      if (this.cart[index].quantity > 1) {
        this.cart[index].quantity -= 1;
      } else {
        this.cart.splice(index, 1);
      }
    }
  }

  getTotal(): number {
    return this.cart.reduce((sum, item) => {
      return sum + (item.selling_price * item.quantity);
    }, 0);
  }

  getFilteredItems(): any[] {
    if (!this.selectedCategory) {
      return this.items;
    }
    return this.items.filter(item => 
      item.category?.id === this.selectedCategory.id
    );
  }

  placeOrder(): void {
    if (this.cart.length === 0) {
      this.notification.warning('Cart is empty');
      return;
    }

    const orderData = {
      table_number: this.tableNumber,
      items: this.cart.map(item => ({
        menu_item_id: item.id,
        quantity: item.quantity,
        unit_price: item.selling_price
      }))
    };

    this.posService.createSale(orderData).subscribe({
      next: (sale) => {
        this.notification.success('Order placed successfully!');
        this.cart = [];
        // Redirect or show order confirmation
      },
      error: (err) => {
        this.notification.error('Error placing order');
      }
    });
  }
}

