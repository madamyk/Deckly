import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { CardEditorScreen } from '@/ui/screens/CardEditorScreen';

export default function EditCardRoute() {
  const { deckId, cardId } = useLocalSearchParams<{ deckId: string; cardId: string }>();
  return <CardEditorScreen mode="edit" deckId={deckId} cardId={cardId} />;
}

