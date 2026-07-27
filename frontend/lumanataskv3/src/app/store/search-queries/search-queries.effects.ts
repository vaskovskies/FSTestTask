import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import * as SearchQueriesActions from './search-queries.actions';
import { SearchQuery } from '../../models/search-query';

export const loadSearchQueries$ = createEffect(
  (actions$ = inject(Actions)) => {
    return actions$.pipe(
      ofType(SearchQueriesActions.loadSearchQueries),
      switchMap(() => {
        const storedQueries = localStorage.getItem('searchQueries');
        const queries: SearchQuery[] = storedQueries ? JSON.parse(storedQueries) : [];
        return of(SearchQueriesActions.loadSearchQueriesSuccess({ queries }));
      }),
      catchError((error) => of(SearchQueriesActions.loadSearchQueriesFailure({ error: error.message })))
    );
  },
  { functional: true }
);

export const addSearchQuery$ = createEffect(
  (actions$ = inject(Actions)) => {
    return actions$.pipe(
      ofType(SearchQueriesActions.addSearchQuery, SearchQueriesActions.upsertSearchQuery),
      tap(({ query }) => {
        const storedQueries = localStorage.getItem('searchQueries');
        const queries: SearchQuery[] = storedQueries ? JSON.parse(storedQueries) : [];
        const existingIndex = queries.findIndex((q) => q.id === query.id);
        if (existingIndex >= 0) {
          queries[existingIndex] = query;
        } else {
          queries.push(query);
        }
        localStorage.setItem('searchQueries', JSON.stringify(queries));
      })
    );
  },
  { functional: true, dispatch: false }
);

export const deleteSearchQuery$ = createEffect(
  (actions$ = inject(Actions)) => {
    return actions$.pipe(
      ofType(SearchQueriesActions.deleteSearchQuery),
      tap(({ id }) => {
        const storedQueries = localStorage.getItem('searchQueries');
        const queries: SearchQuery[] = storedQueries ? JSON.parse(storedQueries) : [];
        const filteredQueries = queries.filter((q) => q.id !== id);
        localStorage.setItem('searchQueries', JSON.stringify(filteredQueries));
      })
    );
  },
  { functional: true, dispatch: false }
);

export const clearSearchQueries$ = createEffect(
  (actions$ = inject(Actions)) => {
    return actions$.pipe(
      ofType(SearchQueriesActions.clearSearchQueries),
      tap(() => {
        localStorage.removeItem('searchQueries');
      })
    );
  },
  { functional: true, dispatch: false }
);
