import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Tone = "neutral" | "success" | "destructive" | "warning" | "accent";

interface BadgeProps {
  label: string;
  tone?: Tone;
}

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const colors = useColors();

  const map: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: colors.muted, fg: colors.mutedForeground },
    success: { bg: colors.success, fg: colors.successForeground },
    destructive: { bg: colors.destructive, fg: colors.destructiveForeground },
    warning: { bg: colors.warning, fg: colors.warningForeground },
    accent: { bg: colors.accent, fg: colors.accentForeground },
  };
  const c = map[tone];

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  text: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
});
