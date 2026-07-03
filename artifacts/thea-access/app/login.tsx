import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { ApiError } from "@/lib/api";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (isRegister && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email.trim(), password, name);
      } else {
        await login(email.trim(), password);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      setSubmitting(false);
    }
  };

  const topPad = (Platform.OS === "web" ? 67 : insets.top) + 24;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require("../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: colors.foreground }]}>THEA Access</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {isRegister
            ? "Create an organization to manage face-based access."
            : "Sign in to scan and manage access."}
        </Text>

        <View style={styles.form}>
          {isRegister ? (
            <Field
              label="Your name"
              value={name}
              onChangeText={setName}
              placeholder="Jordan Lee"
              autoCapitalize="words"
              testID="login-name"
            />
          ) : null}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            autoCapitalize="none"
            keyboardType="email-address"
            testID="login-email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={isRegister ? "At least 8 characters" : "Your password"}
            autoCapitalize="none"
            secureTextEntry
            testID="login-password"
          />

          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
          ) : null}

          <Button
            title={isRegister ? "Create account" : "Sign in"}
            onPress={submit}
            loading={submitting}
            testID="login-submit"
          />
          <Button
            title={isRegister ? "I already have an account" : "Create a new organization"}
            variant="ghost"
            onPress={() => {
              setError(null);
              setMode(isRegister ? "login" : "register");
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: "center",
  },
  logo: {
    width: 240,
    height: 130,
    marginBottom: 20,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  form: {
    width: "100%",
    maxWidth: 420,
    gap: 16,
    marginTop: 32,
  },
  error: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
  },
});
