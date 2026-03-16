import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MenuCardVariant {
  id: number;
  name: string;
  price: number;
  is_default: boolean;
}

export interface MenuCardItem {
  id: number;
  name: string;
  description?: string;
  selling_price: number;
  display_price: number;
  image_url: string | null;
  variants: MenuCardVariant[];
  rating?: number;
  chef_recommended?: boolean;
  vegetarian?: boolean;
  spicy?: boolean;
  popular?: boolean;
}

export interface MenuCardCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  items: MenuCardItem[];
}

export interface MenuCardLocation {
  id: number;
  name: string;
  code: string;
}

export interface MenuCardData {
  location: MenuCardLocation;
  categories: MenuCardCategory[];
}

@Injectable({
  providedIn: 'root'
})
export class MenuCardService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getMenuCard(locationId: number): Observable<MenuCardData> {
    const params = new HttpParams().set('location_id', locationId.toString());
    return this.http.get<MenuCardData>(`${this.apiUrl}/menu-card`, { params });
  }

  getBranches(): Observable<MenuCardLocation[]> {
    return this.http.get<MenuCardLocation[]>(`${this.apiUrl}/menu-card/branches`);
  }
}
