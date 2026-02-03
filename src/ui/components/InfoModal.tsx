import React from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '@/ui/components/Button';
import { Surface } from '@/ui/components/Surface';
import { Text } from '@/ui/components/Text';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actionLabel?: string;
};

export function InfoModal({ visible, title, onClose, children, actionLabel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
        <Pressable
          onPress={onClose}
          style={{
            ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        />
        <Surface radius={22} style={{ gap: 10, padding: 16 }}>
          <Text variant="h2">{title}</Text>
          {children}
          <Button title={actionLabel ?? 'Got it'} variant="secondary" onPress={onClose} />
        </Surface>
      </View>
    </Modal>
  );
}
