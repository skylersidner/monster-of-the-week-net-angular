import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CustomSelectComponent } from '../../../../../shared/custom-select.component';
import { HunterDraft } from '../../../shared/hunter-draft';
import { HunterCreateStore } from '../hunter-create.store';

/**
 * Step 1, "Who Is Your Hunter?" (hunter-creation-wizard.md 3.3; Phase 7, F5): the playbook picker,
 * name and pronouns, then the chosen playbook's flavour text and Getting Started text for reference.
 * The one step with a gate (L3). Its messages show once Next has been pressed without it.
 */
@Component({
  selector: 'app-hunter-playbook-step',
  imports: [ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './hunter-playbook-step.html',
  host: { class: 'block' },
})
export class HunterPlaybookStepComponent {
  readonly store = inject(HunterCreateStore);
  readonly draft = inject(HunterDraft);

  showPlaybookRequired(): boolean {
    return this.store.gateAttempted() && !this.draft.formValue().playbookId;
  }

  showNameRequired(): boolean {
    return (this.store.gateAttempted() || this.draft.form.controls.name.touched) && !this.draft.formValue().name.trim();
  }
}
