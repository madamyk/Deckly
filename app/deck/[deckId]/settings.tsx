import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { DeckSettingsScreen } from '@/ui/screens/DeckSettingsScreen';

export default function DeckSettingsRoute() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  return <DeckSettingsScreen deckId={deckId} />;
}

