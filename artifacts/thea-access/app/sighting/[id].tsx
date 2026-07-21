import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { useColors } from "@/hooks/useColors";
import { api, sightingSnapshotSource } from "@/lib/api";

type Colors = ReturnType<typeof useColors>;

export default function SightingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: sighting, isLoading, isError } = useQuery({
    queryKey: ["sighting", id],
    queryFn: () => api.getSighting(id!),
    enabled: Boolean(id),
  });

  const topPad = (Platform.OS === "web" ? 67 : insets.top) + 12;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={goBack} hitSlop={12} testID="sighting-back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Sighting
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError || !sighting ? (
        <EmptyState
          icon="alert-circle"
          title="Sighting not found"
          subtitle="It may have been deleted, or you may not have access to it."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 40,
          }}
        >
          {sighting.hasSnapshot ? (
            <Image
              source={sightingSnapshotSource(sighting.id)}
              style={[
                styles.snapshot,
                { borderColor: colors.border, borderRadius: colors.radius },
              ]}
              resizeMode="cover"
              testID="sighting-snapshot"
            />
          ) : (
            <View
              style={[
                styles.snapshot,
                styles.snapshotPlaceholder,
                {
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Feather name="camera-off" size={28} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>
                No snapshot available
              </Text>
            </View>
          )}

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Row label="Target" value={sighting.targetName ?? "Unknown"} colors={colors} />
            <Divider colors={colors} />
            <Row
              label="Type"
              value={sighting.targetType ? capitalize(sighting.targetType) : "—"}
              colors={colors}
            />
            <Divider colors={colors} />
            <Row
              label="Source"
              value={
                sighting.cameraName
                  ? `${sighting.cameraName}${sighting.cameraLocation ? ` (${sighting.cameraLocation})` : ""}`
                  : "Uploaded video"
              }
              colors={colors}
            />
            <Divider colors={colors} />
            <Row label="Match" value={matchLabel(sighting.matchType, sighting.detail)} colors={colors} />
            <Divider colors={colors} />
            <Row
              label="Confidence"
              value={
                sighting.confidence != null
                  ? `${Math.round(sighting.confidence * 100)}%`
                  : "—"
              }
              colors={colors}
            />
            <Divider colors={colors} />
            <Row label="Seen at" value={formatDate(sighting.createdAt)} colors={colors} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function matchLabel(matchType: string, detail: string | null): string {
  const base = capitalize(matchType.replace(/[_-]/g, " "));
  return detail ? `${base} (${detail})` : base;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function Row({ label, value, colors }: { label: string; value: string; colors: Colors }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Divider({ colors }: { colors: Colors }) {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  snapshot: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderWidth: 1,
    marginBottom: 16,
  },
  snapshotPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  card: {
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 16,
  },
  rowLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  rowValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    flexShrink: 1,
    textAlign: "right",
  },
});
