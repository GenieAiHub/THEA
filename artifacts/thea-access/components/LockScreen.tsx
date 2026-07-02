import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

/**
 * Shown when a stored session is gated behind biometric unlock. Auto-prompts
 * once on mount and offers a manual retry plus a sign-out escape hatch.
 */
export function LockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { unlock, logout, biometricLabel } = useAuth();
  const [busy, setBusy] = useState(false);
  const attempted = useRef(false);

  const tryUnlock = async () => {
    if (busy) return;
    setBusy(true);
    await unlock();
    setBusy(false);
  };

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.center}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: colors.primary,
              borderRadius: colors.radius * 1.6,
            },
          ]}
        >
          <Feather name="lock" size={30} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          THEA is locked
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Unlock with {biometricLabel} to continue.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          title={`Unlock with ${biometricLabel}`}
          icon="unlock"
          onPress={tryUnlock}
          loading={busy}
          testID="lock-unlock"
        />
        <Button
          title="Sign out"
          variant="ghost"
          onPress={logout}
          testID="lock-signout"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  badge: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  actions: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    gap: 12,
  },
});
