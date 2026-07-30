import { Point } from '../../utils/geometry';
import { Polygon } from '../../models/polygon';

export const DEFAULT_ROTATION_STEP = 15;

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D | null = null;

  init(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
  }

  resize(canvas: HTMLCanvasElement, image: HTMLImageElement): number {
    const container = canvas.parentElement;
    if (!container) return 1;

    const containerWidth = container.clientWidth - 32;
    const containerHeight = Math.min(600, window.innerHeight - 200);

    const imageAspect = image.width / image.height;
    const containerAspect = containerWidth / containerHeight;

    let canvasWidth: number;
    let canvasHeight: number;

    if (imageAspect > containerAspect) {
      canvasWidth = containerWidth;
      canvasHeight = containerWidth / imageAspect;
    } else {
      canvasHeight = containerHeight;
      canvasWidth = containerHeight * imageAspect;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    return canvasWidth / image.width;
  }

  render(
    image: HTMLImageElement,
    canvas: HTMLCanvasElement,
    polygons: Polygon[],
    currentPolygon: Point[],
    selectedPolygon: string | null,
    scale: number,
  ) {
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const polygon of polygons) {
      this.drawPolygon(polygon, scale, polygon.id === selectedPolygon);
    }

    if (currentPolygon.length > 0) {
      this.drawCurrentPolygon(currentPolygon, scale);
    }
  }

  private drawPolygon(polygon: Polygon, scale: number, isSelected: boolean) {
    if (!this.ctx) return;

    const points = polygon.points.map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }));

    this.ctx.save();

    if (polygon.rotation !== 0) {
      const center = {
        x: polygon.center.x * scale,
        y: polygon.center.y * scale
      };
      this.rotateContext(center, polygon.rotation);
    }

    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }

    this.ctx.closePath();

    this.ctx.fillStyle = isSelected ? 'rgba(25, 118, 210, 0.3)' : 'rgba(76, 175, 80, 0.3)';
    this.ctx.fill();

    this.ctx.strokeStyle = isSelected ? '#1976d2' : '#4caf50';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    for (const point of points) {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = isSelected ? '#1976d2' : '#4caf50';
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  private drawCurrentPolygon(points: Point[], scale: number) {
    if (!this.ctx) return;

    const scaled = points.map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }));

    this.ctx.beginPath();
    this.ctx.moveTo(scaled[0].x, scaled[0].y);

    for (let i = 1; i < scaled.length; i++) {
      this.ctx.lineTo(scaled[i].x, scaled[i].y);
    }

    this.ctx.strokeStyle = '#ff5722';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    for (const point of scaled) {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ff5722';
      this.ctx.fill();
    }
  }

  private rotateContext(center: Point, angle: number) {
    if (!this.ctx) return;
    this.ctx.translate(center.x, center.y);
    this.ctx.rotate(angle * Math.PI / 180);
    this.ctx.translate(-center.x, -center.y);
  }
}
