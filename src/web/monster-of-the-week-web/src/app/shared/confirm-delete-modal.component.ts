import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-delete-modal',
  imports: [],
  templateUrl: './confirm-delete-modal.component.html',
})
export class ConfirmDeleteModalComponent {
  @Input() itemName: string = '';
  @Input() visible: boolean = false;
  @Input() message: string = 'This cannot be undone.';
  @Input() items: string[] = [];
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onBackdropClick(): void {
    this.cancelled.emit();
  }

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
