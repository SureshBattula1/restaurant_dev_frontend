import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-branch-selector',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule
  ],
  templateUrl: './branch-selector.component.html',
  styleUrls: ['./branch-selector.component.css']
})
export class BranchSelectorComponent implements OnInit {
  @Input() selectedLocationId?: number | null;
  @Output() selectedLocationIdChange = new EventEmitter<number | null | undefined>();
  @Output() locationChange = new EventEmitter<number | null | undefined>(); // Keep for backward compatibility
  locations: any[] = [];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.adminService.getLocations().subscribe({
      next: (locations) => this.locations = locations
    });
  }

  onLocationChange(): void {
    const value = this.selectedLocationId === undefined ? null : this.selectedLocationId;
    this.selectedLocationIdChange.emit(value);
    this.locationChange.emit(value);
  }
}
