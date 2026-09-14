import { useEffect, useRef, useState } from 'react';
import { GamepadAction, GAMEPAD_BUTTON_MAP } from '@/types';

/** Returns true while at least one gamepad is plugged in / paired. */
export function useGamepadConnected(): boolean {
  const [connected, setConnected] = useState(() =>
    typeof navigator !== 'undefined' &&
    Array.from(navigator.getGamepads()).some(Boolean),
  );

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () =>
      setConnected(Array.from(navigator.getGamepads()).some(Boolean));
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, []);

  return connected;
}

export function useGamepad(onAction: (action: GamepadAction) => void) {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  useEffect(() => {
    let animationFrameId: number;
    let previousButtons: boolean[] = [];

    const poll = () => {
      const gamepads = navigator.getGamepads();
      let gp: Gamepad | null = null;
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          gp = gamepads[i];
          break;
        }
      }
      
      if (gp) {
        const currentButtons = gp.buttons.map((b) => typeof b === 'object' ? b.pressed : b === 1.0);
        currentButtons.forEach((pressed, index) => {
          if (pressed && !previousButtons[index]) {
            const action = GAMEPAD_BUTTON_MAP[index];
            if (action) {
              onActionRef.current(action);
            }
          }
        });
        previousButtons = currentButtons;
      }
      animationFrameId = requestAnimationFrame(poll);
    };

    animationFrameId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);
}
