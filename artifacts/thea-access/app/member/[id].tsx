import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FaceCaptureModal } from "@/components/FaceCaptureModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { ApiError, api } from "@/lib/api";
import { confirmDialog, notify } from "@/lib/dialog";
import { formatDate } from "@/lib/format";
import type { AccessPoint, Face, Grant } from "@/lib/types";

export default function MemberDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { canManage } = useAuth();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [enrolling, setEnrolling] = useState(false);
  const [granting, setGranting] = useState(false);

  const memberKey = ["member", id];
  const grantsKey = ["grants", "member", id];

  const { data: member, isLoading } = useQuery({
    queryKey: memberKey,
    queryFn: () => api.getMember(id),
    enabled: !!id,
  });

  const { data: grants } = useQuery({
    queryKey: grantsKey,
    queryFn: () => api.listGrants({ memberId: id }),
    enabled: !!id,
  });

  const { data: points } = useQuery({
    queryKey: ["points"],
    queryFn: () => api.listPoints(),
    enabled: granting,
  });

  const refreshMember = () => {
    queryClient.invalidateQueries({ queryKey: memberKey });
    queryClient.invalidateQueries({ queryKey: ["members"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.updateMember(id, { status }),
    onSuccess: refreshMember,
    onError: (e) => notify("Update failed", errMsg(e)),
  });

  const consentMutation = useMutation({
    mutationFn: () => api.recordConsent(id),
    onSuccess: refreshMember,
    onError: (e) => notify("Could not record consent", errMsg(e)),
  });

  const enrollMutation = useMutation({
    mutationFn: (base64: string) => api.enrollFace(id, base64),
    onSuccess: () => {
      setEnrolling(false);
      refreshMember();
    },
    onError: (e) => {
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 409) {
        notify("Consent required", "Record biometric consent before enrolling a face.");
      } else if (status === 422) {
        notify("No face detected", "Make sure the face is clearly visible and try again.");
      } else {
        notify("Enrollment failed", errMsg(e));
      }
    },
  });

  const deleteFaceMutation = useMutation({
    mutationFn: (faceId: string) => api.deleteFace(id, faceId),
    onSuccess: refreshMember,
    onError: (e) => notify("Delete failed", errMsg(e)),
  });

  const createGrantMutation = useMutation({
    mutationFn: (accessPointId: string) => api.createGrant({ memberId: id, accessPointId }),
    onSuccess: () => {
      setGranting(false);
      queryClient.invalidateQueries({ queryKey: grantsKey });
    },
    onError: (e) => notify("Could not grant access", errMsg(e)),
  });

  const deleteGrantMutation = useMutation({
    mutationFn: (grantId: string) => api.deleteGrant(grantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: grantsKey }),
    onError: (e) => notify("Could not remove access", errMsg(e)),
  });

  const deleteMemberMutation = useMutation({
    mutationFn: () => api.deleteMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      router.back();
    },
    onError: (e) => notify("Delete failed", errMsg(e)),
  });

  const bottomPad = (Platform.OS === "web" ? 34 : insets.bottom) + 32;

  if (isLoading || !member) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Member" showBack />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const hasConsent = !!member.consentGivenAt;
  const suspended = member.status === "suspended";
  const grantedPointIds = new Set((grants ?? []).map((g) => g.accessPointId));
  const availablePoints = (points ?? []).filter((p) => !grantedPointIds.has(p.id));

  const confirmDeleteMember = async () => {
    const ok = await confirmDialog({
      title: "Delete member",
      message: `Permanently delete ${member.fullName} and all enrolled faces?`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) deleteMemberMutation.mutate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={member.fullName} subtitle={member.email ?? undefined} showBack />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 16 }}>
        {/* Status + details */}
        <Section title="Details" colors={colors}>
          <DetailRow label="Status" colors={colors}>
            <Badge label={suspended ? "Suspended" : "Active"} tone={suspended ? "destructive" : "success"} />
          </DetailRow>
          <DetailRow label="Phone" colors={colors} value={member.phone ?? "—"} />
          <DetailRow label="Added" colors={colors} value={formatDate(member.createdAt)} />
          {member.notes ? <DetailRow label="Notes" colors={colors} value={member.notes} /> : null}
          {canManage ? (
            <Button
              title={suspended ? "Reactivate member" : "Suspend member"}
              variant={suspended ? "primary" : "secondary"}
              icon={suspended ? "check-circle" : "slash"}
              loading={statusMutation.isPending}
              onPress={() => statusMutation.mutate(suspended ? "active" : "suspended")}
              style={{ marginTop: 4 }}
            />
          ) : null}
        </Section>

        {/* Consent */}
        <Section title="Biometric consent" colors={colors}>
          {hasConsent ? (
            <View style={styles.consentOk}>
              <Feather name="check-circle" size={18} color={colors.success} />
              <Text style={[styles.consentOkText, { color: colors.foreground }]}>
                Consent recorded {formatDate(member.consentGivenAt)}
                {member.consentVersion ? ` · ${member.consentVersion}` : ""}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.consentWarn}>
                <Feather name="alert-circle" size={18} color={colors.warning} />
                <Text style={[styles.consentWarnText, { color: colors.foreground }]}>
                  No biometric consent on file. Consent is required before enrolling a face.
                </Text>
              </View>
              {canManage ? (
                <Button
                  title="Record consent"
                  icon="edit-3"
                  loading={consentMutation.isPending}
                  onPress={consentMutation.mutate}
                  style={{ marginTop: 12 }}
                />
              ) : null}
            </>
          )}
        </Section>

        {/* Faces */}
        <Section title={`Enrolled faces (${member.faces.length})`} colors={colors}>
          {member.faces.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No faces enrolled yet.
            </Text>
          ) : (
            member.faces.map((face) => (
              <FaceRow
                key={face.id}
                face={face}
                canManage={canManage}
                onDelete={async () => {
                  const ok = await confirmDialog({
                    title: "Delete face",
                    message: "Remove this enrolled face?",
                    confirmText: "Delete",
                    destructive: true,
                  });
                  if (ok) deleteFaceMutation.mutate(face.id);
                }}
                colors={colors}
              />
            ))
          )}
          {canManage ? (
            <Button
              title="Enroll a face"
              icon="camera"
              variant={hasConsent ? "primary" : "secondary"}
              disabled={!hasConsent}
              onPress={() => setEnrolling(true)}
              style={{ marginTop: 12 }}
              testID="enroll-face"
            />
          ) : null}
          {canManage && !hasConsent ? (
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Record consent above to enable enrollment.
            </Text>
          ) : null}
        </Section>

        {/* Access grants */}
        <Section title="Access" colors={colors}>
          {(grants ?? []).length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No access points granted.
            </Text>
          ) : (
            (grants ?? []).map((grant) => (
              <GrantRow
                key={grant.id}
                grant={grant}
                canManage={canManage}
                onRemove={() => deleteGrantMutation.mutate(grant.id)}
                colors={colors}
              />
            ))
          )}
          {canManage ? (
            <Button
              title="Grant access"
              icon="plus"
              variant="secondary"
              onPress={() => setGranting(true)}
              style={{ marginTop: 12 }}
              testID="grant-access"
            />
          ) : null}
        </Section>

        {/* Danger zone */}
        {canManage ? (
          <Button
            title="Delete member"
            variant="destructive"
            icon="trash-2"
            loading={deleteMemberMutation.isPending}
            onPress={confirmDeleteMember}
            testID="delete-member"
          />
        ) : null}
      </ScrollView>

      <FaceCaptureModal
        visible={enrolling}
        title="Enroll face"
        busy={enrollMutation.isPending}
        onClose={() => setEnrolling(false)}
        onCapture={(base64) => enrollMutation.mutate(base64)}
      />

      <GrantPickerModal
        visible={granting}
        points={availablePoints}
        busy={createGrantMutation.isPending}
        onClose={() => setGranting(false)}
        onSelect={(pointId) => createGrantMutation.mutate(pointId)}
      />
    </View>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong. Try again.";
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  colors,
  children,
}: {
  label: string;
  value?: string;
  colors: ReturnType<typeof useColors>;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {children ?? (
        <Text style={[styles.detailValue, { color: colors.foreground }]} numberOfLines={2}>
          {value}
        </Text>
      )}
    </View>
  );
}

