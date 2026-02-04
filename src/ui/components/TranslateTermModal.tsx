import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';

import { Button } from '@/ui/components/Button';
import { Surface } from '@/ui/components/Surface';
import { Text } from '@/ui/components/Text';
import type { LanguageOption } from '@/domain/languages';

type Props = {
  visible: boolean;
  pendingSide: 'front' | 'back' | null;
  selectedCode: string;
  languageOptions: LanguageOption[];
  onChangeCode: (code: string) => void;
  onTranslate: () => void;
  onClose: () => void;
};

export function TranslateTermModal({
  visible,
  pendingSide,
  selectedCode,
  languageOptions,
  onChangeCode,
  onTranslate,
  onClose,
}: Props) {
  const description = pendingSide
    ? `We'll translate the ${pendingSide === 'front' ? 'back' : 'front'} into the selected language and fill the ${pendingSide}.`
    : `We'll translate the other side into the selected language and fill the empty field.`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable
          onPress={onClose}
          style={styles.backdrop}
        />
        <Surface radius={22} style={styles.surface}>
          <Text variant="h2">Translate into</Text>
          <Text variant="muted">{description}</Text>
          <Picker selectedValue={selectedCode} onValueChange={(value) => onChangeCode(String(value))}>
            {languageOptions.map((language) => (
              <Picker.Item
                key={language.code}
                label={`${language.emoji} ${language.label}`}
                value={language.code}
              />
            ))}
          </Picker>
          <View style={styles.actions}>
            <Button title="Translate" onPress={onTranslate} disabled={!pendingSide} />
            <Button title="Cancel" variant="secondary" onPress={onClose} />
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  backdrop: {
    ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  surface: {
    gap: 12,
    padding: 16,
  },
  actions: {
    gap: 10,
  },
});
