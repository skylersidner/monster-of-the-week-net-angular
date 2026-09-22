import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateComponent } from './mystery-create';
import { MinionDraft, MonsterDraft, createDraftKey } from './mystery-create.store';

/** The one monster every fixture minion belongs to. */
const MONSTER_KEY = 'monster-fixture';

/** Fresh sub-resource identity: unsaved (`id: null`) with a unique addressable key. */
const identity = (prefix: string) => ({ id: null, localKey: createDraftKey(prefix) });

/**
 * A complete roster monster. 5b makes a minion impossible without one — `Minion.MonsterId` is a
 * required FK and the minion step renders its empty state with an empty roster — so any fixture
 * that puts minions on the roster has to put their parent there too.
 */
function rosterMonster(overrides: Partial<MonsterDraft> = {}): MonsterDraft {
  return {
    id: null,
    localKey: MONSTER_KEY,
    name: 'The Hollow Man',
    description: '',
    harmCapacity: 8,
    monsterTypeId: 'monster-type-1',
    monsterArchetypeId: 'monster-archetype-1',
    attacks: [],
    powers: [],
    weaknesses: [],
    armors: [],
    existingAttacks: [],
    existingPowers: [],
    existingWeaknesses: [],
    existingArmors: [],
    existingMinionIds: [],
    mysteryIds: [],
    ...overrides,
  };
}

function minionDraft(name: string, counts: Partial<Record<'attacks' | 'powers' | 'weaknesses' | 'armors', number>> = {}): MinionDraft {
  const named = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => ({
      ...identity(prefix),
      name: prefix + '-' + (index + 1),
      description: '',
    }));

  return {
    id: null,
    localKey: createDraftKey(),
    monsterKey: 'monster-fixture',
    existingMonsterId: null,
    name,
    description: '',
    harmCapacity: 3,
    minionTypeId: 'minion-type-1',
    attacks: Array.from({ length: counts.attacks ?? 0 }, (_, index) => ({
      ...identity('attack'),
      name: name + '-attack-' + (index + 1),
      harm: 1,
      description: '',
      weaponTagIds: [],
    })),
    powers: named(name + '-power', counts.powers ?? 0),
    weaknesses: named(name + '-weakness', counts.weaknesses ?? 0),
    armors: Array.from({ length: counts.armors ?? 0 }, (_, index) => ({
      ...identity('armor'),
      name: name + '-armor-' + (index + 1),
      description: '',
      harmSoak: 1,
      isSpecial: false,
      specialDescription: '',
    })),
    existingAttacks: [],
    existingPowers: [],
    existingWeaknesses: [],
    existingArmors: [],
  };
}

class MockReferenceDataService {
  getAdventureTypes() {
    return of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]);
  }

  getMonsterArchetypes() {
    return of([{ id: 'monster-archetype-1', name: 'Ghost', description: '' }]);
  }

  getMonsterTypes() {
    return of([{ id: 'monster-type-1', name: 'Beast', motivation: '' }]);
  }

  getMinionTypes() {
    return of([{ id: 'minion-type-1', name: 'Cultist', motivation: '' }]);
  }

  getLocationTypes() {
    return of([{ id: 'location-type-1', name: 'Lair', motivation: '' }]);
  }

  getBystanderTypes() {
    return of([{ id: 'bystander-type-1', name: 'Witness', motivation: '' }]);
  }

  getWeaponTags() {
    return of([{ id: 'weapon-tag-1', name: 'Bladed', description: '' }]);
  }
}

class MockMysteryService {
  create() {
    return of({ id: 'mystery-1' });
  }

  getMysteries() {
    return of([]);
  }

  upsertCountdown() {
    return of({ id: 'countdown-1' });
  }
}

class MockMonsterService {
  getAll() {
    return of([]);
  }

  create() {
    return of({ id: 'monster-1' });
  }

  createAttack() {
    return of({ id: 'attack-1' });
  }

  createPower() {
    return of({ id: 'power-1' });
  }

