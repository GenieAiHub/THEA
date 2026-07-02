import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { ApiError, api } from "@/lib/api";
import { captureFaceBase64 } from "@/lib/camera";
import { reasonLabel, type IdentifyResult } from "@/lib/types";

export default function ScanScreen() {
  const colors = useColors();
  const { org, logout } = useAuth();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);

  const { data: points } = useQuery({
    queryKey: ["points"],
    queryFn: () => api.listPoints(),
  });
  const activePoints = (points ?? []).filter((p) => p.isActive);

  useEffect(() => {
    if (!selectedPointId && activePoints.length > 0) {
      setSelectedPointId(activePoints[0].id);
    }
    if (selectedPointId && !activePoints.some((p) => p.id === selectedPointId)) {
      setSelectedPointId(activePoints[0]?.id ?? null);
    }
  }, [activePoints, selectedPointId]);

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 4500);
    return () => clearTimeout(t);
  }, [result]);

  const scan = async () => {
    if (!cameraRef.current || !selectedPointId || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const base64 = await captureFaceBase64(cameraRef.current);
      if (!base64) {
        setSubmitting(false);
        return;
      }
      const res = await api.identify(base64, selectedPointId);
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(
          res.decision === "granted"
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error,
        );
      }
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Scan failed. Try again.";
      setResult({
        decision: "denied",
        reason: message,
        member: null,
        distance: null,
        accessPoint: {
          id: selectedPointId,
          name: activePoints.find((p) => p.id === selectedPointId)?.name ?? "",
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Scan"
        subtitle={org?.name ?? "Face access control"}
        rightAction={{ icon: "log-out", onPress: logout, testID: "scan-logout" }}
      />

      {activePoints.length === 0 ? (
        <EmptyState
          icon="shield-off"
          title="No active access points"
          subtitle="Add and activate an access point in the Access tab before scanning."
        />
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {activePoints.map((p) => {
              const active = p.id === selectedPointId;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedPointId(p.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.secondary,
                      borderRadius: 999,
                    },
                  ]}
                >
                  <Feather
                    name="map-pin"
                    size={14}
                    color={active ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: active
                          ? colors.primaryForeground
                          : colors.secondaryForeground,
                      },
                    ]}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.cameraArea}>
            <View style={[styles.cameraWrap, { borderRadius: colors.radius * 1.5 }]}>
              {!permission ? (
                <View style={styles.cameraCenter}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : !permission.granted ? (
                <View style={styles.cameraCenter}>
                  <Feather name="camera-off" size={38} color="#fff" />
                  <Text style={styles.permText}>
                    Camera access is required to scan faces.
                  </Text>
                  <Button title="Grant camera access" onPress={requestPermission} />
                </View>
              ) : (
                <>
                  <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing="front"
                  />
                  <View style={styles.frameOverlay} pointerEvents="none">
                    <View style={[styles.frame, { borderColor: colors.primary }]} />
                  </View>
                </>
              )}

              {result ? <ResultOverlay result={result} onDismiss={() => setResult(null)} /> : null}
            </View>
          </View>

          {permission?.granted ? (
            <View style={styles.controls}>
              <Button
                title={submitting ? "Scanning…" : "Scan face"}
                icon="camera"
                onPress={scan}
                loading={submitting}
                disabled={!selectedPointId}
                testID="scan-capture"
              />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function ResultOverlay({
  result,
  onDismiss,
}: {
  result: IdentifyResult;
  onDismiss: () => void;
}) {
  const colors = useColors();
  const granted = result.decision === "granted";
  const tone = granted ? colors.success : colors.destructive;

  return (
    <Pressable style={styles.resultOverlay} onPress={onDismiss}>
      <View
        style={[
          styles.resultCard,
          { backgroundColor: colors.card, borderRadius: colors.radius * 1.4 },
        ]}
      >
        <View style={[styles.resultIcon, { backgroundColor: tone }]}>
          <Feather name={granted ? "check" : "x"} size={40} color="#fff" />
        </View>
        <Text style={[styles.resultTitle, { color: tone }]}>
          {granted ? "Access granted" : "Access denied"}
        </Text>
        <Text style={[styles.resultName, { color: colors.foreground }]}>
          {result.member?.fullName ?? "Unrecognized"}
        </Text>
        <Text style={[styles.resultReason, { color: colors.mutedForeground }]}>
          {reasonLabel(result.reason)} · {result.accessPoint.name}
        </Text>
        <Text style={[styles.resultHint, { color: colors.mutedForeground }]}>
          Tap to scan again
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  cameraArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cameraWrap: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  cameraCenter: {
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
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: 220,
    height: 280,
    borderWidth: 3,
    borderRadius: 130,
  },
  controls: {
    padding: 16,
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  resultCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    padding: 28,
    gap: 6,
  },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  resultTitle: { fontFamily: "Inter_700Bold", fontSize: 22 },
  resultName: { fontFamily: "Inter_600SemiBold", fontSize: 18, marginTop: 2 },
  resultReason: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginTop: 2,
  },
  resultHint: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 12 },
});
