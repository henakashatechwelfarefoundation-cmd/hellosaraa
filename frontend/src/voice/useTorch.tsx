import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Hidden torch controller — mounts a tiny (1x1) CameraView so we can toggle
 * its `enableTorch` prop. Works on native builds only; the caller should
 * gracefully fall back when permission is denied.
 */
export interface TorchController {
  setOn: (on: boolean) => void;
  isOn: boolean;
  supported: boolean;
}

export function useTorch(): { controller: TorchController; PortalNode: React.FC } {
  const [permission, requestPermission] = useCameraPermissions();
  const [on, setOn] = useState(false);
  const supportedRef = useRef<boolean>(true);

  const controller = useMemo<TorchController>(() => ({
    setOn: (v) => {
      if (!permission?.granted) {
        requestPermission().then(() => setOn(v)).catch(() => {});
        return;
      }
      setOn(v);
    },
    isOn: on,
    supported: supportedRef.current,
  }), [permission, requestPermission, on]);

  const PortalNode: React.FC = useCallback(() => {
    if (!permission?.granted) return null;
    return (
      <View pointerEvents="none" style={styles.hidden}>
        <CameraView
          style={styles.hidden}
          enableTorch={on}
          facing="back"
        />
      </View>
    );
  }, [permission, on]);

  useEffect(() => {
    // Fire-and-forget permission request on mount for smoother UX.
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission().catch(() => {});
    }
  }, [permission, requestPermission]);

  return { controller, PortalNode };
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    top: -10,
    left: -10,
    opacity: 0,
  },
});
