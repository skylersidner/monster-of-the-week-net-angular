import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { MonsterDetailResponse, UpsertMonsterRequest } from '../../../../core/models';
import { MonsterService } from '../../../../core/monster';
import { MinionService } from '../../../../core/minion';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MonsterFormComponent } from '../../shared/monster-form/monster-form';
import { MonsterDetailComponent } from './monster-detail';

/** The body half of a save, shaped exactly as `PUT /api/monsters/{id}` takes it. */
const monsterBody: UpsertMonsterRequest = {
  name: 'Monster',
  description: null,
  harmCapacity: 7,
  monsterTypeId: 'monster-type-1',
  monsterArchetypeId: 'monster-archetype-1',
};

const loadedMonster: MonsterDetailResponse = {
  id: 'mo1',
  mysteryIds: ['m1'],
  name: 'Monster',
  description: null,
  harmCapacity: 7,
  monsterTypeId: 'monster-type-1',
  monsterTypeName: null,
  monsterArchetype: { id: 'monster-archetype-1', name: 'Ghost', description: '' },
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
};

describe('MonsterDetailComponent', () => {
  let component: MonsterDetailComponent;
  let fixture: ComponentFixture<MonsterDetailComponent>;
  let deleteAttackCalls = 0;
  let updateCalls: { monsterId: string; payload: UpsertMonsterRequest }[] = [];
  /** The membership ledger `5b-L1` needs: add, remove, both in one save, and none when unchanged. */
  let membershipCalls: string[] = [];
  let membershipShouldFail = false;
  /** Server truth, mutated by `update` and read back by the post-save refetch. */
  let currentMonster: MonsterDetailResponse = loadedMonster;

  beforeEach(async () => {
    deleteAttackCalls = 0;
    updateCalls = [];
    currentMonster = loadedMonster;
    membershipCalls = [];
    membershipShouldFail = false;
    await TestBed.configureTestingModule({
      imports: [MonsterDetailComponent],
      providers: [
        /**
         * **F-L9.** `CustomMoveService` is `providedIn: 'root'`, so without this the real one
         * resolves and any stray call becomes a real HTTP request — refused today only because
         * nothing is listening on :5225, and a write against dev the moment something is. This
         * spec drives no custom-move traffic, so the stub says so by throwing.
         */
        {
          provide: CustomMoveService,
          useValue: (() => {
            // Only the service's own four methods. A catch-all `Proxy` refuses `ngOnDestroy()` too,
            // which Angular calls on every provider instance at teardown — 386 tests, one stub.
            const refuse = (method: string) => () => {
              throw new Error(`Unexpected CustomMoveService.${method}() — this spec expects no custom-move traffic.`);
            };
            return { list: refuse('list'), create: refuse('create'), update: refuse('update'), delete: refuse('delete') };
          })(),
        },
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ mysteryId: 'm1', monsterId: 'mo1' })),
          },
        },
        {
          provide: MonsterService,
          useValue: {
            // **The save now ends in a refetch** (5b), so this double has to behave like a server:
            // what `getById` returns after an update must be what the update wrote. A stub that kept
            // answering the original would make the refetch look like it had lost the user's edit.
            getById: () => of(currentMonster),
            update: (monsterId: string, payload: UpsertMonsterRequest) => {
              updateCalls.push({ monsterId, payload });
              currentMonster = { ...currentMonster, ...payload, monsterArchetype: loadedMonster.monsterArchetype };
              return of(currentMonster);
            },
            linkToMystery: (mysteryId: string, monsterId: string) => {
              membershipCalls.push(`link(${mysteryId},${monsterId})`);
              return membershipShouldFail ? throwError(() => new Error('boom')) : of(undefined);
            },
            unlinkFromMystery: (mysteryId: string, monsterId: string) => {
              membershipCalls.push(`unlink(${mysteryId},${monsterId})`);
              return of(undefined);
            },
            createAttack: () => of({ id: 'a1' }),
            assignAttackWeaponTag: () => of({}),
            createPower: () => of({}),
            createArmor: () => of({}),
            createWeakness: () => of({}),
            deleteAttack: () => {
              deleteAttackCalls += 1;
              return of(void 0);
            },
            deletePower: () => of(void 0),
            deleteArmor: () => of(void 0),
            deleteWeakness: () => of(void 0),
          },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getMonsterTypes: () => of([]),
            getMonsterArchetypes: () => of([]),
            getWeaponTags: () => of([]),
          },
        },
        {
          provide: MinionService,
          useValue: {
            getByMonster: () => of([]),
          },
        },
        {
          provide: MysteryService,
          useValue: {
            getMysteries: () => of([{ id: 'm1', name: 'The Hollow Choir' }]),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: () => {},
            error: () => {},
            notifications: () => [],
            dismiss: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MonsterDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function sharedForm(): MonsterFormComponent {
    const debugElement = fixture.debugElement.query(By.directive(MonsterFormComponent));
    expect(debugElement).toBeTruthy();
    return debugElement.componentInstance as MonsterFormComponent;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the shared monster form instead of its own core-fields form', () => {
    expect(fixture.nativeElement.querySelector('app-monster-form')).toBeTruthy();
    expect((component as unknown as Record<string, unknown>)['monsterForm']).toBeUndefined();
  });

  it('passes the loaded monster and a Save Monster label down to the shared form', () => {
    const instance = sharedForm();
    expect(instance.monster).toBe(loadedMonster);
    expect(instance.submitLabel).toBe('Save Monster');
    expect(instance.monsterForm.getRawValue().name).toBe('Monster');
  });

  it('saves through the shared form output when the form is submitted with valid values', () => {
    const instance = sharedForm();
    instance.monsterForm.setValue({
      name: 'Renamed',
      description: '',
      harmCapacity: 9,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
      mysteryIds: [],
    });

    const form = fixture.nativeElement.querySelector('app-monster-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(updateCalls).toEqual([
      {
        monsterId: 'mo1',
        payload: {
          name: 'Renamed',
          description: null,
          harmCapacity: 9,
          monsterTypeId: 'monster-type-1',
          monsterArchetypeId: 'monster-archetype-1',
        },
      },
    ]);
  });

  it('saves the monster when the shared form emits a payload', () => {
    const payload: UpsertMonsterRequest = {
      name: 'Renamed',
      description: 'Now with a description.',
      harmCapacity: 9,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    };

    component.saveMonster({ monster: payload, mysteryIds: [] });

    expect(updateCalls).toEqual([{ monsterId: 'mo1', payload }]);
    expect(component.monster()!.name).toBe('Renamed');
    expect(component.activeMutation()).toBeNull();
  });

  it('does not call update when no monster has been loaded', () => {
    component.monster.set(null);

    component.saveMonster({
      monster: {
        name: 'Renamed',
        description: null,
        harmCapacity: 9,
        monsterTypeId: 'monster-type-1',
        monsterArchetypeId: 'monster-archetype-1',
      },
      mysteryIds: [],
    });

    expect(updateCalls).toEqual([]);
  });

  it('5b-L1: unchanged membership issues no membership calls at all', () => {
    component.saveMonster({ monster: monsterBody, mysteryIds: ['m1'] });

    // The common "just renamed it" save stays two round trips (the PUT and the refetch).
    expect(membershipCalls).toEqual([]);
  });

  it('5b-L1: an add and a remove in one save produce one PUT and one DELETE', () => {
    component.saveMonster({ monster: monsterBody, mysteryIds: ['m2'] });

    expect([...membershipCalls].sort()).toEqual(['link(m2,mo1)', 'unlink(m1,mo1)']);
  });

  it('5b-L1: a membership failure is a success with a caveat, and the form stays mounted', () => {
    membershipShouldFail = true;

    component.saveMonster({ monster: monsterBody, mysteryIds: ['m1', 'm2'] });

    // `errorMessage` would unmount the form, leaving nothing to retry into; the re-rendered
    // membership control above the Save button is itself the answer to "which ones failed?".
    expect(component.errorMessage()).toBeNull();
    expect(component.activeMutation()).toBeNull();
    expect(fixture.nativeElement.querySelector('app-monster-form')).toBeTruthy();
  });

  it('requires specialDescription on the armor form only while isSpecial is checked', () => {
    const specialDescription = component.armorForm.controls.specialDescription;

    expect(specialDescription.validator).toBeNull();

    component.armorForm.controls.isSpecial.setValue(true);
    specialDescription.setValue('');
    expect(specialDescription.valid).toBe(false);

    component.armorForm.controls.isSpecial.setValue(false);
    expect(specialDescription.valid).toBe(true);
  });

  it('shows the Special Description asterisk only while Is Special is checked', () => {
    const armorArticle = Array.from(fixture.nativeElement.querySelectorAll('article')).find((article) =>
      (article as HTMLElement).textContent?.includes('Armors')
    ) as HTMLElement;
    const labels = Array.from(armorArticle.querySelectorAll('label')) as HTMLLabelElement[];
    const specialDescriptionLabel = labels.find((label) => label.textContent?.trim().startsWith('Special Description'));

    expect(specialDescriptionLabel?.querySelector('span.text-danger')).toBeNull();

    component.armorForm.controls.isSpecial.setValue(true);
    fixture.detectChanges();

    expect(specialDescriptionLabel?.querySelector('span.text-danger')?.textContent?.trim()).toBe('*');
  });

  it('shows the special description when an armor entry is special', () => {
    component.monster.set({
      ...loadedMonster,
      armors: [
        {
          id: 'ar1',
          name: 'Bark Hide',
          description: 'Thick bark.',
          harmSoak: 2,
          isSpecial: true,
          specialDescription: 'Only against fire.',
        },
        {
          id: 'ar2',
          name: 'Scale Mail',
          description: 'Ordinary scales.',
          harmSoak: 1,
          isSpecial: false,
          specialDescription: null,
        },
      ],
    });
    fixture.detectChanges();

    const armorArticle = Array.from(fixture.nativeElement.querySelectorAll('article')).find((article) =>
      (article as HTMLElement).textContent?.includes('Armors')
    ) as HTMLElement;

    expect(armorArticle.textContent).toContain('Special: Only against fire.');
    expect(armorArticle.textContent).not.toContain('Special: Ordinary scales.');
  });

  it('does not delete attack when cancelled', () => {
    component.requestDeleteAttack('attack-1', 'Test Attack');
    expect(component.pendingDelete()).not.toBeNull();
    component.onDeleteCancelled();
    expect(component.pendingDelete()).toBeNull();
    expect(deleteAttackCalls).toBe(0);
  });

  it('deletes attack when confirmed', () => {
    component.requestDeleteAttack('attack-1', 'Test Attack');
    component.onDeleteConfirmed();
    expect(deleteAttackCalls).toBe(1);
  });
});
