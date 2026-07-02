import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
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
import { timeAgo } from "@/lib/format";
import { reasonLabel, type AccessEvent } from "@/lib/types";

export default function EventsScreen() {
  const colors = useColors();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.listEvents(),
  });

  const events = data ?? [];
  const bottomPad = (Platform.OS === "web" ? 84 : 90) + 16;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Activity" subtitle="Recent access decisions" />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="activity"
              title="No activity yet"
              subtitle="Access decisions from the Scan tab will appear here."
            />
          }
          renderItem={({ item }) => <EventRow event={item} />}
        />
      )}
    </View>
  );
}

function EventRow({ event }: { event: AccessEvent }) {
  const colors = useColors();
  const granted = event.decision === "granted";
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
    >
      <View
        style={[
          styles.stripe,
          { backgroundColor: granted ? colors.success : colors.destructive },
        ]}
      />
      <View style={styles.body}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {event.memberName ?? "Unknown person"}
          </Text>
          <Badge label={granted ? "Granted" : "Denied"} tone={granted ? "success" : "destructive"} />
        </View>
        <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {(event.accessPointName ?? "Unknown point") + " · " + reasonLabel(event.reason)}
        </Text>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {timeAgo(event.createdAt)}
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
  body: { flex: 1, padding: 14, gap: 4 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: { fontFamily: "Inter_600SemiBold", fontSize: 16, flex: 1 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 13 },
  time: { fontFamily: "Inter_400Regular", fontSize: 12 },
});
