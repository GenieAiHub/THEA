import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";
import { notify } from "@/lib/dialog";
import { registerForSightingPush } from "@/lib/push";

type Colors = ReturnType<typeof useColors>;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    user,
    org,
    biometricSupported,
    biometricEnabled,
    biometricLabel,
    enableBiometric,
    disableBiometric,
    logout,
  } = useAuth();
  const [working, setWorking] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushWorking, setPushWorking] = useState(false);
  const pushSupported = Platform.OS !== "web";

  useEffect(() => {
    let cancelled = false;
    api
      .getPushPreferences()
      .then((prefs) => {
        if (!cancelled) setPushEnabled(prefs.sightingAlerts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const onTogglePush = async (next: boolean) => {
    if (pushWorking) return;
    setPushWorking(true);
    try {
      if (next) {
        const token = await registerForSightingPush();
        if (!token) {
          notify(
            "Notifications unavailable",
            "We couldn't enable push notifications. Check that notifications are allowed for THEA in your device settings.",
          );
          return;
        }
      }
      await api.setPushPreferences(next);
      setPushEnabled(next);
    } catch {
      notify("Something went wrong", "Couldn't update your notification setting. Please try again.");
    } finally {
      setPushWorking(false);
    }
  };

  const topPad = (Platform.OS === "web" ? 67 : insets.top) + 16;
  const labelCap = biometricLabel
    ? biometricLabel.charAt(0).toUpperCase() + biometricLabel.slice(1)
    : "Biometric";

  const onToggleBiometric = async (next: boolean) => {
    if (working) return;
    setWorking(true);
    try {
      if (next) {
        const ok = await enableBiometric();
        if (!ok) {
          Alert.alert(
            "Couldn't enable",
            `We couldn't turn on ${biometricLabel}. Make sure it's set up on your device, then try again.`,
          );
        }
      } else {
        await disableBiometric();
      }
    } finally {
      setWorking(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert("Sign out", "You'll need to sign in again to use THEA.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void logout() },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: insets.bottom + 120 },
      ]}
    >
      <Text style={[styles.heading, { color: colors.foreground }]}>Settings</Text>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        ACCOUNT
      </Text>
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
        <Row label="Name" value={user?.name || "—"} colors={colors} />
        <Divider colors={colors} />
        <Row label="Email" value={user?.email || "—"} colors={colors} />
        <Divider colors={colors} />
        <Row label="Organization" value={org?.name || "—"} colors={colors} />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        SECURITY
      </Text>
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
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <View style={styles.switchTitleRow}>
              <Feather name="shield" size={16} color={colors.primary} />
              <Text style={[styles.switchTitle, { color: colors.foreground }]}>
                {labelCap} unlock
              </Text>
            </View>
            <Text style={[styles.switchHint, { color: colors.mutedForeground }]}>
              {biometricSupported
                ? `Require ${biometricLabel} each time you open THEA.`
                : "Not available on this device."}
            </Text>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={onToggleBiometric}
            disabled={!biometricSupported || working}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={
              Platform.OS === "android"
                ? biometricEnabled
                  ? colors.primaryForeground
                  : colors.card
                : undefined
            }
            testID="settings-biometric-toggle"
          />
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        NOTIFICATIONS
      </Text>
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
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <View style={styles.switchTitleRow}>
              <Feather name="bell" size={16} color={colors.primary} />
              <Text style={[styles.switchTitle, { color: colors.foreground }]}>
                Sighting alerts
              </Text>
            </View>
            <Text style={[styles.switchHint, { color: colors.mutedForeground }]}>
              {pushSupported
                ? "Get a push notification when Security Watch spots a target."
                : "Available in the mobile app only."}
            </Text>
          </View>
          <Switch
            value={pushSupported && pushEnabled}
            onValueChange={onTogglePush}
            disabled={!pushSupported || pushWorking}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={
              Platform.OS === "android"
                ? pushEnabled
                  ? colors.primaryForeground
                  : colors.card
                : undefined
            }
            testID="settings-push-toggle"
          />
        </View>
      </View>

      <View style={{ height: 24 }} />
      <Button
        title="Sign out"
        variant="destructive"
        icon="log-out"
        onPress={confirmLogout}
        testID="settings-signout"
      />
    </ScrollView>
  );
}

function Row({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: Colors;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text
        style={[styles.rowValue, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function Divider({ colors }: { colors: Colors }) {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
  },
  heading: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 8,
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 16,
  },
  switchTextWrap: {
    flex: 1,
    gap: 4,
  },
  switchTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switchTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  switchHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
});
