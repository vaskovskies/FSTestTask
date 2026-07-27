import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Polygon } from '../../models/polygon';
import * as PolygonsActions from './polygons.actions';

export const polygonsFeatureKey = 'polygons';

export interface State extends EntityState<Polygon> {
  loaded: boolean;
  error: string | null;
  selectedImageId: number | null;
}

export const adapter: EntityAdapter<Polygon> = createEntityAdapter<Polygon>({
  selectId: (polygon: Polygon) => polygon.id
});

export const initialState: State = adapter.getInitialState({
  loaded: false,
  error: null,
  selectedImageId: null
});

export const polygonsReducer = createReducer(
  initialState,
  on(PolygonsActions.loadPolygons, (state) => ({
    ...state,
    loaded: false,
    error: null
  })),
  on(PolygonsActions.loadPolygonsSuccess, (state, { polygons }) =>
    adapter.setAll(polygons, { ...state, loaded: true, error: null })
  ),
  on(PolygonsActions.loadPolygonsFailure, (state, { error }) => ({
    ...state,
    loaded: false,
    error
  })),
  on(PolygonsActions.addPolygon, (state, { polygon }) =>
    adapter.addOne(polygon, state)
  ),
  on(PolygonsActions.upsertPolygon, (state, { polygon }) =>
    adapter.upsertOne(polygon, state)
  ),
  on(PolygonsActions.updatePolygon, (state, { polygon }) =>
    adapter.updateOne({ id: polygon.id, changes: polygon }, state)
  ),
  on(PolygonsActions.deletePolygon, (state, { id }) =>
    adapter.removeOne(id, state)
  ),
  on(PolygonsActions.clearPolygons, (state) => adapter.removeAll(state)),
  on(PolygonsActions.loadPolygonsByImageId, (state, { imageId }) => ({
    ...state,
    selectedImageId: imageId
  }))
);

export const { selectIds, selectEntities, selectAll, selectTotal } = adapter.getSelectors();
