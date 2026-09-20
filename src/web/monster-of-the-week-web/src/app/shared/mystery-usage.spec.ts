import {
  mysteryUsageFootnote,
  mysteryUsageMessage,
  mysteryUsageUnavailableMessage,
  resolveMysteryNames,
} from './mystery-usage';

describe('mysteryUsageMessage', () => {
  it('pluralises for real rather than with a bare (s)', () => {
    expect(mysteryUsageMessage('location', 1)).toBe('This location is used by 1 mystery:');
    expect(mysteryUsageMessage('location', 2)).toBe('This location is used by 2 mysteries:');
    expect(mysteryUsageMessage('location', 9)).toBe('This location is used by 9 mysteries:');
  });

  it('says "mysteries", not "other mysteries" — a list page has no current mystery', () => {
    // One word, and getting it wrong makes the count read as off-by-one. The wizard's variants (B)
    // and (C) do say "other"; that wording is Phase 4's and deliberately does not live here.
    const message = mysteryUsageMessage('bystander', 2);

    expect(message).toBe('This bystander is used by 2 mysteries:');
    expect(message).not.toContain('other');
  });

  it('has a distinct sentence for zero, with no trailing colon and no list to introduce', () => {
    expect(mysteryUsageMessage('monster', 0)).toBe("This monster isn't used by any mystery.");
    expect(mysteryUsageMessage('monster', 0)).not.toContain(':');
  });

  it('carries the entity noun into the sentence', () => {
    expect(mysteryUsageMessage('monster', 1)).toContain('This monster');
    expect(mysteryUsageMessage('bystander', 1)).toContain('This bystander');
  });
});

describe('mysteryUsageUnavailableMessage', () => {
  it('says the check failed rather than saying nothing', () => {
    // Rosalina's override (§7.7): suppressing the block reproduces the inference it avoids, because
    // once users learn the dialog always reports usage, an absent block reads as "used nowhere".
    expect(mysteryUsageUnavailableMessage('location')).toBe(
      "Couldn't check which mysteries use this location.",
    );
  });

  it('carries the entity noun, like the other two sentences', () => {
    expect(mysteryUsageUnavailableMessage('bystander')).toContain('this bystander');
    expect(mysteryUsageUnavailableMessage('monster')).toContain('this monster');
  });

  it('never claims a count, in either direction', () => {
    const message = mysteryUsageUnavailableMessage('monster');

    expect(message).not.toContain('any mystery');
    expect(message).not.toMatch(/\d/);
  });
});

describe('mysteryUsageFootnote', () => {
  it('names the cross-mystery consequence when there is one', () => {
    expect(mysteryUsageFootnote(1)).toBe(
      'Deleting removes it from those mysteries too. This cannot be undone.',
    );
  });

  it('falls back to bare permanence when the entity is in no mystery', () => {
    expect(mysteryUsageFootnote(0)).toBe('This cannot be undone.');
  });

  it('keeps the hard permanence wording, because a list-page delete is immediate', () => {
    // Unlike the wizard, where removal is deferred to the next phase transition and "cannot be
    // undone" would be false at the moment it is read (§7.3).
    expect(mysteryUsageFootnote(0)).toContain('cannot be undone');
    expect(mysteryUsageFootnote(2)).toContain('cannot be undone');
    expect(mysteryUsageFootnote(2)).not.toContain('next step');
  });
});

describe('resolveMysteryNames', () => {
  const mysteries = [
    { id: 'm1', name: 'Dust Bowl Nights' },
    { id: 'm2', name: 'The Long Drive Home' },
    { id: 'm3', name: 'Cold Open' },
  ];

  it('returns names in mystery-list order, not in mysteryIds order', () => {
    expect(resolveMysteryNames(['m3', 'm1'], mysteries)).toEqual(['Dust Bowl Nights', 'Cold Open']);
  });

  it('returns nothing for an entity in no mystery', () => {
    expect(resolveMysteryNames([], mysteries)).toEqual([]);
  });

  it('drops ids it cannot resolve, so the count and the list can never disagree', () => {
    // The caller takes its count from this array. If a stale id survived here, the sentence would
    // claim a number the list beneath it does not show.
    const names = resolveMysteryNames(['m1', 'deleted-elsewhere'], mysteries);

    expect(names).toEqual(['Dust Bowl Nights']);
    expect(mysteryUsageMessage('location', names.length)).toBe('This location is used by 1 mystery:');
  });

  it('tolerates an empty mystery list without claiming anything', () => {
    expect(resolveMysteryNames(['m1', 'm2'], [])).toEqual([]);
  });
});
