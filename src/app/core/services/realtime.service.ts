import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { KitchenOrder } from './kitchen.service';

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private kitchenOrdersSubject = new BehaviorSubject<KitchenOrder[]>([]);
  private inventoryUpdatesSubject = new Subject<any>();
  private salesSubject = new Subject<any>();
  private notificationsSubject = new Subject<any>();
  private attendanceUpdatesSubject = new Subject<any>();
  private expenseUpdatesSubject = new Subject<any>();
  private purchaseOrderUpdatesSubject = new Subject<any>();
  private salaryUpdatesSubject = new Subject<any>();
  private transactionUpdatesSubject = new Subject<any>();
  private financialUpdatesSubject = new Subject<any>();

  constructor() {
    // Service initialization
  }

  // Observable streams that components can subscribe to
  kitchenOrders$: Observable<KitchenOrder[]> = this.kitchenOrdersSubject.asObservable();
  inventoryUpdates$: Observable<any> = this.inventoryUpdatesSubject.asObservable();
  sales$: Observable<any> = this.salesSubject.asObservable();
  notifications$: Observable<any> = this.notificationsSubject.asObservable();
  attendanceUpdates$: Observable<any> = this.attendanceUpdatesSubject.asObservable();
  expenseUpdates$: Observable<any> = this.expenseUpdatesSubject.asObservable();
  purchaseOrderUpdates$: Observable<any> = this.purchaseOrderUpdatesSubject.asObservable();
  salaryUpdates$: Observable<any> = this.salaryUpdatesSubject.asObservable();
  transactionUpdates$: Observable<any> = this.transactionUpdatesSubject.asObservable();
  financialUpdates$: Observable<any> = this.financialUpdatesSubject.asObservable();

  // Methods to update the streams (can be called from WebSocket service or other sources)
  updateKitchenOrders(orders: KitchenOrder[]): void {
    this.kitchenOrdersSubject.next(orders);
  }

  updateInventory(update: any): void {
    this.inventoryUpdatesSubject.next(update);
  }

  updateSales(sales: any): void {
    this.salesSubject.next(sales);
  }

  sendNotification(notification: any): void {
    this.notificationsSubject.next(notification);
  }

  updateAttendance(update: any): void {
    this.attendanceUpdatesSubject.next(update);
  }

  updateExpense(update: any): void {
    this.expenseUpdatesSubject.next(update);
  }

  updatePurchaseOrder(update: any): void {
    this.purchaseOrderUpdatesSubject.next(update);
  }

  updateSalary(update: any): void {
    this.salaryUpdatesSubject.next(update);
  }

  updateTransaction(update: any): void {
    this.transactionUpdatesSubject.next(update);
  }

  updateFinancial(update: any): void {
    this.financialUpdatesSubject.next(update);
  }
}
