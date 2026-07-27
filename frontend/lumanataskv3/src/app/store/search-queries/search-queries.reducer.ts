import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { SearchQuery } from '../../models/search-query';
import * as SearchQueriesActions from './search-queries.actions';

export const searchQueriesFeatureKey = 'searchQueries';

export interface State extends EntityState<SearchQuery> {
  loaded: boolean;
  error: string | null;
}

export const adapter: EntityAdapter<SearchQuery> = createEntityAdapter<SearchQuery>({
  selectId: (query: SearchQuery) => query.id,
  sortComparer: (a: SearchQuery, b: SearchQuery) => b.timestamp - a.timestamp
});

export const initialState: State = adapter.getInitialState({
  loaded: false,
  error: null
});

export const searchQueriesReducer = createReducer(
  initialState,
  on(SearchQueriesActions.loadSearchQueries, (state) => ({
    ...state,
    loaded: false,
    error: null
  })),
  on(SearchQueriesActions.loadSearchQueriesSuccess, (state, { queries }) =>
    adapter.setAll(queries, { ...state, loaded: true, error: null })
  ),
  on(SearchQueriesActions.loadSearchQueriesFailure, (state, { error }) => ({
    ...state,
    loaded: false,
    error
  })),
  on(SearchQueriesActions.addSearchQuery, (state, { query }) =>
    adapter.addOne(query, state)
  ),
  on(SearchQueriesActions.upsertSearchQuery, (state, { query }) =>
    adapter.upsertOne(query, state)
  ),
  on(SearchQueriesActions.deleteSearchQuery, (state, { id }) =>
    adapter.removeOne(id, state)
  ),
  on(SearchQueriesActions.clearSearchQueries, (state) =>
    adapter.removeAll(state)
  )
);

export const { selectIds, selectEntities, selectAll, selectTotal } = adapter.getSelectors();