  createWeakness() {
    return of({ id: 'weakness-1' });
  }
}

class MockApiService {
  post() {
    return of({});
  }

  /** Phase 4: the store loads the attach catalogues and the mystery list through the real services. */
  get() {
    return of([]);
  }
}

class MockNotificationService {
  success() {}
}

describe('MysteryCreateComponent', () => {
  let fixture: ComponentFixture<MysteryCreateComponent>;
  let component: MysteryCreateComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MysteryCreateComponent],
      providers: [
        provideRouter([]),
        { provide: ReferenceDataService, useClass: MockReferenceDataService },
        { provide: MysteryService, useClass: MockMysteryService },
        { provide: MonsterService, useClass: MockMonsterService },
        { provide: ApiService, useClass: MockApiService },
        { provide: NotificationService, useClass: MockNotificationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MysteryCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the tracker and dossier through child components', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.phase-bubble').length).toBe(4);
    expect(element.querySelectorAll('app-mystery-section-icon').length).toBe(5);
    expect(element.textContent).toContain('Your mystery will take shape here as you work through each step.');
  });

  it('updates the dossier preview from the shared store', () => {
    component.store.conceptForm.controls.name.setValue('The Hollow Choir');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('The Hollow Choir');
  });

  it('renders countdown stage icons in the countdown step and dossier preview', () => {
    component.store.conceptForm.controls.name.setValue('The Hollow Choir');
    component.store.conceptForm.controls.adventureTypeId.setValue('adventure-type-1');
    component.store.next();
    component.store.hookForm.controls.hook.setValue('A choir sings after midnight.');
    component.store.next();
    component.store.overviewForm.controls.overview.setValue('A ghost conductor is opening a gate.');
    component.store.next();
    component.store.countdownForm.patchValue({
      day: 'A hymn starts by itself.',
      midnight: 'The gate tears open.',
    });
    component.store.phaseComplete.set([true, false, false, false]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.countdown-grid app-mystery-section-icon').length).toBe(6);
    expect(element.querySelectorAll('.countdown-dossier-grid app-mystery-section-icon').length).toBe(2);
    expect(element.textContent).toContain('Midnight');
  });

  it("shows both the normal and special armor descriptions in the phase panel and the dossier", () => {
    component.store.currentPhase.set(1);
    component.store.currentStep.set(0);
    component.store.monsterForm.controls.name.setValue("The Grinner");
    component.store.monsterArmors.set([
      {
        ...identity("armor"),
        name: "Bone Plate",
        description: "Fused ribs worn as a cuirass.",
        harmSoak: 2,
        isSpecial: true,
        specialDescription: "Only silver gets through.",
      },
      {
        ...identity("armor"),
        name: "Thick Hide",
        description: "Calloused and scarred.",
        harmSoak: 1,
        isSpecial: false,
        specialDescription: "",
      },
    ]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const phasePanel = element.querySelector("section")!;
    const dossier = element.querySelector("aside")!;

    for (const panel of [phasePanel, dossier]) {
      // A special armor must show its own description as well as the special note.
      expect(panel.textContent).toContain("Fused ribs worn as a cuirass.");
      expect(panel.textContent).toContain("Only silver gets through.");
      // A non-special armor still shows its description and no special note.
      expect(panel.textContent).toContain("Calloused and scarred.");
    }

    expect(phasePanel.querySelectorAll("em").length).toBe(1);
    expect(dossier.querySelector("em")?.textContent).toBe("Special:");
  });

  it("lists the removed minion's own sub-resources in the confirm modal, not the composer's", () => {
    component.store.currentPhase.set(1);
    component.store.currentStep.set(1);
    component.store.monsterDrafts.set([rosterMonster()]);
    component.store.minionDrafts.set([
      minionDraft('Cultist', { attacks: 2, powers: 1 }),
      minionDraft('Thrall', { weaknesses: 3 }),
    ]);
    // The composer is holding the *second* minion...
    component.store.editMinionDraft(component.store.minionDrafts()[1].localKey);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const removeButtons = element.querySelectorAll<HTMLButtonElement>('button[title="Remove minion"]');
    expect(removeButtons.length).toBe(2);

    // ...but the user removes the first, so the modal must describe that one.
    removeButtons[0].click();
    fixture.detectChanges();

    const modal = element.querySelector('[role="dialog"]')!;
    expect(modal.textContent).toContain('Cultist');
    expect(modal.textContent).toContain('2 attacks');
    expect(modal.textContent).toContain('1 power');
    expect(modal.textContent).not.toContain('3 weaknesses');

    // Cancelling leaves the roster intact.
    modal.querySelectorAll('button')[0].click();
    fixture.detectChanges();
    expect(component.store.minionDrafts().length).toBe(2);
  });

  it('shows one compact dossier entry per minion and expands only the one in the composer', () => {
    component.store.currentPhase.set(1);
    component.store.currentStep.set(1);
    component.store.monsterDrafts.set([rosterMonster()]);
    component.store.minionDrafts.set([
      minionDraft('Cultist', { attacks: 2 }),
      minionDraft('Thrall', { weaknesses: 1 }),
      minionDraft('Acolyte', { powers: 4 }),
    ]);
    component.store.editMinionDraft(component.store.minionDrafts()[1].localKey);
    fixture.detectChanges();

    const dossier = (fixture.nativeElement as HTMLElement).querySelector('aside')!;
    const text = dossier.textContent ?? '';

    expect(text).toContain('Cultist');
    expect(text).toContain('Thrall');
    expect(text).toContain('Acolyte');

    // "Harm Capacity" only appears in the expanded block, and exactly one entry is expanded.
    expect(text.split('Harm Capacity').length - 1).toBe(1);

    // The expanded block's weaknesses belong to the minion in the composer, nobody else's.
    expect(text).toContain('Thrall-weakness-1');
    expect(text).not.toContain('Cultist-attack-1');
    expect(text).not.toContain('Acolyte-power-1');
  });

  it('moves focus to the step heading after store.next()', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const heading = element.querySelector<HTMLElement>('section h1')!;
    expect(document.activeElement).not.toBe(heading);

    component.store.conceptForm.controls.name.setValue('The Hollow Choir');
    component.store.conceptForm.controls.adventureTypeId.setValue('adventure-type-1');
    component.store.next();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(heading);
    expect(heading.textContent).toContain('How Do the Hunters Get Involved?');
  });

  it('keeps the minion dossier section visible after a saved minion resets the composer', () => {
    component.store.currentPhase.set(1);
    component.store.currentStep.set(1);
    component.store.monsterDrafts.set([rosterMonster()]);
    component.store.minionForm.patchValue({
      name: 'Choir Thrall',
      description: '',
      harmCapacity: 3,
      minionTypeId: 'minion-type-1',
    });
    component.store.saveMinionDraftToList();
    fixture.detectChanges();

    const dossier = (fixture.nativeElement as HTMLElement).querySelector('aside')!;
    expect(dossier.textContent).toContain('Choir Thrall');
    // Composer is reset and collapsed, so nothing is expanded.
    expect(dossier.textContent).not.toContain('Harm Capacity');
  });
  // --- roster accessibility (UX §8, items 1 and 4) --------------------------------------

  function showRoster(names: string[]): void {
    component.store.currentPhase.set(1);
    component.store.currentStep.set(1);
    component.store.monsterDrafts.set([rosterMonster()]);
    component.store.minionDrafts.set(names.map((name) => minionDraft(name)));
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('names each roster action button after its own minion, not "Edit minion" five times over', () => {
    showRoster(['Cultist', 'Thrall', 'Acolyte']);

    const element = fixture.nativeElement as HTMLElement;
    const edit = Array.from(element.querySelectorAll<HTMLButtonElement>('button[title="Edit minion"]'));
    const remove = Array.from(element.querySelectorAll<HTMLButtonElement>('button[title="Remove minion"]'));

    expect(edit.map((b) => b.getAttribute('aria-label'))).toEqual(['Edit Cultist', 'Edit Thrall', 'Edit Acolyte']);
    expect(remove.map((b) => b.getAttribute('aria-label'))).toEqual(['Remove Cultist', 'Remove Thrall', 'Remove Acolyte']);
    // `title` is kept for the mouse tooltip; it is a fragile accessible-name source on its own.
    expect(edit[0].getAttribute('title')).toBe('Edit minion');
  });

  it('keeps a surviving row’s DOM when an earlier row is removed, because @for tracks the key', async () => {
    // Under `track $index` the list shrinks and the *last* row is destroyed, with every earlier row
    // rebound to different data — so a control the user was standing on vanishes and every row
    // re-animates. Tracking `localKey` moves the removed row out and leaves the rest alone.
    showRoster(['Cultist', 'Thrall', 'Acolyte']);
    await settle();

    const element = fixture.nativeElement as HTMLElement;
    const rowFor = (name: string): HTMLLIElement =>
      Array.from(element.querySelectorAll('li')).find((li) => li.textContent?.includes(name))!;

    const acolyteRow = rowFor('Acolyte');
    const marked = acolyteRow as HTMLLIElement & { marker?: string };
    marked.marker = 'acolyte';

    const cultistKey = component.store.minionDrafts()[0].localKey;
    component.store.removeMinionDraft(cultistKey);
    await settle();

    expect(component.store.minionDrafts().map((draft) => draft.name)).toEqual(['Thrall', 'Acolyte']);
    // The row showing Acolyte is the *same element* it was before the removal.
    expect((rowFor('Acolyte') as HTMLLIElement & { marker?: string }).marker).toBe('acolyte');
    expect(rowFor('Acolyte')).toBe(acolyteRow);
    expect(acolyteRow.isConnected).toBe(true);
  });

  it('moves focus to the composer heading when the pencil pulls a card in, because the pencil unmounts', async () => {
    showRoster(['Cultist', 'Thrall']);
    await settle();

    const element = fixture.nativeElement as HTMLElement;
    const pencil = element.querySelectorAll<HTMLButtonElement>('button[title="Edit minion"]')[1];
    pencil.focus();
    expect(document.activeElement).toBe(pencil);

    pencil.click();
    await settle();

    // The pencil it was standing on no longer exists — that is the defect being fixed.
    expect(element.contains(pencil)).toBe(false);

    const heading = element.querySelector<HTMLElement>('.border.border-default.rounded-lg.mt-4 h4')!;
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(heading);
    // Focusing the heading announces the mode change without an aria-live region.
    expect(heading.textContent).toContain('Editing');
    expect(heading.textContent).toContain('Thrall');
  });

  it('moves focus to the composer heading from + Add Another Minion, which also unmounts', async () => {
    showRoster(['Cultist']);
    component.store.minionComposerOpen.set(false);
    await settle();

    const element = fixture.nativeElement as HTMLElement;
    const addAnother = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Add Another Minion'),
    )!;
    addAnother.focus();

    addAnother.click();
    await settle();

    expect(element.contains(addAnother)).toBe(false);
    const heading = element.querySelector<HTMLElement>('.border.border-default.rounded-lg.mt-4 h4')!;
    expect(document.activeElement).toBe(heading);
    expect(heading.textContent).toContain('Add a Minion');
  });

  it('leaves focus on the pencil when the composer refuses to commit', async () => {
    showRoster(['Cultist', 'Thrall']);
    component.store.startNewMinionDraft();
    component.store.minionForm.controls.description.setValue('Half-typed third minion');
    await settle();

    const element = fixture.nativeElement as HTMLElement;
    const pencil = element.querySelectorAll<HTMLButtonElement>('button[title="Edit minion"]')[0];
    pencil.focus();

    pencil.click();
    await settle();

    // Nothing moved, so nothing should have taken focus off the control the user is on.
    expect(component.store.editingMinionKey()).toBeNull();
    expect(document.activeElement).toBe(pencil);
  });
});
