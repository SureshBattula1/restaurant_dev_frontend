import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-menu-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu-search.component.html',
  styleUrls: ['./menu-search.component.css']
})
export class MenuSearchComponent {
  @Output() searchChange = new EventEmitter<string>();

  searchTerm = '';
  private searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => this.searchChange.emit(term));
  }

  onInput(): void {
    this.searchSubject.next(this.searchTerm);
  }

  clear(): void {
    this.searchTerm = '';
    this.searchSubject.next('');
  }
}
