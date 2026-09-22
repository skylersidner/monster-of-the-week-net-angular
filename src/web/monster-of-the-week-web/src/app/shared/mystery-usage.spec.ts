import {
  mysteryUsageFootnote,
  mysteryUsageMessage,
  mysteryUsageUnavailableMessage,
  resolveMysteryNames,
  wizardMysteryUsageMessage,
  wizardRemovalFootnote,
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

  it('states the count and says only the names are missing when they could not be resolved', () => {
    // §15.1. The count and the names are two facts from two sources: the count is the entity's own
    // `mysteryIds` and is always available, the names need the mystery lookup. Collapsing them made
    // a failed lookup render as "isn't used by any mystery" — the opposite of the truth.
    expect(mysteryUsageMessage('location', 2, false)).toBe(
      "This location is used by 2 mysteries. Their names couldn't be loaded.",
    );
    expect(mysteryUsageMessage('location', 1, false)).toBe(
      "This location is used by 1 mystery. Their names couldn't be loaded.",
    );
  });

  it('ends the names-missing variant in a full stop, because a colon promises a list', () => {
    const missing = mysteryUsageMessage('location', 2, false);

    expect(missing).not.toContain('mysteries:');
    expect(missing.endsWith('.')).toBe(true);
  });

  it('never claims nothing uses it just because the names are missing', () => {
    expect(mysteryUsageMessage('location', 2, false)).not.toContain("isn't used by any");
  });

  it('still says "isn’t used by any mystery" for a real zero, whatever the names flag says', () => {
    // Zero names for zero memberships is not a failure, and must not be reported as one.
    expect(mysteryUsageMessage('location', 0, false)).toBe("This location isn't used by any mystery.");
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

describe('wizardMysteryUsageMessage', () => {
  it('says "other mysteries", which the list-page wording never does', () => {
    // Inside the wizard there *is* a current mystery, so the others really are other. On a flat
    // catalogue route there is not, and "other" there makes the count read as off-by-one.
    expect(wizardMysteryUsageMessage('location', 2)).toBe('This location is also used by 2 other mysteries:');
    expect(wizardMysteryUsageMessage('location', 1)).toBe('This location is also used by 1 other mystery:');
  });

  it('has its own zero sentence', () => {
    expect(wizardMysteryUsageMessage('bystander', 0)).toBe("This bystander isn't used by any other mystery.");
  });

  it('states the count and flags only the missing names — the §15.1 fix', () => {
    expect(wizardMysteryUsageMessage('location', 2, false)).toBe(
      "This location is also used by 2 other mysteries. Their names couldn't be loaded.",
    );
    expect(wizardMysteryUsageMessage('location', 2, false)).not.toContain("isn't used by any other mystery");
    expect(wizardMysteryUsageMessage('location', 2, false)).not.toContain('mysteries:');
  });

  it('reports a real zero as a zero even when the names flag is false', () => {
    expect(wizardMysteryUsageMessage('location', 0, false)).toBe("This location isn't used by any other mystery.");
  });
});

describe('wizardRemovalFootnote', () => {
  it('names the cross-mystery consequence only when the entity is used elsewhere', () => {
    expect(wizardRemovalFootnote('location', true, 'when you press Finish')).toBe(
      'Detach removes it from this mystery only. Delete removes it from those mysteries too. Either way, the change takes effect when you press Finish.',
    );
    expect(wizardRemovalFootnote('location', false, 'when you continue to the next step')).toBe(
      'Detach keeps it in your locations list. Delete removes it for good. Either way, the change takes effect when you continue to the next step.',
    );
  });

  it('never says "cannot be undone", because a wizard removal has not happened yet', () => {
    // §7.3: the list pages use the hard permanence line; here it would be false at the moment it
    // is read, and this sentence is the only thing carrying the deferred model to the user.
    expect(wizardRemovalFootnote('location', true, 'when you press Finish')).not.toContain('cannot be undone');
  });
});
