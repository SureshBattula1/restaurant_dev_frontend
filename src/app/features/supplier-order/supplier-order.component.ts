import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupplierOrderService, SupplierOrder, SupplierOrderItem } from '../../core/services/supplier-order.service';

@Component({
  selector: 'app-supplier-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-order.component.html',
  styleUrls: ['./supplier-order.component.css']
})
export class SupplierOrderComponent implements OnInit {
  order: SupplierOrder | null = null;
  token = '';
  loading = true;
  submitting = false;
  error = '';
  success = false;

  constructor(
    private route: ActivatedRoute,
    private supplierOrderService: SupplierOrderService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (this.token) {
      this.loadOrder();
    } else {
      this.error = 'Invalid link';
      this.loading = false;
    }
  }

  loadOrder(): void {
    this.loading = true;
    this.error = '';
    this.supplierOrderService.getOrder(this.token).subscribe({
      next: (data) => {
        data.items.forEach((i: any) => {
          i._supplier_qty = i.supplier_qty;
          i._price = i.price;
        });
        this.order = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load order';
        this.loading = false;
      }
    });
  }

  canSubmit(): boolean {
    if (!this.order?.items?.length) return false;
    return this.order.items.every((i: any) => (i._supplier_qty ?? i.supplier_qty ?? 0) >= 0 && (i._price ?? i.price ?? 0) >= 0);
  }

  submit(): void {
    if (!this.order || !this.canSubmit()) return;
    this.submitting = true;
    this.error = '';
    const items = this.order.items.map((i: any) => ({
      id: i.id,
      supplier_qty: Number(i._supplier_qty ?? i.supplier_qty ?? 0),
      price: Number(i._price ?? i.price ?? 0)
    }));
    this.supplierOrderService.submitOrder(this.token, items).subscribe({
      next: () => {
        this.success = true;
        this.submitting = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to submit';
        this.submitting = false;
      }
    });
  }
}
