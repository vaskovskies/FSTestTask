import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { debounceTime, distinctUntilChanged, switchMap, tap, of, catchError, take } from 'rxjs';
import { ApiService, SearchResult } from '../../services/api/api';
import { loadSearchQueries, addSearchQuery } from '../../store/search-queries/search-queries.actions';
import { selectRecentSearchQueries } from '../../store/search-queries/search-queries.selectors';
import { SearchQuery } from '../../models/search-query';
import { ImageDialogComponent } from '../image-dialog/image-dialog';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageDialogComponent],
  templateUrl: './search.html',
  styleUrl: './search.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchComponent implements OnInit {
  private store = inject(Store);
  private apiService = inject(ApiService);

  searchControl = new FormControl('', [Validators.minLength(2)]);
  
  searchResults = signal<SearchResult[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  showSuggestions = signal(false);
  currentQuery = signal<string>('');
  currentSkip = signal<number>(0);
  totalResults = signal<number>(0);
  hasMore = signal(true);
  
  recentQueries = this.store.selectSignal(selectRecentSearchQueries);
  filteredSuggestions = signal<string[]>([]);
  
  resultSelected = output<SearchResult>();
  selectedResult = signal<SearchResult | null>(null);
  showDialog = signal(false);

  private searchCache = new Map<string, { results: SearchResult[]; total: number }>();
  private currentSearch$ = of<SearchResult[]>([]);

  ngOnInit() {
    this.store.dispatch(loadSearchQueries());

    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap((query) => {
        this.showSuggestions.set(!!query && query.length >= 2);
        this.updateSuggestions(query || '');
        
        // Reset pagination when query changes
        if (query !== this.currentQuery()) {
          this.currentQuery.set(query || '');
          this.currentSkip.set(0);
          this.searchResults.set([]);
          this.totalResults.set(0);
          this.hasMore.set(true);
        }
      }),
      switchMap((query) => {
        if (!query || query.length < 2) {
          this.searchResults.set([]);
          return of([]);
        }

        this.loading.set(true);
        this.error.set(null);

        const skip = this.currentSkip();
        const queryLower = query.toLowerCase();

        // Check cache first
        const cached = this.searchCache.get(queryLower);
        if (cached && skip === 0) {
          this.loading.set(false);
          this.searchResults.set(cached.results);
          this.totalResults.set(cached.total);
          this.hasMore.set(cached.results.length < cached.total);
          return of(cached.results);
        }

        return this.apiService.search(query, skip, 20).pipe(
          tap((response) => {
            if (skip === 0) {
              this.searchCache.set(queryLower, { results: response.products, total: response.total });
              this.searchResults.set(response.products);
            } else {
              this.searchResults.update(results => [...results, ...response.products]);
            }
            
            this.totalResults.set(response.total);
            this.hasMore.set(this.searchResults().length < response.total);
            this.loading.set(false);
            
            // Save meaningful queries to store
            if (response.products.length > 0 && skip === 0) {
              const searchQuery: SearchQuery = {
                id: `${query}-${Date.now()}`,
                query,
                timestamp: Date.now(),
                resultCount: response.total
              };
              this.store.dispatch(addSearchQuery({ query: searchQuery }));
            }
          }),
          catchError((err) => {
            this.error.set('Failed to search. Please try again.');
            this.loading.set(false);
            return of([]);
          })
        );
      })
    ).subscribe();
  }

  loadMore() {
    if (!this.loading() && this.hasMore() && this.currentQuery()) {
      this.currentSkip.update(skip => skip + 20);
      this.loading.set(true);
      
      this.apiService.search(this.currentQuery(), this.currentSkip(), 20).pipe(
        tap((response) => {
          this.searchResults.update(results => [...results, ...response.products]);
          this.hasMore.set(this.searchResults().length < this.totalResults());
          this.loading.set(false);
        }),
        catchError((err) => {
          this.error.set('Failed to load more results. Please try again.');
          this.loading.set(false);
          return of([]);
        })
      ).subscribe();
    }
  }

  private updateSuggestions(query: string) {
    const recent = this.recentQueries();
    const queryLower = query.toLowerCase();
    
    if (!query) {
      this.filteredSuggestions.set(recent.map(q => q.query));
      return;
    }

    // Word breakdown optimization - match partial words
    const words = queryLower.split(' ');
    const suggestions = recent
      .map(q => q.query)
      .filter(q => {
        const qLower = q.toLowerCase();
        return words.some(word => qLower.includes(word)) || qLower.includes(queryLower);
      })
      .slice(0, 5);

    this.filteredSuggestions.set(suggestions);
  }

  selectSuggestion(suggestion: string) {
    this.searchControl.setValue(suggestion);
    this.showSuggestions.set(false);
  }

  selectResult(result: SearchResult) {
    this.resultSelected.emit(result);
    this.selectedResult.set(result);
    this.showDialog.set(true);
  }

  closeDialog() {
    this.showDialog.set(false);
    this.selectedResult.set(null);
  }

  clearSearch() {
    this.searchControl.setValue('');
    this.searchResults.set([]);
    this.showSuggestions.set(false);
  }
}
