import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CashRegisterService, CashRegister, CashTransaction } from '../../core/services/cash-register.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './cash-register.component.html',
  styleUrls: ['./cash-register.component.css']
})
export class CashRegisterComponent implements OnInit {
  currentRegister: CashRegister | null = null;
  transactions: CashTransaction[] = [];
  registerHistory: CashRegister[] = [];
  
  openRegisterForm: FormGroup;
  closeRegisterForm: FormGroup;
  transactionForm: FormGroup;
  
  showOpenModal = false;
  showCloseModal = false;
  showTransactionModal = false;
  
  currentUser: any;

  constructor(
    private fb: FormBuilder,
    private cashRegisterService: CashRegisterService,
    private authService: AuthService,
    private notification: NotificationService
  ) {
    this.openRegisterForm = this.fb.group({
      opening_balance: [0, [Validators.required, Validators.min(0)]],
      notes: ['']
    });

    this.closeRegisterForm = this.fb.group({
      closing_balance: [0, [Validators.required, Validators.min(0)]],
      notes: ['']
    });

    this.transactionForm = this.fb.group({
      transaction_type: ['in', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      reference_type: [''],
      reference_id: [null],
      notes: [''],
      category: ['']
    });
  }

  getReferenceLabel(transaction: CashTransaction): string {
    if (!transaction?.reference_type || transaction?.reference_id == null) return '';
    const type = (transaction.reference_type || '').split('\\').pop() || '';
    if (type === 'Sale') return `Sale #${transaction.reference_id}`;
    return `${type} #${transaction.reference_id}`;
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadCurrentRegister();
  }

  loadCurrentRegister(): void {
    const locationId = this.currentUser?.location_id;
    this.cashRegisterService.getCurrentRegister(locationId).subscribe({
      next: (register) => {
        this.currentRegister = register;
        if (register) {
          this.loadTransactions(register.id);
        } else {
          this.showOpenModal = true;
        }
      },
      error: (err) => console.error('Error loading register:', err)
    });
  }

  loadTransactions(registerId: number): void {
    this.cashRegisterService.getTransactions(registerId).subscribe({
      next: (transactions) => {
        this.transactions = transactions;
      },
      error: (err) => console.error('Error loading transactions:', err)
    });
  }

  loadHistory(): void {
    const locationId = this.currentUser?.location_id;
    this.cashRegisterService.getRegisterHistory(locationId).subscribe({
      next: (history) => {
        this.registerHistory = history;
      },
      error: (err) => console.error('Error loading history:', err)
    });
  }

  openRegister(): void {
    if (this.openRegisterForm.invalid) return;

    const locationId = this.currentUser?.location_id;
    this.cashRegisterService.openRegister(this.openRegisterForm.value, locationId).subscribe({
      next: (register) => {
        this.currentRegister = register;
        this.showOpenModal = false;
        this.notification.success('Cash register opened successfully');
        this.openRegisterForm.reset();
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error opening register');
      }
    });
  }

  closeRegister(): void {
    if (this.closeRegisterForm.invalid || !this.currentRegister) return;

    this.cashRegisterService.closeRegister(this.closeRegisterForm.value, this.currentRegister.id).subscribe({
      next: (register) => {
        this.currentRegister = null;
        this.showCloseModal = false;
        this.notification.success('Cash register closed successfully');
        this.closeRegisterForm.reset();
        this.loadHistory();
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error closing register');
      }
    });
  }

  addTransaction(): void {
    if (this.transactionForm.invalid || !this.currentRegister) return;

    this.cashRegisterService.addTransaction(this.currentRegister.id, this.transactionForm.value).subscribe({
      next: () => {
        this.notification.success('Transaction added successfully');
        this.loadTransactions(this.currentRegister!.id);
        this.loadCurrentRegister();
        this.showTransactionModal = false;
        this.transactionForm.reset({ transaction_type: 'in' });
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error adding transaction');
      }
    });
  }

  getTotalIn(): number {
    return this.transactions
      .filter(t => t.transaction_type === 'in')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getTotalOut(): number {
    return this.transactions
      .filter(t => t.transaction_type === 'out')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getExpectedBalance(): number {
    if (!this.currentRegister) return 0;
    return this.currentRegister.opening_balance + this.getTotalIn() - this.getTotalOut();
  }
}


