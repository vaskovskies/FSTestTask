import { createFeatureSelector, createSelector } from '@ngrx/store';
import { SearchQuery } from '../../models/search-query';
import * as fromSearchQueries from './search-queries.reducer';

export const selectSearchQueriesState = createFeatureSelector<fromSearchQueries.State>(
  fromSearchQueries.searchQueriesFeatureKey
);

export const selectSearchQueriesLoaded = createSelector(
  selectSearchQueriesState,
  (state) => state.loaded
);

export const selectSearchQueriesError = createSelector(
  selectSearchQueriesState,
  (state) => state.error
);

export const selectAllSearchQueries = createSelector(
  selectSearchQueriesState,
  fromSearchQueries.selectAll
);

export const selectSearchQueryEntities = createSelector(
  selectSearchQueriesState,
  fromSearchQueries.selectEntities
);

export const selectSearchQueriesTotal = createSelector(
  selectSearchQueriesState,
  fromSearchQueries.selectTotal
);

export const selectRecentSearchQueries = createSelector(
  selectAllSearchQueries,
  (queries) => queries.slice(0, 10)
);

export const selectSearchQueryById = (id: string) =>
  createSelector(selectSearchQueryEntities, (entities) => entities[id]);
