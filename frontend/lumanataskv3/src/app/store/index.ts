import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { searchQueriesReducer, searchQueriesFeatureKey } from './search-queries/search-queries.reducer';
import { polygonsReducer, polygonsFeatureKey } from './polygons/polygons.reducer';
import { loadSearchQueries$, addSearchQuery$, deleteSearchQuery$, clearSearchQueries$ } from './search-queries/search-queries.effects';
import { loadPolygons$, addPolygon$, deletePolygon$, clearPolygons$ } from './polygons/polygons.effects';

export const storeProviders = [
  provideStore({
    [searchQueriesFeatureKey]: searchQueriesReducer,
    [polygonsFeatureKey]: polygonsReducer
  }),
  provideEffects({ // <-- Changed from '[' to '{'
    loadSearchQueries$,
    addSearchQuery$,
    deleteSearchQuery$,
    clearSearchQueries$,
    loadPolygons$,
    addPolygon$,
    deletePolygon$,
    clearPolygons$
  }) // <-- Changed from ']' to '}'
];
