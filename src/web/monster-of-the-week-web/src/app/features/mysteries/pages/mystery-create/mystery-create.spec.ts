import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateComponent } from './mystery-create';

class MockReferenceDataService {
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
    expect(element.textContent).toContain('Your mystery will take shape here as you work through each step.');
  });

  it('updates the dossier preview from the shared store', () => {
    component.store.conceptForm.controls.name.setValue('The Hollow Choir');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('The Hollow Choir');
  });
});
