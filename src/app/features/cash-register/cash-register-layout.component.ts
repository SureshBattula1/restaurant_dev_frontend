import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-cash-register-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './cash-register-layout.component.html',
  styleUrls: ['./cash-register-layout.component.css']
})
export class CashRegisterLayoutComponent {}
