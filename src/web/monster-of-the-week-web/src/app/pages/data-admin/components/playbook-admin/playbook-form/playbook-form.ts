import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  PlaybookDetailResponse,
  UpsertPlaybookGearCategoryRequest,
  UpsertPlaybookGearOptionRequest,
  UpsertPlaybookImprovementRequest,
  UpsertPlaybookLookCategoryRequest,
  UpsertPlaybookLookOptionRequest,
  UpsertPlaybookMoveRequest,
  UpsertPlaybookRequest,
  UpsertPlaybookStatArrayOptionRequest,
} from '../../../../../core/models';

/** Mirrors the server's `[MinLength(2)]` on `UpsertPlaybookRequest.Name`. */
const NAME_MIN_LENGTH = 2;

/**
 * Create/edit form for a Playbook and its five child collections, submitted as one graph.
 *
 * Shared by create and edit exactly like `MonsterFormComponent`: `playbook` null means
 * create, non-null means edit. The only difference between the two modes is which service
 * call the parent fires — this component's own behavior is identical either way.
 *
 * **Every child FormGroup carries a hidden `id` control**, and that is the single most
 * important detail in this file. The server reconciles a PUT by matching child rows on
 * that id; if the form dropped ids and sent them all back as null, every save would delete
 * and re-create all children with fresh ids, silently breaking the FK link a Hunter
 * instance holds to the specific row it picked (Phase 9/10). New rows added in the UI
 * correctly carry `null`, which is what tells the server to insert.
 */
