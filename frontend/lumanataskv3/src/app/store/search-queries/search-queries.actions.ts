import { createAction, props } from '@ngrx/store';
import { SearchQuery } from '../../models/search-query';

export const loadSearchQueries = createAction('[Search Queries] Load Search Queries');
export const loadSearchQueriesSuccess = createAction(
  '[Search Queries] Load Search Queries Success',
  props<{ queries: SearchQuery[] }>()
);
export const loadSearchQueriesFailure = createAction(
  '[Search Queries] Load Search Queries Failure',
  props<{ error: string }>()
);

export const addSearchQuery = createAction(
  '[Search Queries] Add Search Query',
  props<{ query: SearchQuery }>()
);

export const upsertSearchQuery = createAction(
  '[Search Queries] Upsert Search Query',
  props<{ query: SearchQuery }>()
);

export const deleteSearchQuery = createAction(
  '[Search Queries] Delete Search Query',
  props<{ id: string }>()
);

export const clearSearchQueries = createAction('[Search Queries] Clear Search Queries');
