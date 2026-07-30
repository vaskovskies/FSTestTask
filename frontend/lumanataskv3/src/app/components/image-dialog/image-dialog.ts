import { Component, inject, input, output, signal, ViewChild, ElementRef, ChangeDetectionStrategy, afterNextRender, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { SearchResult } from '../../services/api/api';
import { selectAllPolygons } from '../../store/polygons/polygons.selectors';
import { addPolygon, updatePolygon, deletePolygon } from '../../store/polygons/polygons.actions';
import { Polygon } from '../../models/polygon';
import { Point, calculateCenter, isPointInPolygon } from '../../utils/geometry';
import { CanvasRenderer, DEFAULT_ROTATION_STEP } from '../../services/canvas/canvas-renderer.service';

@Component({
  selector: 'app-image-dialog',
  imports: [CommonModule],
  templateUrl: './image-dialog.html',
  styleUrl: './image-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dialog-overlay'
  }
})
export class ImageDialogComponent {
  close = output<void>();
  private store = inject(Store);
  private renderer = new CanvasRenderer();

  result = input<SearchResult>();

  @ViewChild('canvas')
  canvas!: ElementRef<HTMLCanvasElement>;

  private image = new Image();
  private isDrawing = signal(false);
  private currentPolygon = signal<Point[]>([]);
  selectedPolygon = signal<string | null>(null);
  private isDragging = signal(false);
  private dragOffset = signal<Point>({ x: 0, y: 0 });
  private canvasScale = signal(1);
  private originalImageSize = signal<{ width: number; height: number }>({ width: 0, height: 0 });

  protected readonly DEFAULT_ROTATION_STEP = DEFAULT_ROTATION_STEP;

  imageLoaded = signal(false);
  isDrawMode = signal(true);

  private allPolygons = this.store.selectSignal(selectAllPolygons);
  protected polygons = computed(() =>
    this.allPolygons().filter(p => p.imageId === this.result()?.id)
  );

  private resizeSub: Subscription | null = null;

  constructor() {
    afterNextRender(() => {
      this.initCanvas();
    });
  }

  private initCanvas() {
    const canvasEl = this.canvas.nativeElement;
    this.renderer.init(canvasEl);

    const imageUrl = this.result()!.images[0] || this.result()!.thumbnail;
    this.image.crossOrigin = 'anonymous';
    this.image.onload = () => {
      this.originalImageSize.set({ width: this.image.width, height: this.image.height });
      this.imageLoaded.set(true);
      this.doResize();
    };
    this.image.src = imageUrl;

    this.resizeSub = fromEvent(window, 'resize')
      .pipe(debounceTime(150))
      .subscribe(() => {
        if (this.imageLoaded()) {
          this.doResize();
        }
      });
  }

  private doResize() {
    const canvasEl = this.canvas.nativeElement;
    const scale = this.renderer.resize(canvasEl, this.image);
    this.canvasScale.set(scale);
    this.renderScene();
  }

  private renderScene() {
    this.renderer.render(
      this.image,
      this.canvas.nativeElement,
      this.polygons(),
      this.currentPolygon(),
      this.selectedPolygon(),
      this.canvasScale(),
    );
  }

  onCanvasClick(event: MouseEvent) {
    if (!this.isDrawMode() || !this.imageLoaded()) return;

    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / this.canvasScale();
    const y = (event.clientY - rect.top) / this.canvasScale();

    this.currentPolygon.update(points => [...points, { x, y }]);
    this.renderScene();
  }

  onCanvasDoubleClick(event: MouseEvent) {
    if (!this.isDrawMode() || this.currentPolygon().length < 3) return;

    const points = this.currentPolygon();
    const center = calculateCenter(points);

    const polygon: Polygon = {
      id: `polygon-${Date.now()}`,
      imageId: this.result()!.id,
      points,
      rotation: 0,
      center
    };

    this.store.dispatch(addPolygon({ polygon }));
    this.currentPolygon.set([]);
    this.renderScene();
  }

  onCanvasMouseDown(event: MouseEvent) {
    if (this.isDrawMode() || !this.imageLoaded()) return;

    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / this.canvasScale();
    const y = (event.clientY - rect.top) / this.canvasScale();

    for (const polygon of this.polygons()) {
      if (isPointInPolygon({ x, y }, polygon.points)) {
        this.selectedPolygon.set(polygon.id);
        this.isDragging.set(true);
        this.dragOffset.set({ x, y });
        this.renderScene();
        return;
      }
    }

    this.selectedPolygon.set(null);
    this.renderScene();
  }

  onCanvasMouseMove(event: MouseEvent) {
    if (!this.isDragging() || !this.selectedPolygon()) return;

    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / this.canvasScale();
    const y = (event.clientY - rect.top) / this.canvasScale();

    const dx = x - this.dragOffset().x;
    const dy = y - this.dragOffset().y;

    this.dragOffset.set({ x, y });

    const polygonId = this.selectedPolygon()!;
    const currentPolygon = this.polygons().find(p => p.id === polygonId);
    if (currentPolygon) {
      const moved: Polygon = {
        ...currentPolygon,
        points: currentPolygon.points.map(point => ({ x: point.x + dx, y: point.y + dy })),
        center: { x: currentPolygon.center.x + dx, y: currentPolygon.center.y + dy }
      };
      this.store.dispatch(updatePolygon({ polygon: moved }));
    }

    this.renderScene();
  }

  onCanvasMouseUp() {
    this.isDragging.set(false);
  }

  rotateSelectedPolygon() {
    const polygonId = this.selectedPolygon();
    if (!polygonId) return;

    const polygon = this.polygons().find(p => p.id === polygonId);
    if (polygon) {
      const rotated: Polygon = {
        ...polygon,
        rotation: (polygon.rotation + DEFAULT_ROTATION_STEP) % 360
      };
      this.store.dispatch(updatePolygon({ polygon: rotated }));
    }

    this.renderScene();
  }

  deleteSelectedPolygon() {
    const polygonId = this.selectedPolygon();
    if (!polygonId) return;

    this.store.dispatch(deletePolygon({ id: polygonId }));
    this.selectedPolygon.set(null);
    this.renderScene();
  }

  toggleDrawMode() {
    this.isDrawMode.update(mode => !mode);
    this.selectedPolygon.set(null);
    this.currentPolygon.set([]);
    this.renderScene();
  }

  closeDialog() {
    this.resizeSub?.unsubscribe();
    this.close.emit();
  }
}
