import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export interface BiometricSupport {
  /** Hardware present AND at least one biometric enrolled. */
  available: boolean;
  enrolled: boolean;
  types: LocalAuthentication.AuthenticationType[];
}

/**
 * Inspects the device for usable biometrics. expo-local-authentication has no
 * web support, so we short-circuit on web to keep the app from throwing.
 */
export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === "web") {
    return { available: false, enrolled: false, types: [] };
  }
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hasHardware
      ? await LocalAuthentication.isEnrolledAsync()
      : false;
    const types = enrolled
      ? await LocalAuthentication.supportedAuthenticationTypesAsync()
      : [];
    return { available: hasHardware && enrolled, enrolled, types };
  } catch {
    return { available: false, enrolled: false, types: [] };
  }
}

/** Human label for the primary biometric available on this device. */
export function biometricLabel(
  types: LocalAuthentication.AuthenticationType[],
): string {
  if (
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    return Platform.OS === "ios" ? "Face ID" : "Face Unlock";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "Iris";
  }
  return "biometrics";
}

/**
 * Prompts for biometric authentication. Falls back to the device passcode when
 * the user can't use biometrics. Returns whether authentication succeeded.
 */
export async function authenticateBiometric(
  promptMessage: string,
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: "Use device passcode",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
