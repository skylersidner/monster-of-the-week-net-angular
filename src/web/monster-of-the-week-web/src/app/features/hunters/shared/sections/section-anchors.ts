/**
 * Element ids that hints, notices and links scroll to.
 *
 * On a single-page surface (13.7, L24, L25): "Go to Gear" under a Sect notice lands on the stranded
 * weapons list, and "Go to Sect" under an unfired-adjustment hint lands on the trigger section. In the
 * creation wizard those become step or Rules-dot links (F6, `section-navigator.ts`), and the wizard
 * scrolls to the same ids once the target step has rendered, for its band and "Still to finish" links (L8).
 */
export function gearCategoryAnchor(categoryId: string): string {
  return `hunter-gear-${categoryId}`;
}

export function bespokeSectionAnchor(sectionId: string): string {
  return `hunter-section-${sectionId}`;
}

/** The look section, for the wizard's "Still to finish" look lines. */
export const LOOK_SECTION_ANCHOR = 'hunter-look';

export function scrollToAnchor(document: Document, anchor: string): void {
  // Optional call: jsdom has no scrollIntoView.
  document.getElementById(anchor)?.scrollIntoView?.({ block: 'start' });
}