function FaceRow({
  face,
  canManage,
  onDelete,
  colors,
}: {
  face: Face;
  canManage: boolean;
  onDelete: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const quality = face.quality != null ? `${Math.round(face.quality * 100)}% quality` : "Enrolled";
  return (
    <View style={[styles.faceRow, { borderTopColor: colors.border }]}>
      <View style={[styles.faceIcon, { backgroundColor: colors.accent, borderRadius: 10 }]}>
        <Feather name="user-check" size={16} color={colors.accentForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.faceQuality, { color: colors.foreground }]}>{quality}</Text>
        <Text style={[styles.faceDate, { color: colors.mutedForeground }]}>
          {formatDate(face.createdAt)}
        </Text>
      </View>
      {canManage ? (
        <Pressable onPress={onDelete} hitSlop={10} testID={`face-delete-${face.id}`}>
          <Feather name="trash-2" size={18} color={colors.destructive} />
        </Pressable>
      ) : null}
    </View>
  );
}

function GrantRow({
  grant,
  canManage,
  onRemove,
  colors,
}: {
  grant: Grant;
  canManage: boolean;
  onRemove: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.faceRow, { borderTopColor: colors.border }]}>
      <View style={[styles.faceIcon, { backgroundColor: colors.accent, borderRadius: 10 }]}>
        <Feather name="shield" size={16} color={colors.accentForeground} />
      </View>
      <Text style={[styles.grantName, { color: colors.foreground }]} numberOfLines={1}>
        {grant.accessPointName ?? "Access point"}
      </Text>
      {canManage ? (
        <Pressable onPress={onRemove} hitSlop={10} testID={`grant-remove-${grant.id}`}>
          <Feather name="x-circle" size={18} color={colors.destructive} />
        </Pressable>
      ) : null}
    </View>
  );
}

