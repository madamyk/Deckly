import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Input } from '@/ui/components/Input';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

export function PromptModal(props: {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const t = useDecklyTheme();
  const [value, setValue] = useState(props.initialValue ?? '');

  useEffect(() => {
    if (props.visible) setValue(props.initialValue ?? '');
  }, [props.visible, props.initialValue]);

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={props.onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.backdrop,
          {
            backgroundColor:
              t.scheme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(17,24,39,0.35)',
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={props.onCancel} />
        <Card style={[styles.card, { backgroundColor: t.colors.surface }]}>
          <Text variant="h2">{props.title}</Text>
          <View style={{ height: 10 }} />
          <Input
            value={value}
            onChangeText={setValue}
            placeholder={props.placeholder}
            autoFocus
          />
          <View style={{ height: 14 }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" variant="secondary" onPress={props.onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={props.confirmLabel ?? 'Save'} onPress={() => props.onConfirm(value)} />
            </View>
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    padding: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    padding: 16,
    width: '100%',
    maxWidth: 520,
  },
});
