import { InjectionToken } from '@angular/core';

/**
 * Where the pick-rule hints and notices in the shared sections go (hunter-creation-wizard.md 13.7,
 * L24, L25; Phase 7, F6): "Go to {section}" under an unfired-adjustment hint, "Go to Gear" under a
 * Sect notice.
 *
 * On a single-page surface (the edit page) nothing provides this, and the sections scroll to the
 * target on the same page. The creation wizard provides its store, so the same buttons become step
 * and Rules-dot links, because the target is usually on another step.
 */
export interface HunterSectionNavigator {
  goToSection(sectionId: string): void;
  goToGear(categoryId: string): void;
}

export const HUNTER_SECTION_NAVIGATOR = new InjectionToken<HunterSectionNavigator>('HUNTER_SECTION_NAVIGATOR');
