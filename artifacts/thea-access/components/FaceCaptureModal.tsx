import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { useColors } from "@/hooks/useColors";
import { captureFaceBase64 } from "@/lib/camera";

interface FaceCaptureModalProps {
  visible: boolean;
  title: string;
  busy?: boolean;
  onClose: () => void;
  onCapture: (base64: string) => void;
}

export function FaceCaptureModal({
  visible,
  title,
  busy = false,
  onClose,
  onCapture,
}: FaceCaptureModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);

  const handleCapture = async () => {
    if (!cameraRef.current || capturing || busy) return;
    setCapturing(true);
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const base64 = await captureFaceBase64(cameraRef.current);
      if (base64) onCapture(base64);
    } finally {
      setCapturing(false);
    }
  };

  const topPad = (Platform.OS === "web" ? 67 : insets.top) + 8;
  const bottomPad = (Platform.OS === "web" ? 34 : insets.bottom) + 24;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        <View style={[styles.topBar, { paddingTop: topPad }]}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} testID="capture-close">
            <Feather name="x" size={26} color="#fff" />
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Feather name="camera-off" size={40} color="#fff" />
            <Text style={styles.permText}>Camera access is required to capture a face.</Text>
            <Button title="Grant camera access" onPress={requestPermission} />
          </View>
        ) : (
          <>
            <View style={styles.cameraWrap}>
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
              <View style={styles.overlay} pointerEvents="none">
                <View style={[styles.frame, { borderColor: colors.primary }]} />
                <Text style={styles.hint}>Center the face inside the frame</Text>
              </View>
              {(capturing || busy) && (
                <View style={styles.processing} pointerEvents="none">
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={styles.processingText}>Processing…</Text>
                </View>
              )}
            </View>

            <View style={[styles.controls, { paddingBottom: bottomPad }]}>
              <Pressable
                onPress={handleCapture}
                disabled={capturing || busy}
                testID="capture-shutter"
                style={({ pressed }) => [
                  styles.shutter,
                  {
                    borderColor: colors.primary,
                    opacity: capturing || busy ? 0.5 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={[styles.shutterInner, { backgroundColor: colors.primary }]} />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  permText: {
    color: "#fff",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  cameraWrap: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  frame: {
    width: 240,
    height: 300,
    borderWidth: 3,
    borderRadius: 140,
  },
  hint: {
    color: "#fff",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  processing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    gap: 12,
  },
  processingText: {
    color: "#fff",
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  controls: {
    alignItems: "center",
    paddingTop: 20,
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
});