@Component({
  selector: 'app-playbook-form',
  imports: [ReactiveFormsModule],
  templateUrl: './playbook-form.html',
})
export class PlaybookFormComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);

  /** `null` puts the form in create mode. */
  @Input() playbook: PlaybookDetailResponse | null = null;
  @Input() isSaving = false;

  @Output() readonly save = new EventEmitter<UpsertPlaybookRequest>();
  @Output() readonly cancel = new EventEmitter<void>();

  readonly hasSubmitted = signal(false);

  readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.minLength(NAME_MIN_LENGTH)]),
    tagline: this.formBuilder.nonNullable.control(''),
    description: this.formBuilder.nonNullable.control(''),
    luckBoxCount: this.formBuilder.nonNullable.control(7, [Validators.required, Validators.min(0)]),
    luckSpecialText: this.formBuilder.nonNullable.control(''),
    harmUnstableThreshold: this.formBuilder.nonNullable.control(4, [Validators.required, Validators.min(0)]),
    harmBoxCount: this.formBuilder.nonNullable.control(7, [Validators.required, Validators.min(0)]),
    experienceBoxCount: this.formBuilder.nonNullable.control(5, [Validators.required, Validators.min(0)]),
    // Defaults to 0 and stays there until Phase 6 authors the Moves section.
    moveGrantCount: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    gettingStartedText: this.formBuilder.nonNullable.control(''),
    introductionsText: this.formBuilder.nonNullable.control(''),
    levelingUpText: this.formBuilder.nonNullable.control(''),
    historyPromptsText: this.formBuilder.nonNullable.control(''),
    statArrayOptions: this.formBuilder.array<FormGroup>([]),
    moves: this.formBuilder.array<FormGroup>([]),
    gearCategories: this.formBuilder.array<FormGroup>([]),
    lookCategories: this.formBuilder.array<FormGroup>([]),
    improvements: this.formBuilder.array<FormGroup>([]),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['playbook']) {
      this.resetFromInput();
    }
  }

  // --- child collection accessors, used by the template ------------------------------

  get statArrayOptions(): FormArray<FormGroup> {
    return this.form.controls.statArrayOptions;
  }

  get moves(): FormArray<FormGroup> {
    return this.form.controls.moves;
  }

  get gearCategories(): FormArray<FormGroup> {
    return this.form.controls.gearCategories;
  }

  get lookCategories(): FormArray<FormGroup> {
    return this.form.controls.lookCategories;
  }

  get improvements(): FormArray<FormGroup> {
    return this.form.controls.improvements;
  }

  gearOptions(category: FormGroup): FormArray<FormGroup> {
    return category.controls['options'] as FormArray<FormGroup>;
  }

  lookOptions(category: FormGroup): FormArray<FormGroup> {
    return category.controls['options'] as FormArray<FormGroup>;
  }

  // --- add / remove ------------------------------------------------------------------

  addStatArrayOption(): void {
    this.statArrayOptions.push(this.buildStatArrayGroup(null));
  }

  addMove(): void {
    this.moves.push(this.buildMoveGroup(null));
  }

  addGearCategory(): void {
    this.gearCategories.push(this.buildGearCategoryGroup(null));
  }

  addGearOption(category: FormGroup): void {
    this.gearOptions(category).push(this.buildGearOptionGroup(null));
  }

  addLookCategory(): void {
    this.lookCategories.push(this.buildLookCategoryGroup(null));
  }

  addLookOption(category: FormGroup): void {
    this.lookOptions(category).push(this.buildLookOptionGroup(null));
  }

  addImprovement(isAdvanced: boolean): void {
    this.improvements.push(this.buildImprovementGroup(null, isAdvanced));
  }

  /**
   * Removes the row from the form only. The server interprets its absence from the
   * submitted graph as a delete — there is no per-child endpoint to call here.
   */
  removeAt(array: FormArray<FormGroup>, index: number): void {
    array.removeAt(index);
  }

  // --- submit ------------------------------------------------------------------------

  isEditing(): boolean {
    return this.playbook !== null;
  }

  shouldShowNameError(): boolean {
    return this.hasSubmitted() && this.form.controls.name.invalid;
  }

  /**
   * Mirrors the server's own cross-field rule so the user sees it before a round trip.
   * The server still enforces it — this is a convenience, not the source of truth.
   */
  harmThresholdExceedsBoxes(): boolean {
    return this.form.controls.harmUnstableThreshold.value > this.form.controls.harmBoxCount.value;
  }

  submit(): void {
    this.hasSubmitted.set(true);

    if (this.form.invalid || this.harmThresholdExceedsBoxes()) {
      this.form.markAllAsTouched();
      return;
    }

    this.save.emit(this.toRequest());
  }

  private toRequest(): UpsertPlaybookRequest {
    const value = this.form.getRawValue();

    return {
      name: value.name.trim(),
      tagline: blankToNull(value.tagline),
      description: blankToNull(value.description),
      luckBoxCount: value.luckBoxCount,
      luckSpecialText: blankToNull(value.luckSpecialText),
      harmUnstableThreshold: value.harmUnstableThreshold,
      harmBoxCount: value.harmBoxCount,
      experienceBoxCount: value.experienceBoxCount,
      moveGrantCount: value.moveGrantCount,
      gettingStartedText: blankToNull(value.gettingStartedText),
      introductionsText: blankToNull(value.introductionsText),
      levelingUpText: blankToNull(value.levelingUpText),
      historyPromptsText: blankToNull(value.historyPromptsText),
      statArrayOptions: this.statArrayOptions.controls.map(
        (group, index): UpsertPlaybookStatArrayOptionRequest => ({
          id: group.controls['id'].value,
          charm: group.controls['charm'].value,
          cool: group.controls['cool'].value,
          sharp: group.controls['sharp'].value,
          tough: group.controls['tough'].value,
          weird: group.controls['weird'].value,
          sortOrder: index,
        })
      ),
      moves: this.moves.controls.map(
        (group, index): UpsertPlaybookMoveRequest => ({
          id: group.controls['id'].value,
          name: group.controls['name'].value.trim(),
          descriptionText: blankToNull(group.controls['descriptionText'].value),
          required: group.controls['required'].value,
          sortOrder: index,
        })
      ),
      gearCategories: this.gearCategories.controls.map(
        (group, index): UpsertPlaybookGearCategoryRequest => ({
          id: group.controls['id'].value,
          label: group.controls['label'].value.trim(),
          // Empty means "every option is granted automatically", which the server stores
          // as null — a distinct state from picking zero.
          pickCount: toNullableNumber(group.controls['pickCount'].value),
          isOptional: group.controls['isOptional'].value,
          sortOrder: index,
          options: this.gearOptions(group).controls.map(
            (option, optionIndex): UpsertPlaybookGearOptionRequest => ({
              id: option.controls['id'].value,
              name: option.controls['name'].value.trim(),
              mechanicalText: blankToNull(option.controls['mechanicalText'].value),
              sortOrder: optionIndex,
            })
          ),
        })
      ),
      lookCategories: this.lookCategories.controls.map(
        (group, index): UpsertPlaybookLookCategoryRequest => ({
          id: group.controls['id'].value,
          allowsFreeform: group.controls['allowsFreeform'].value,
          sortOrder: index,
          options: this.lookOptions(group).controls.map(
            (option, optionIndex): UpsertPlaybookLookOptionRequest => ({
              id: option.controls['id'].value,
              text: option.controls['text'].value.trim(),
              sortOrder: optionIndex,
            })
          ),
        })
      ),
      improvements: this.improvements.controls.map(
        (group, index): UpsertPlaybookImprovementRequest => ({
          id: group.controls['id'].value,
          text: group.controls['text'].value.trim(),
          isAdvanced: group.controls['isAdvanced'].value,
          sortOrder: index,
        })
      ),
    };
  }

  // --- population --------------------------------------------------------------------

  private resetFromInput(): void {
    this.hasSubmitted.set(false);
    const source = this.playbook;

    this.form.patchValue({
      name: source?.name ?? '',
      tagline: source?.tagline ?? '',
      description: source?.description ?? '',
      luckBoxCount: source?.luckBoxCount ?? 7,
      luckSpecialText: source?.luckSpecialText ?? '',
      harmUnstableThreshold: source?.harmUnstableThreshold ?? 4,
      harmBoxCount: source?.harmBoxCount ?? 7,
      experienceBoxCount: source?.experienceBoxCount ?? 5,
      moveGrantCount: source?.moveGrantCount ?? 0,
      gettingStartedText: source?.gettingStartedText ?? '',
      introductionsText: source?.introductionsText ?? '',
      levelingUpText: source?.levelingUpText ?? '',
      historyPromptsText: source?.historyPromptsText ?? '',
    });

    replaceAll(this.statArrayOptions, (source?.statArrayOptions ?? []).map((x) => this.buildStatArrayGroup(x)));
    replaceAll(this.moves, (source?.moves ?? []).map((x) => this.buildMoveGroup(x)));
    replaceAll(this.gearCategories, (source?.gearCategories ?? []).map((x) => this.buildGearCategoryGroup(x)));
    replaceAll(this.lookCategories, (source?.lookCategories ?? []).map((x) => this.buildLookCategoryGroup(x)));
    replaceAll(this.improvements, (source?.improvements ?? []).map((x) => this.buildImprovementGroup(x, x.isAdvanced)));
  }

  private buildStatArrayGroup(source: { id: string; charm: number; cool: number; sharp: number; tough: number; weird: number } | null): FormGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control<string | null>(source?.id ?? null),
      charm: this.formBuilder.nonNullable.control(source?.charm ?? 0, [Validators.required]),
      cool: this.formBuilder.nonNullable.control(source?.cool ?? 0, [Validators.required]),
      sharp: this.formBuilder.nonNullable.control(source?.sharp ?? 0, [Validators.required]),
      tough: this.formBuilder.nonNullable.control(source?.tough ?? 0, [Validators.required]),
      weird: this.formBuilder.nonNullable.control(source?.weird ?? 0, [Validators.required]),
    });
  }

  private buildMoveGroup(source: { id: string; name: string; descriptionText: string | null; required: boolean } | null): FormGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control<string | null>(source?.id ?? null),
      name: this.formBuilder.nonNullable.control(source?.name ?? '', [Validators.required]),
      descriptionText: this.formBuilder.nonNullable.control(source?.descriptionText ?? ''),
      required: this.formBuilder.nonNullable.control(source?.required ?? false),
    });
  }

  private buildGearCategoryGroup(
    source: { id: string; label: string; pickCount: number | null; isOptional: boolean; options: { id: string; name: string; mechanicalText: string | null }[] } | null
  ): FormGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control<string | null>(source?.id ?? null),
      label: this.formBuilder.nonNullable.control(source?.label ?? '', [Validators.required]),
      pickCount: this.formBuilder.control<number | null>(source?.pickCount ?? null),
      isOptional: this.formBuilder.nonNullable.control(source?.isOptional ?? false),
      options: this.formBuilder.array<FormGroup>(
        (source?.options ?? []).map((option) => this.buildGearOptionGroup(option))
      ),
    });
  }

  private buildGearOptionGroup(source: { id: string; name: string; mechanicalText: string | null } | null): FormGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control<string | null>(source?.id ?? null),
      name: this.formBuilder.nonNullable.control(source?.name ?? '', [Validators.required]),
      mechanicalText: this.formBuilder.nonNullable.control(source?.mechanicalText ?? ''),
    });
  }

  private buildLookCategoryGroup(
    source: { id: string; allowsFreeform: boolean; options: { id: string; text: string }[] } | null
  ): FormGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control<string | null>(source?.id ?? null),
      allowsFreeform: this.formBuilder.nonNullable.control(source?.allowsFreeform ?? true),
      options: this.formBuilder.array<FormGroup>(
        (source?.options ?? []).map((option) => this.buildLookOptionGroup(option))
      ),
    });
  }

  private buildLookOptionGroup(source: { id: string; text: string } | null): FormGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control<string | null>(source?.id ?? null),
      text: this.formBuilder.nonNullable.control(source?.text ?? '', [Validators.required]),
    });
  }

  private buildImprovementGroup(source: { id: string; text: string } | null, isAdvanced: boolean): FormGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control<string | null>(source?.id ?? null),
      text: this.formBuilder.nonNullable.control(source?.text ?? '', [Validators.required]),
      isAdvanced: this.formBuilder.nonNullable.control(isAdvanced),
    });
  }
}

function replaceAll(array: FormArray<FormGroup>, groups: FormGroup[]): void {
  array.clear();
  groups.forEach((group) => array.push(group));
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
