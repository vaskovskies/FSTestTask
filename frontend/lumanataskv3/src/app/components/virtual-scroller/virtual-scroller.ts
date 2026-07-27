import { Component, input, output, ViewChild, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { SearchResult } from '../../services/api/api';

@Component({
  selector: 'app-virtual-scroller',
  standalone: true,
  imports: [CommonModule, ScrollingModule],
  templateUrl: './virtual-scroller.html',
  styleUrl: './virtual-scroller.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualScrollerComponent implements AfterViewInit {
  items = input<SearchResult[]>([]);
  itemHeight = input<number>(120);
  batchSize = input<number>(20);
  
  itemSelected = output<SearchResult>();
  loadMore = output<void>();
  
  @ViewChild('viewport', { static: true })
  viewport!: CdkVirtualScrollViewport;

  ngAfterViewInit() {
    this.setupScrollListener();
  }

  private setupScrollListener() {
    if (this.viewport) {
      this.viewport.elementRef.nativeElement.addEventListener('scroll', () => {
        this.checkLoadMore();
      });
    }
  }

  private checkLoadMore() {
    if (!this.viewport) return;
    
    const scrollOffset = this.viewport.measureScrollOffset('bottom');
    
    if (scrollOffset < 200 && this.items().length > 0) {
      this.loadMore.emit();
    }
  }

  trackByFn(index: number, item: SearchResult) {
    return item.id;
  }

  onSelect(item: SearchResult) {
    this.itemSelected.emit(item);
  }
}
