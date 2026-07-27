import { Component, inject, input, output, signal, ViewChild, ElementRef, AfterViewInit, afterNextRender, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchResult } from '../../services/api/api';
import { Store } from '@ngrx/store';
import { loadPolygonsByImageId, addPolygon, updatePolygon } from '../../store/polygons/polygons.actions';
import { selectPolygonsByImageId } from '../../store/polygons/polygons.selectors';
import { Polygon, Point } from '../../models/polygon';

@Component({
  selector: 'app-image-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-dialog.html',
  styleUrl: './image-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dialog-overlay'
  }
})
export class ImageDialogComponent implements AfterViewInit {
  close = output<void>();
  private store = inject(Store);
  
  result = input<SearchResult>();
  
  @ViewChild('canvas')
  canvas!: ElementRef<HTMLCanvasElement>;
  
  private ctx!: CanvasRenderingContext2D;
  private image = new Image();
  private isDrawing = signal(false);
  private currentPolygon = signal<Point[]>([]);
  private polygons = signal<Polygon[]>([]);
  selectedPolygon = signal<string | null>(null);
  private isDragging = signal(false);
  private dragOffset = signal<Point>({ x: 0, y: 0 });
  private canvasScale = signal(1);
  private originalImageSize = signal<{ width: number; height: number }>({ width: 0, height: 0 });

  imageLoaded = signal(false);
  isDrawMode = signal(true);
  rotation = signal(0);

  ngAfterViewInit() {
    this.store.dispatch(loadPolygonsByImageId({ imageId: this.result()!.id }));
    this.store.selectSignal(selectPolygonsByImageId);
    
    this.loadImage();
  }

  private loadImage() {
    const imageUrl = this.result()!.images[0] || this.result()!.thumbnail;
    this.image.crossOrigin = 'anonymous';
    this.image.onload = () => {
      this.originalImageSize.set({ width: this.image.width, height: this.image.height });
      this.imageLoaded.set(true);
      afterNextRender(() => this.resizeCanvas());
      this.loadPolygons();
    };
    this.image.src = imageUrl;
  }

  private loadPolygons() {
    // Load polygons from store for this image
    const storedPolygons = localStorage.getItem('polygons');
    if (storedPolygons) {
      const allPolygons: Polygon[] = JSON.parse(storedPolygons);
      const imagePolygons = allPolygons.filter(p => p.imageId === this.result()!.id);
      this.polygons.set(imagePolygons);
    }
  }

  private resizeCanvas() {
    const container = this.canvas.nativeElement.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth - 32; // padding
    const containerHeight = Math.min(600, window.innerHeight - 200);
    
    const imageAspect = this.image.width / this.image.height;
    const containerAspect = containerWidth / containerHeight;
    
    let canvasWidth, canvasHeight;
    
    if (imageAspect > containerAspect) {
      canvasWidth = containerWidth;
      canvasHeight = containerWidth / imageAspect;
    } else {
      canvasHeight = containerHeight;
      canvasWidth = containerHeight * imageAspect;
    }
    
    this.canvas.nativeElement.width = canvasWidth;
    this.canvas.nativeElement.height = canvasHeight;
    this.canvasScale.set(canvasWidth / this.image.width);
    
    this.ctx = this.canvas.nativeElement.getContext('2d')!;
    this.render();
  }

  @HostListener('window:resize')
  onResize() {
    if (this.imageLoaded()) {
      this.resizeCanvas();
    }
  }

  private render() {
    if (!this.ctx || !this.imageLoaded()) return;

    const canvas = this.canvas.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw image
    this.ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    
    // Draw all polygons
    this.polygons().forEach(polygon => {
      this.drawPolygon(polygon, polygon.id === this.selectedPolygon());
    });
    
    // Draw current polygon being drawn
    if (this.currentPolygon().length > 0) {
      this.drawCurrentPolygon();
    }
  }

  private drawPolygon(polygon: Polygon, isSelected: boolean) {
    const scale = this.canvasScale();
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

    points.forEach(point => {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = isSelected ? '#1976d2' : '#4caf50';
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  private drawCurrentPolygon() {
    const scale = this.canvasScale();
    const points = this.currentPolygon().map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }));
    
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    
    this.ctx.strokeStyle = '#ff5722';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // Draw vertices
    points.forEach(point => {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ff5722';
      this.ctx.fill();
    });
  }

  private rotateContext(center: Point, angle: number) {
    this.ctx.translate(center.x, center.y);
    this.ctx.rotate(angle * Math.PI / 180);
    this.ctx.translate(-center.x, -center.y);
  }

  onCanvasClick(event: MouseEvent) {
    if (!this.isDrawMode() || !this.imageLoaded()) return;

    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / this.canvasScale();
    const y = (event.clientY - rect.top) / this.canvasScale();
    
    this.currentPolygon.update(points => [...points, { x, y }]);
    this.render();
  }

