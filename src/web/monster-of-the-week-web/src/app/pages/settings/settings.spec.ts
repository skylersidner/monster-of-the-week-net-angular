import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResolvedTheme, ThemePreference, ThemeService } from '../../core/theme';
import { SettingsPageComponent } from './settings';

/**
 * ThemeService is mocked rather than used directly: it reads window.localStorage and
 * window.matchMedia at construction, neither of which the unit-test environment provides
 * (see .squad/agents/Luigi/history.md, Phase 0).
 */
class MockThemeService {
  readonly preference = signal<ThemePreference>('system');
  readonly resolvedTheme = signal<ResolvedTheme>('light');
  readonly setPreference = vi.fn((preference: ThemePreference) => this.preference.set(preference));
}

describe('SettingsPageComponent', () => {
  let component: SettingsPageComponent;
  let fixture: ComponentFixture<SettingsPageComponent>;
  let element: HTMLElement;
  let themeService: MockThemeService;

  beforeEach(async () => {
    themeService = new MockThemeService();

    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [{ provide: ThemeService, useValue: themeService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPageComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  function openThemeSelect(): HTMLButtonElement[] {
    (element.querySelector('.custom-select__trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    return Array.from(element.querySelectorAll('.custom-select__option')) as HTMLButtonElement[];
  }

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the three theme choices with readable labels', () => {
    const labels = openThemeSelect().map((option) => option.textContent?.trim());
    expect(labels).toEqual(['Light', 'Dark', 'Match system']);
  });

  it('shows the current preference in the select trigger', () => {
    const trigger = element.querySelector('.custom-select__trigger') as HTMLButtonElement;
    expect(trigger.textContent).toContain('Match system');
  });

  it('persists the chosen preference through ThemeService', () => {
    openThemeSelect()[1].click();
    fixture.detectChanges();

    expect(themeService.setPreference).toHaveBeenCalledWith('dark');
    expect((element.querySelector('.custom-select__trigger') as HTMLButtonElement).textContent).toContain('Dark');
  });

  it('reports the resolved theme only while following the system setting', () => {
    expect(element.textContent).toContain('Currently showing the light theme.');

    openThemeSelect()[0].click();
    fixture.detectChanges();

    expect(element.textContent).not.toContain('Currently showing the');
  });
});
