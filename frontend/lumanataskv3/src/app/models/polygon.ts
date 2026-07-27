export interface Point {
  x: number;
  y: number;
}

export interface Polygon {
  id: string;
  imageId: number;
  points: Point[];
  rotation: number;
  center: Point;
}
