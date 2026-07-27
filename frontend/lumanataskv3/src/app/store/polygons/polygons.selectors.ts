import { createFeatureSelector, createSelector } from '@ngrx/store';
import { Polygon } from '../../models/polygon';
import * as fromPolygons from './polygons.reducer';

export const selectPolygonsState = createFeatureSelector<fromPolygons.State>(
  fromPolygons.polygonsFeatureKey
);

export const selectPolygonsLoaded = createSelector(
  selectPolygonsState,
  (state) => state.loaded
);

export const selectPolygonsError = createSelector(
  selectPolygonsState,
  (state) => state.error
);

export const selectAllPolygons = createSelector(
  selectPolygonsState,
  fromPolygons.selectAll
);

export const selectPolygonEntities = createSelector(
  selectPolygonsState,
  fromPolygons.selectEntities
);

export const selectPolygonsTotal = createSelector(
  selectPolygonsState,
  fromPolygons.selectTotal
);

export const selectSelectedImageId = createSelector(
  selectPolygonsState,
  (state) => state.selectedImageId
);

export const selectPolygonsByImageId = createSelector(
  selectAllPolygons,
  selectSelectedImageId,
  (polygons, imageId) => polygons.filter((polygon) => polygon.imageId === imageId)
);

export const selectPolygonById = (id: string) =>
  createSelector(selectPolygonEntities, (entities) => entities[id]);
