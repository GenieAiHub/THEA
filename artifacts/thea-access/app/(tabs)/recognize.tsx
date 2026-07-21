import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useRef, useState } from "react";
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
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { ApiError, api, type RecognitionResult } from "@/lib/api";
import { captureRecognizeBase64, imageUriToRecognizeBase64 } from "@/lib/camera";

export default function RecognizeScreen() {
  const colors = useColors();
  const { org } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (base64: string | null) => {
    if (!base64) {
      setAnalyzing(false);
      setError("Could not read the photo. Try again.");
      return;
    }
    setPhotoBase64(base64);
    setResult(null);
    setError(null);
    try {
      const res = await api.recognize(base64);
      setResult(res);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : "Recognition failed. Try again.";
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const snap = async () => {
    if (!cameraRef.current || analyzing) return;
    setAnalyzing(true);
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await analyze(await captureRecognizeBase64(cameraRef.current));
    } catch {
      setError("Could not capture the photo. Try again.");
      setAnalyzing(false);
    }
  };

  const pickFromLibrary = async () => {
    if (analyzing) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsMultipleSelection: false,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    setAnalyzing(true);
    try {
      await analyze(await imageUriToRecognizeBase64(picked.assets[0].uri));
    } catch {
      setError("Could not read that image. Try another one.");
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setPhotoBase64(null);
    setResult(null);
    setError(null);
  };

  const showingResults = photoBase64 !== null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Recognize"
        subtitle={org?.name ?? "Identify objects, people & plates"}
      />

      {showingResults ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.resultsContent}
        >
          <View style={[styles.previewWrap, { borderRadius: colors.radius * 1.5 }]}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${photoBase64}` }}
              style={styles.preview}
              contentFit="cover"
            />
            {analyzing ? (
              <View style={styles.previewOverlay}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={styles.previewOverlayText}>Analyzing photo…</Text>
              </View>
            ) : null}
          </View>

          {error ? (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderRadius: colors.radius },
              ]}
            >
              <View style={styles.cardHeader}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.cardTitle, { color: colors.destructive }]}>
                  Recognition failed
                </Text>
              </View>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {error}
              </Text>
            </View>
          ) : null}

          {result ? <Results result={result} /> : null}

          <Button title="Scan another photo" icon="camera" onPress={reset} testID="recognize-reset" />
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
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
                    Camera access is required to recognize what's around you. You
                    can also pick a photo from your library below.
                  </Text>
                  <Button title="Grant camera access" onPress={requestPermission} />
                </View>
              ) : (
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing="back"
                />
              )}
            </View>
          </View>

          <View style={styles.controls}>
            {permission?.granted ? (
              <Button
                title={analyzing ? "Analyzing…" : "Capture & recognize"}
                icon="eye"
                onPress={snap}
                loading={analyzing}
                testID="recognize-capture"
              />
            ) : null}
            <Pressable
              onPress={pickFromLibrary}
              disabled={analyzing}
              style={[
                styles.libraryBtn,
                { backgroundColor: colors.secondary, borderRadius: colors.radius },
              ]}
              testID="recognize-pick"
            >
              <Feather name="image" size={16} color={colors.secondaryForeground} />
              <Text style={[styles.libraryText, { color: colors.secondaryForeground }]}>
                Choose from library
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function Results({ result }: { result: RecognitionResult }) {
  const colors = useColors();
  const matchedFaces = result.faces.filter((f) => f.member);
  const unknownFaces = result.faces.length - matchedFaces.length;
  const nothingFound =
    result.objects.length === 0 &&
    result.faces.length === 0 &&
    result.plates.length === 0 &&
    result.targetMatches.length === 0;

  if (nothingFound) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderRadius: colors.radius },
        ]}
      >
        <View style={styles.cardHeader}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Nothing recognized
          </Text>
        </View>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          No objects, faces or plates were detected in this photo. Try a closer,
          well-lit shot.
        </Text>
      </View>
    );
  }

  return (
    <>
      {result.targetMatches.length > 0 ? (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: colors.destructive,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Feather name="alert-triangle" size={16} color={colors.destructive} />
            <Text style={[styles.cardTitle, { color: colors.destructive }]}>
              Watch target matches
            </Text>
          </View>
          {result.targetMatches.map((m) => (
            <View key={`${m.targetId}-${m.matchType}`} style={styles.row}>
              <Feather
                name={m.matchType === "face" ? "user" : m.matchType === "plate" ? "hash" : "box"}
                size={15}
                color={colors.destructive}
              />
              <Text style={[styles.rowText, { color: colors.foreground }]} numberOfLines={1}>
                {m.name}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                {m.detail ?? m.matchType} · {(m.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {result.faces.length > 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderRadius: colors.radius },
          ]}
        >
          <View style={styles.cardHeader}>
            <Feather name="users" size={16} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              People
            </Text>
          </View>
          {matchedFaces.map((f, i) => (
            <View key={`m-${i}`} style={styles.row}>
              <Feather name="user-check" size={15} color={colors.success} />
              <Text style={[styles.rowText, { color: colors.foreground }]} numberOfLines={1}>
                {f.member!.fullName}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                member{f.distance != null ? ` · d ${f.distance.toFixed(2)}` : ""}
              </Text>
            </View>
          ))}
          {unknownFaces > 0 ? (
            <View style={styles.row}>
              <Feather name="user-x" size={15} color={colors.mutedForeground} />
              <Text style={[styles.rowText, { color: colors.mutedForeground }]}>
                {unknownFaces === 1
                  ? "1 unrecognized face"
                  : `${unknownFaces} unrecognized faces`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {result.plates.length > 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderRadius: colors.radius },
          ]}
        >
          <View style={styles.cardHeader}>
            <Feather name="hash" size={16} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              License plates
            </Text>
          </View>
          {result.plates.map((p, i) => (
            <View key={`${p.text}-${i}`} style={styles.row}>
              <Feather name="credit-card" size={15} color={colors.mutedForeground} />
              <Text style={[styles.plateText, { color: colors.foreground }]}>
                {p.text}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                {(p.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {result.objects.length > 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderRadius: colors.radius },
          ]}
        >
          <View style={styles.cardHeader}>
            <Feather name="box" size={16} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Objects
            </Text>
          </View>
          <View style={styles.chipWrap}>
            {result.objects.map((o, i) => (
              <View
                key={`${o.class}-${i}`}
                style={[styles.objChip, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.objChipText, { color: colors.secondaryForeground }]}>
                  {o.class} {(o.score * 100).toFixed(0)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  cameraArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
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
  controls: {
    padding: 16,
    gap: 10,
  },
  libraryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  libraryText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  resultsContent: {
    padding: 16,
    gap: 12,
  },
  previewWrap: {
    height: 240,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  preview: { ...StyleSheet.absoluteFillObject },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  previewOverlayText: {
    color: "#fff",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  card: {
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowText: { fontFamily: "Inter_500Medium", fontSize: 14, flexShrink: 1 },
  rowMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: "auto" },
  plateText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 1.5,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  objChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  objChipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
});