  onCanvasDoubleClick(event: MouseEvent) {
    if (!this.isDrawMode() || this.currentPolygon().length < 3) return;

    // Complete polygon
    const points = this.currentPolygon();
    const center = this.calculateCenter(points);
    
    const polygon: Polygon = {
      id: `polygon-${Date.now()}`,
      imageId: this.result()!.id,
      points,
      rotation: 0,
      center
    };
    
    this.polygons.update(polygons => [...polygons, polygon]);
    this.currentPolygon.set([]);
    this.savePolygon(polygon);
    this.render();
  }

  private calculateCenter(points: Point[]): Point {
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return { x, y };
  }

  private savePolygon(polygon: Polygon) {
    const storedPolygons = localStorage.getItem('polygons');
    const polygons: Polygon[] = storedPolygons ? JSON.parse(storedPolygons) : [];
    polygons.push(polygon);
    localStorage.setItem('polygons', JSON.stringify(polygons));
  }

  onCanvasMouseDown(event: MouseEvent) {
    if (this.isDrawMode() || !this.imageLoaded()) return;

    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / this.canvasScale();
    const y = (event.clientY - rect.top) / this.canvasScale();
    
    // Check if clicking on a polygon
    for (const polygon of this.polygons()) {
      if (this.isPointInPolygon({ x, y }, polygon.points)) {
        this.selectedPolygon.set(polygon.id);
        this.isDragging.set(true);
        this.dragOffset.set({ x, y });
        this.render();
        return;
      }
    }
    
    this.selectedPolygon.set(null);
    this.render();
  }

  onCanvasMouseMove(event: MouseEvent) {
    if (!this.isDragging() || !this.selectedPolygon()) return;

    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / this.canvasScale();
    const y = (event.clientY - rect.top) / this.canvasScale();
    
    const dx = x - this.dragOffset().x;
    const dy = y - this.dragOffset().y;
    
    this.dragOffset.set({ x, y });
    
    // Update polygon position
    const polygonId = this.selectedPolygon()!;
    this.polygons.update(polygons => 
      polygons.map(p => {
        if (p.id === polygonId) {
          return {
            ...p,
            points: p.points.map(point => ({ x: point.x + dx, y: point.y + dy })),
            center: { x: p.center.x + dx, y: p.center.y + dy }
          };
        }
        return p;
      })
    );
    
    this.render();
  }

  onCanvasMouseUp() {
    if (this.isDragging()) {
      this.isDragging.set(false);
      // Save updated polygon
      const polygon = this.polygons().find(p => p.id === this.selectedPolygon());
      if (polygon) {
        this.updatePolygonInStorage(polygon);
      }
    }
  }

  private isPointInPolygon(point: Point, polygonPoints: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
      const xi = polygonPoints[i].x, yi = polygonPoints[i].y;
      const xj = polygonPoints[j].x, yj = polygonPoints[j].y;
      
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private updatePolygonInStorage(polygon: Polygon) {
    const storedPolygons = localStorage.getItem('polygons');
    const polygons: Polygon[] = storedPolygons ? JSON.parse(storedPolygons) : [];
    const index = polygons.findIndex(p => p.id === polygon.id);
    if (index >= 0) {
      polygons[index] = polygon;
      localStorage.setItem('polygons', JSON.stringify(polygons));
    }
  }

  rotateSelectedPolygon() {
    const polygonId = this.selectedPolygon();
    if (!polygonId) return;

    this.polygons.update(polygons => 
      polygons.map(p => {
        if (p.id === polygonId) {
          return {
            ...p,
            rotation: (p.rotation + 15) % 360
          };
        }
        return p;
      })
    );
    
    this.render();
    
    // Save updated polygon
    const polygon = this.polygons().find(p => p.id === polygonId);
    if (polygon) {
      this.updatePolygonInStorage(polygon);
    }
  }

  deleteSelectedPolygon() {
    const polygonId = this.selectedPolygon();
    if (!polygonId) return;

    this.polygons.update(polygons => polygons.filter(p => p.id !== polygonId));
    this.selectedPolygon.set(null);
    this.render();
    
    // Remove from storage
    const storedPolygons = localStorage.getItem('polygons');
    const polygons: Polygon[] = storedPolygons ? JSON.parse(storedPolygons) : [];
    const filtered = polygons.filter(p => p.id !== polygonId);
    localStorage.setItem('polygons', JSON.stringify(filtered));
  }

  toggleDrawMode() {
    this.isDrawMode.update(mode => !mode);
    this.selectedPolygon.set(null);
    this.currentPolygon.set([]);
    this.render();
  }

  closeDialog() {
    this.close.emit();
  }
}
