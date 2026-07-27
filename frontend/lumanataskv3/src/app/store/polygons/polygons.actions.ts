import { createAction, props } from '@ngrx/store';
import { Polygon } from '../../models/polygon';

export const loadPolygons = createAction('[Polygons] Load Polygons');
export const loadPolygonsSuccess = createAction(
  '[Polygons] Load Polygons Success',
  props<{ polygons: Polygon[] }>()
);
export const loadPolygonsFailure = createAction(
  '[Polygons] Load Polygons Failure',
  props<{ error: string }>()
);

export const addPolygon = createAction(
  '[Polygons] Add Polygon',
  props<{ polygon: Polygon }>()
);

export const upsertPolygon = createAction(
  '[Polygons] Upsert Polygon',
  props<{ polygon: Polygon }>()
);

export const updatePolygon = createAction(
  '[Polygons] Update Polygon',
  props<{ polygon: Polygon }>()
);

export const deletePolygon = createAction(
  '[Polygons] Delete Polygon',
  props<{ id: string }>()
);

export const clearPolygons = createAction('[Polygons] Clear Polygons');

export const loadPolygonsByImageId = createAction(
  '[Polygons] Load Polygons By Image Id',
  props<{ imageId: number }>()
);
