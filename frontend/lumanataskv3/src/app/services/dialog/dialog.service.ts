import { Injectable, ComponentRef, Type } from '@angular/core';
import { SearchResult } from '../api/api';

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private dialogContainer: HTMLElement | null = null;
  private currentDialog: ComponentRef<any> | null = null;

  open<T>(component: Type<T>, data?: any): ComponentRef<T> {
    // Create dialog container if it doesn't exist
    if (!this.dialogContainer) {
      this.dialogContainer = document.createElement('div');
      this.dialogContainer.className = 'dialog-overlay';
      document.body.appendChild(this.dialogContainer);
    }

    // Show container
    this.dialogContainer.style.display = 'flex';

    // For now, we'll use a simple approach with the image dialog
    // In a real implementation, you'd use Angular's ComponentFactoryResolver
    // or create a proper portal system
    throw new Error('DialogService.open() not fully implemented. Use ImageDialogComponent directly.');
  }

  close(): void {
    if (this.dialogContainer) {
      this.dialogContainer.style.display = 'none';
    }
    this.currentDialog = null;
  }
}
