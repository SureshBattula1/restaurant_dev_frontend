import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionsDashboardComponent } from './transactions-dashboard.component';

describe('TransactionsDashboardComponent', () => {
  let component: TransactionsDashboardComponent;
  let fixture: ComponentFixture<TransactionsDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionsDashboardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TransactionsDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
