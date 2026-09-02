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

  /** Action verb for the title and confirm button. Defaults to "Delete"; the mystery wizard passes
   * "Remove" because dropping a draft card from the roster is not a deletion at confirm time. */
  @Input() verb: string = 'Delete';

  /** Permanence warning shown beneath the item list. Pass '' to hide it when nothing is destroyed. */
  @Input() permanenceNote: string = 'This cannot be undone.';
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
