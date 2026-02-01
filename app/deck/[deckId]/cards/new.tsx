import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { CardEditorScreen } from '@/ui/screens/CardEditorScreen';

export default function NewCardRoute() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  return <CardEditorScreen mode="create" deckId={deckId} />;
}

