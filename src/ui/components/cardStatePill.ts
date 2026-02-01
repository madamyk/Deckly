import type { CardState } from '@/domain/models';
import type { PillTone } from '@/ui/components/Pill';

export function cardStateLabel(state: CardState): string {
  return state.toUpperCase();
}

export function cardStateTone(state: CardState): PillTone {
  if (state === 'new') return 'subtleAmber';
  if (state === 'learning') return 'teal';
  return 'primary';
}

