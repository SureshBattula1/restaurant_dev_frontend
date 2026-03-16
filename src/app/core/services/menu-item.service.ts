import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface MenuItemVariant {
  id?: number;
  menu_item_id?: number;
  name: string;
  slug?: string;
  price: number;
  display_order?: number;
  is_default?: boolean;
  status?: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface BranchStatus {
  location_id: number;
  is_active: boolean;
  location?: {
    id: number;
    name: string;
    code: string;
  };
}

export interface MenuItem {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  category_id?: number;
  recipe_id?: number;
  selling_price: number;
  tax_rate: number;
  description?: string;
  image?: string;
  image_url?: string;
  status: 'active' | 'inactive';
  category?: any;
  recipe?: any;
  variants?: MenuItemVariant[];
  location_ids?: number[];
  locations?: BranchStatus[];
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MenuItemService {
  constructor(private api: ApiService) {}

  getMenuItems(params?: any): Observable<any> {
    return this.api.get<any>('/inventory/menu-items', params);
  }

  getAvailableMenuItems(locationId?: number): Observable<MenuItem[]> {
    const params = locationId ? { location_id: locationId } : {};
    return this.api.get<MenuItem[]>('/inventory/menu-items/available', params);
  }

  getMenuItem(id: number): Observable<MenuItem> {
    return this.api.get<MenuItem>(`/inventory/menu-items/${id}`);
  }

  createMenuItem(menuItem: Partial<MenuItem>, imageFile?: File): Observable<any> {
    if (imageFile) {
      const formData = this.buildMenuItemFormData(menuItem, imageFile);
      return this.api.post<any>('/inventory/menu-items', formData);
    }
    return this.api.post<MenuItem>('/inventory/menu-items', menuItem);
  }

  updateMenuItem(id: number, menuItem: Partial<MenuItem>, imageFile?: File, removeImage?: boolean): Observable<any> {
    if (imageFile) {
      const formData = this.buildMenuItemFormData(menuItem, imageFile);
      formData.append('_method', 'PUT'); // Laravel method spoofing – PHP doesn't parse files on PUT
      return this.api.post<any>(`/inventory/menu-items/${id}`, formData);
    }
    const payload = { ...menuItem } as any;
    if (removeImage) {
      payload.remove_image = true;
    }
    return this.api.put<MenuItem>(`/inventory/menu-items/${id}`, payload);
  }

  private buildMenuItemFormData(menuItem: Partial<MenuItem>, imageFile: File): FormData {
    const formData = new FormData();
    const keys = ['name', 'sku', 'barcode', 'category_id', 'selling_price', 'tax_rate', 'description', 'status'];
    keys.forEach(key => {
      const val = (menuItem as any)[key];
      if (val !== null && val !== undefined && val !== '') {
        formData.append(key, val.toString());
      }
    });
    if (menuItem.location_ids && menuItem.location_ids.length > 0) {
      formData.append('location_ids', JSON.stringify(menuItem.location_ids));
    }
    if (menuItem.variants && menuItem.variants.length > 0) {
      formData.append('variants', JSON.stringify(menuItem.variants));
    }
    formData.append('image', imageFile, imageFile.name);
    return formData;
  }

  deleteMenuItem(id: number): Observable<void> {
    return this.api.delete<void>(`/inventory/menu-items/${id}`);
  }

  searchMenuItems(query: string, categoryId?: number): Observable<MenuItem[]> {
    const params: any = { search: query };
    if (categoryId) params.category_id = categoryId;
    return this.api.get<MenuItem[]>('/inventory/menu-items/search', params);
  }

  getMenuItemByBarcode(barcode: string): Observable<MenuItem> {
    return this.api.get<MenuItem>(`/inventory/menu-items/barcode/${barcode}`);
  }

  calculateCost(id: number): Observable<any> {
    return this.api.get<any>(`/inventory/menu-items/${id}/cost`);
  }

  getVariants(menuItemId: number): Observable<MenuItemVariant[]> {
    return this.api.get<MenuItemVariant[]>(`/inventory/menu-items/${menuItemId}/variants`);
  }

  toggleBranchStatus(menuItemId: number, locationId: number, isActive: boolean): Observable<MenuItem> {
    return this.api.post<MenuItem>(`/inventory/menu-items/${menuItemId}/toggle-branch-status`, {
      location_id: locationId,
      is_active: isActive
    });
  }
}



