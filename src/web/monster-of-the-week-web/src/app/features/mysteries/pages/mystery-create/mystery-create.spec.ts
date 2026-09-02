import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateComponent } from './mystery-create';
import { MinionDraft } from './mystery-create.store';

function minionDraft(name: string, counts: Partial<Record<'attacks' | 'powers' | 'weaknesses' | 'armors', number>> = {}): MinionDraft {
  const named = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => ({ name: prefix + '-' + (index + 1), description: '' }));

  return {
    id: null,
    name,
    description: '',
    harmCapacity: 3,
    minionTypeId: 'minion-type-1',
    attacks: Array.from({ length: counts.attacks ?? 0 }, (_, index) => ({
      name: name + '-attack-' + (index + 1),
      harm: 1,
      description: '',
      weaponTagIds: [],
    })),
    powers: named(name + '-power', counts.powers ?? 0),
    weaknesses: named(name + '-weakness', counts.weaknesses ?? 0),
    armors: Array.from({ length: counts.armors ?? 0 }, (_, index) => ({
      name: name + '-armor-' + (index + 1),
      description: '',
      harmSoak: 1,
      isSpecial: false,
      specialDescription: '',
    })),
    existingAttackIds: [],
    existingPowerIds: [],
    existingWeaknessIds: [],
    existingArmorIds: [],
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

  upsertCountdown() {
    return of({ id: 'countdown-1' });
  }
}

class MockMonsterService {
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
        name: "Bone Plate",
        description: "Fused ribs worn as a cuirass.",
        harmSoak: 2,
        isSpecial: true,
        specialDescription: "Only silver gets through.",
      },
      {
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
    component.store.minionDrafts.set([
      minionDraft('Cultist', { attacks: 2, powers: 1 }),
      minionDraft('Thrall', { weaknesses: 3 }),
    ]);
    // The composer is holding the *second* minion...
    component.store.editMinionDraft(1);
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
    component.store.minionDrafts.set([
      minionDraft('Cultist', { attacks: 2 }),
      minionDraft('Thrall', { weaknesses: 1 }),
      minionDraft('Acolyte', { powers: 4 }),
    ]);
    component.store.editMinionDraft(1);
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

  it('keeps the minion dossier section visible after a saved minion resets the composer', () => {
    component.store.currentPhase.set(1);
    component.store.currentStep.set(1);
    component.store.minionForm.setValue({
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
});
