import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";
import {
  alertDescription,
  alertTitle,
  alertTypeMeta,
  isSovAlert,
  sovOvertakenText,
  sovShiftText,
} from "@/lib/alertPresentation";
import { timeAgo } from "@/lib/format";
import type { OrgAlert } from "@/lib/types";

export default function AlertsScreen() {
  const colors = useColors();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["org-alerts"],
    queryFn: () => api.listAlerts(),
  });

  const alerts = data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Alerts" subtitle="Intelligence alerts for your organisation" showBack />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bell"
              title="No alerts"
              subtitle="Spike, AI narrative and share-of-voice alerts will appear here."
            />
          }
          renderItem={({ item }) => <AlertRow alert={item} />}
        />
      )}
    </View>
  );
}

function severityTone(severity: string): "destructive" | "warning" | "neutral" {
  if (severity === "critical") return "destructive";
  if (severity === "high") return "warning";
  return "neutral";
}

function AlertRow({ alert }: { alert: OrgAlert }) {
  const colors = useColors();
  const meta = alertTypeMeta(alert);
  const description = alertDescription(alert);
  const sov = isSovAlert(alert);
  const shift = sov ? sovShiftText(alert) : null;
  const overtaken = sov ? sovOvertakenText(alert) : null;
  const stripeColor =
    alert.severity === "critical"
      ? colors.destructive
      : alert.severity === "high"
        ? colors.warning
        : colors.primary;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
      testID={`alert-${alert.id}`}
    >
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />
      <View style={styles.body}>
        <View style={styles.rowTop}>
          <View style={styles.typeWrap}>
            <Feather name={meta.icon} size={14} color={colors.mutedForeground} />
            <Text style={[styles.typeLabel, { color: colors.mutedForeground }]}>
              {meta.label}
            </Text>
          </View>
          <Badge label={alert.severity} tone={severityTone(alert.severity)} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {alertTitle(alert)}
        </Text>
        {sov && (shift || overtaken) ? (
          <View style={styles.sovRow}>
            {shift ? (
              <View
                style={[
                  styles.sovChip,
                  { backgroundColor: colors.muted, borderRadius: 999 },
                ]}
              >
                <Text style={[styles.sovChipText, { color: colors.foreground }]}>
                  {shift}
                </Text>
              </View>
            ) : null}
            {overtaken ? (
              <View
                style={[
                  styles.sovChip,
                  { backgroundColor: colors.muted, borderRadius: 999 },
                ]}
              >
                <Text style={[styles.sovChipText, { color: colors.foreground }]}>
                  {overtaken}
                </Text>
              </View>
            ) : null}
          </View>
        ) : description ? (
          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {timeAgo(alert.createdAt)}
          {alert.status !== "open" && alert.status !== "new" ? ` · ${alert.status}` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    flexDirection: "row",
    borderWidth: 1,
    overflow: "hidden",
  },
  stripe: { width: 4 },
  body: { flex: 1, padding: 14, gap: 6 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  typeWrap: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  typeLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 15, lineHeight: 20 },
  sovRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sovChip: { paddingHorizontal: 10, paddingVertical: 4 },
  sovChipText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  time: { fontFamily: "Inter_400Regular", fontSize: 12 },
});
