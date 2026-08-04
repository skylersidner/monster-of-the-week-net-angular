import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ThemePreference, ThemeService } from '../../core/theme';
import { CustomSelectComponent } from '../../shared/custom-select.component';

const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Match system',
};

@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './settings.html',
})
export class SettingsPageComponent {
  private readonly themeService = inject(ThemeService);

  readonly preference = this.themeService.preference;
  readonly resolvedTheme = this.themeService.resolvedTheme;

  readonly themeOptions: readonly ThemePreference[] = ['light', 'dark', 'system'];

  readonly themeControl = new FormControl<ThemePreference>(this.preference(), { nonNullable: true });

  // CustomSelectComponent's defaults read `id`/`name`/`description` off an option object; the
  // options here are plain ThemePreference strings, so all three accessors are supplied
  // explicitly rather than letting the defaults stringify the raw value ('system').
  readonly themeOptionValue = (option: ThemePreference): string => option;
  readonly themeOptionLabel = (option: ThemePreference): string => THEME_LABELS[option];
  readonly themeOptionSubLabel = (): string | null => null;

  constructor() {
    this.themeControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((preference) => this.choose(preference));
  }

  choose(preference: ThemePreference): void {
    this.themeService.setPreference(preference);
  }
}
