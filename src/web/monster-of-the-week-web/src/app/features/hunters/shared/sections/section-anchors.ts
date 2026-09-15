/**
 * Element ids the pick-rule hints and notices scroll to on a single-page surface (13.7, L24, L25):
 * "Go to Gear" under a Sect notice lands on the stranded weapons list, and "Go to Sect" under an
 * unfired-adjustment hint lands on the trigger section. The Phase 7 wizard replaces the scroll
 * with a step or Rules-dot link (F6).
 */
export function gearCategoryAnchor(categoryId: string): string {
  return `hunter-gear-${categoryId}`;
}

export function bespokeSectionAnchor(sectionId: string): string {
  return `hunter-section-${sectionId}`;
}

export function scrollToAnchor(document: Document, anchor: string): void {
  // Optional call: jsdom has no scrollIntoView.
  document.getElementById(anchor)?.scrollIntoView?.({ block: 'start' });
}
