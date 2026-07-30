import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VirtualScrollerComponent } from './virtual-scroller';

describe('VirtualScrollerComponent', () => {
  let component: VirtualScrollerComponent;
  let fixture: ComponentFixture<VirtualScrollerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VirtualScrollerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VirtualScrollerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
