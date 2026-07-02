import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface HeaderAction {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  testID?: string;
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: HeaderAction;
}

export function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  rightAction,
}: ScreenHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = (Platform.OS === "web" ? 67 : insets.top) + 8;

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: topPad,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={styles.backBtn}
              testID="header-back"
            >
              <Feather name="chevron-left" size={26} color={colors.foreground} />
            </Pressable>
          ) : null}
          <View style={styles.titles}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: colors.foreground }]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={1}
                style={[styles.subtitle, { color: colors.mutedForeground }]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {rightAction ? (
          <Pressable
            onPress={rightAction.onPress}
            hitSlop={12}
            testID={rightAction.testID}
            style={({ pressed }) => [
              styles.action,
              {
                backgroundColor: colors.secondary,
                borderRadius: colors.radius,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name={rightAction.icon} size={20} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 4,
  },
  backBtn: {
    marginLeft: -6,
  },
  titles: {
    flex: 1,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  action: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
});
