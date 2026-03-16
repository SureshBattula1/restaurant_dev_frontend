import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parent_id?: number;
  image?: string;
  sort_order?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  constructor(private api: ApiService) {}

  getCategories(): Observable<Category[]> {
    return this.api.get<Category[]>('/categories');
  }

  getCategoriesWithItems(): Observable<Category[]> {
    return this.api.get<Category[]>('/categories?with_items=true');
  }

  getCategory(id: number): Observable<Category> {
    return this.api.get<Category>(`/categories/${id}`);
  }

  createCategory(category: Partial<Category>): Observable<Category> {
    return this.api.post<Category>('/categories', category);
  }
}

