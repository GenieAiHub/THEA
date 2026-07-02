import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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
import type { Member } from "@/lib/types";

export default function MembersScreen() {
  const colors = useColors();
  const router = useRouter();
  const { canManage } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.listMembers(),
  });

  const members = data ?? [];
  const bottomPad = (Platform.OS === "web" ? 84 : 90) + 16;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Members"
        subtitle="People who can be granted access"
        rightAction={
          canManage
            ? { icon: "plus", onPress: () => setAdding(true), testID: "member-add" }
            : undefined
        }
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={members}
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
              icon="users"
              title="No members yet"
              subtitle={
                canManage
                  ? "Add your first member to start enrolling faces."
                  : "No members have been added yet."
              }
            />
          }
          renderItem={({ item }) => (
            <MemberRow member={item} onPress={() => router.push(`/member/${item.id}`)} />
          )}
        />
      )}

      <AddMemberModal
        visible={adding}
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
          queryClient.invalidateQueries({ queryKey: ["members"] });
        }}
      />
    </View>
  );
}

function MemberRow({ member, onPress }: { member: Member; onPress: () => void }) {
  const colors = useColors();
  const suspended = member.status === "suspended";
  const hasConsent = !!member.consentGivenAt;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: colors.accent, borderRadius: colors.radius },
        ]}
      >
        <Feather name="user" size={20} color={colors.accentForeground} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
          {member.fullName}
        </Text>
        <View style={styles.metaRow}>
          <Feather name="camera" size={12} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {member.faceCount ?? 0} {member.faceCount === 1 ? "face" : "faces"}
          </Text>
          <Feather
            name={hasConsent ? "check-circle" : "alert-circle"}
            size={12}
            color={hasConsent ? colors.success : colors.warning}
          />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {hasConsent ? "Consent on file" : "No consent"}
          </Text>
        </View>
      </View>
      {suspended ? <Badge label="Suspended" tone="destructive" /> : null}
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

function AddMemberModal({
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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setConsent(false);
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.createMember({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        consentGiven: consent,
      }),
    onSuccess: () => {
      reset();
      onCreated();
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Could not create member."),
  });

  const submit = () => {
    setError(null);
    if (!fullName.trim()) {
      setError("A full name is required.");
      return;
    }
    mutation.mutate();
  };

  const topPad = (Platform.OS === "web" ? 67 : insets.top) + 12;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.modalHeader, { paddingTop: topPad, borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>New member</Text>
          <Pressable onPress={onClose} hitSlop={12} testID="add-member-close">
            <Feather name="x" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Alex Morgan" autoCapitalize="words" testID="add-member-name" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="alex@example.com" autoCapitalize="none" keyboardType="email-address" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Optional" keyboardType="phone-pad" />
          <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />

          <View style={[styles.consentBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.consentRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.consentTitle, { color: colors.foreground }]}>
                  Biometric consent given
                </Text>
                <Text style={[styles.consentText, { color: colors.mutedForeground }]}>
                  Confirm this person consented to face enrollment at the time of joining. Required before enrolling any face.
                </Text>
              </View>
              <Switch
                value={consent}
                onValueChange={setConsent}
                trackColor={{ true: colors.primary, false: colors.border }}
                testID="add-member-consent"
              />
            </View>
          </View>

          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

          <Button title="Add member" onPress={submit} loading={mutation.isPending} testID="add-member-submit" />
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
  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 4 },
  cardName: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 12, marginRight: 6 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  consentBox: { borderWidth: 1, padding: 16 },
  consentRow: { flexDirection: "row", alignItems: "center" },
  consentTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  consentText: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4, lineHeight: 18 },
  error: { fontFamily: "Inter_500Medium", fontSize: 14 },
});
