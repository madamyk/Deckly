import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Minimal keyboard visibility hook for hiding risky actions while typing.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvt, () => setVisible(true));
    const subHide = Keyboard.addListener(hideEvt, () => setVisible(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return visible;
}

