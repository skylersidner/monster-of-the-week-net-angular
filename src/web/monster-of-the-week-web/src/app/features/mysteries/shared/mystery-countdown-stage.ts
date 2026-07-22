export type MysteryCountdownStageIconKind = 'day' | 'shadows' | 'sunset' | 'dusk' | 'nightfall' | 'midnight';

export type MysteryCountdownStageKey = MysteryCountdownStageIconKind;

export interface MysteryCountdownStageDefinition {
  key: MysteryCountdownStageKey;
  label: string;
  icon: MysteryCountdownStageIconKind;
  placeholder: string;
}

export const MYSTERY_COUNTDOWN_STAGES: readonly MysteryCountdownStageDefinition[] = [
  { key: 'day', label: 'Day', icon: 'day', placeholder: 'First sign of trouble...' },
  { key: 'shadows', label: 'Shadows', icon: 'shadows', placeholder: 'Things escalate...' },
  { key: 'sunset', label: 'Sunset', icon: 'sunset', placeholder: 'The threat becomes visible...' },
  { key: 'dusk', label: 'Dusk', icon: 'dusk', placeholder: 'People are in danger...' },
  { key: 'nightfall', label: 'Nightfall', icon: 'nightfall', placeholder: 'Death and destruction...' },
  { key: 'midnight', label: 'Midnight', icon: 'midnight', placeholder: 'Catastrophe...' },
];
