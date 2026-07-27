import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SearchResult {
  id: number;
  title: string;
  description: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  brand: string;
  category: string;
  thumbnail: string;
  images: string[];
}

export interface SearchResponse {
  products: SearchResult[];
  total: number;
  skip: number;
  limit: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.dummyJsonBaseUrl;

  search(query: string, skip: number = 0, limit: number = 20): Observable<SearchResponse> {
    return this.http.get<SearchResponse>(`${this.baseUrl}/products/search`, {
      params: {
        q: query,
        skip: skip.toString(),
        limit: limit.toString()
      }
    });
  }
}