function GrantPickerModal({
  visible,
  points,
  busy,
  onClose,
  onSelect,
}: {
  visible: boolean;
  points: AccessPoint[];
  busy: boolean;
  onClose: () => void;
  onSelect: (pointId: string) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = (Platform.OS === "web" ? 67 : insets.top) + 12;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.modalHeader, { paddingTop: topPad, borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Grant access</Text>
          <Pressable onPress={onClose} hitSlop={12} testID="grant-picker-close">
            <Feather name="x" size={24} color={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {points.length === 0 ? (
            <EmptyState
              icon="shield"
              title="No available access points"
              subtitle="This member already has access to every point, or none exist yet."
            />
          ) : (
            points.map((p) => (
              <Pressable
                key={p.id}
                disabled={busy}
                onPress={() => onSelect(p.id)}
                style={({ pressed }) => [
                  styles.pickRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: busy ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
                testID={`grant-pick-${p.id}`}
              >
                <View style={[styles.faceIcon, { backgroundColor: colors.accent, borderRadius: 10 }]}>
                  <Feather name="shield" size={16} color={colors.accentForeground} />
                </View>
                <Text style={[styles.grantName, { color: colors.foreground }]} numberOfLines={1}>
                  {p.name}
                </Text>
                <Feather name="plus-circle" size={20} color={colors.primary} />
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: { borderWidth: 1, padding: 16 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    gap: 16,
  },
  detailLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  detailValue: { fontFamily: "Inter_500Medium", fontSize: 14, flexShrink: 1, textAlign: "right" },
  consentOk: { flexDirection: "row", alignItems: "center", gap: 10 },
  consentOkText: { fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 },
  consentWarn: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  consentWarnText: { fontFamily: "Inter_400Regular", fontSize: 14, flex: 1, lineHeight: 20 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 4 },
  hintText: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 8, textAlign: "center" },
  faceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  faceIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  faceQuality: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  faceDate: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  grantName: { fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
});
