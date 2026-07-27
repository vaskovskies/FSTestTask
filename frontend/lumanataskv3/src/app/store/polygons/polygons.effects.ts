import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import * as PolygonsActions from './polygons.actions';
import { Polygon } from '../../models/polygon';

export const loadPolygons$ = createEffect(
  (actions$ = inject(Actions)) => {
    return actions$.pipe(
      ofType(PolygonsActions.loadPolygons),
      switchMap(() => {
        const storedPolygons = localStorage.getItem('polygons');
        const polygons: Polygon[] = storedPolygons ? JSON.parse(storedPolygons) : [];
        return of(PolygonsActions.loadPolygonsSuccess({ polygons }));
      }),
      catchError((error) => of(PolygonsActions.loadPolygonsFailure({ error: error.message })))
    );
  },
  { functional: true }
);

export const addPolygon$ = createEffect(
  (actions$ = inject(Actions)) => {
    return actions$.pipe(
      ofType(PolygonsActions.addPolygon, PolygonsActions.upsertPolygon, PolygonsActions.updatePolygon),
      tap(({ polygon }) => {
        const storedPolygons = localStorage.getItem('polygons');
        const polygons: Polygon[] = storedPolygons ? JSON.parse(storedPolygons) : [];
        const existingIndex = polygons.findIndex((p) => p.id === polygon.id);
        if (existingIndex >= 0) {
          polygons[existingIndex] = polygon;
        } else {
          polygons.push(polygon);
        }
        localStorage.setItem('polygons', JSON.stringify(polygons));
      })
    );
  },
  { functional: true, dispatch: false }
);

export const deletePolygon$ = createEffect(
  (actions$ = inject(Actions)) => {
    return actions$.pipe(
      ofType(PolygonsActions.deletePolygon),
      tap(({ id }) => {
        const storedPolygons = localStorage.getItem('polygons');
        const polygons: Polygon[] = storedPolygons ? JSON.parse(storedPolygons) : [];
        const filteredPolygons = polygons.filter((p) => p.id !== id);
        localStorage.setItem('polygons', JSON.stringify(filteredPolygons));
      })
    );
  },
  { functional: true, dispatch: false }
);

export const clearPolygons$ = createEffect(
  (actions$ = inject(Actions)) => {
    return actions$.pipe(
      ofType(PolygonsActions.clearPolygons),
      tap(() => {
        localStorage.removeItem('polygons');
      })
    );
  },
  { functional: true, dispatch: false }
);
