import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { ApiError, api } from "@/lib/api";
import { confirmDialog, notify } from "@/lib/dialog";
import type { AccessPoint } from "@/lib/types";

export default function AccessScreen() {
  const colors = useColors();
  const { canManage } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["points"],
    queryFn: () => api.listPoints(),
  });
  const points = data ?? [];
  const bottomPad = (Platform.OS === "web" ? 84 : 90) + 16;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["points"] });

  const toggleMutation = useMutation({
    mutationFn: (p: AccessPoint) => api.updatePoint(p.id, { isActive: !p.isActive }),
    onSuccess: invalidate,
    onError: (e) =>
      notify("Update failed", e instanceof ApiError ? e.message : "Try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePoint(id),
    onSuccess: invalidate,
    onError: (e) =>
      notify("Delete failed", e instanceof ApiError ? e.message : "Try again."),
  });

  const confirmDelete = async (p: AccessPoint) => {
    const ok = await confirmDialog({
      title: "Delete access point",
      message: `Remove "${p.name}"? This cannot be undone.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) deleteMutation.mutate(p.id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Access"
        subtitle="Doors, gates and areas"
        rightAction={
          canManage
            ? { icon: "plus", onPress: () => setAdding(true), testID: "point-add" }
            : undefined
        }
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={points}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 10 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="shield"
              title="No access points"
              subtitle={
                canManage
                  ? "Create an access point such as a door, gate or room."
                  : "No access points have been created yet."
              }
            />
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
              ]}
            >
              <View
                style={[styles.icon, { backgroundColor: colors.accent, borderRadius: colors.radius }]}
              >
                <Feather name="shield" size={20} color={colors.accentForeground} />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.description ? (
                  <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : (
                  <Badge label={item.isActive ? "Active" : "Inactive"} tone={item.isActive ? "success" : "neutral"} />
                )}
              </View>

              {canManage ? (
                <View style={styles.cardActions}>
                  <Switch
                    value={item.isActive}
                    onValueChange={() => toggleMutation.mutate(item)}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    testID={`point-toggle-${item.id}`}
                  />
                  <Pressable onPress={() => confirmDelete(item)} hitSlop={10} testID={`point-delete-${item.id}`}>
                    <Feather name="trash-2" size={18} color={colors.destructive} />
                  </Pressable>
                </View>
              ) : (
                <Badge label={item.isActive ? "Active" : "Inactive"} tone={item.isActive ? "success" : "neutral"} />
              )}
            </View>
          )}
        />
      )}

      <AddPointModal
        visible={adding}
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
          invalidate();
        }}
      />
    </View>
  );
}

function AddPointModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.createPoint({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      setName("");
      setDescription("");
      setError(null);
      onCreated();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not create."),
  });

  const submit = () => {
    setError(null);
    if (!name.trim()) {
      setError("A name is required.");
      return;
    }
    mutation.mutate();
  };

  const topPad = (Platform.OS === "web" ? 67 : insets.top) + 12;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.modalHeader, { paddingTop: topPad, borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>New access point</Text>
          <Pressable onPress={onClose} hitSlop={12} testID="add-point-close">
            <Feather name="x" size={24} color={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Field label="Name" value={name} onChangeText={setName} placeholder="Front entrance" autoCapitalize="words" testID="add-point-name" />
          <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optional" multiline />
          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
          <Button title="Create access point" onPress={submit} loading={mutation.isPending} testID="add-point-submit" />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, gap: 4 },
  cardName: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 13 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  error: { fontFamily: "Inter_500Medium", fontSize: 14 },
});
