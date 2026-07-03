/**
 * Biometric unlock via WebAuthn platform passkeys.
 *
 * This is a *local device gate*, not a server auth exchange: the session is a
 * first-party HttpOnly cookie. Enabling biometrics registers a platform
 * credential (Face ID / Touch ID / Android biometric / Windows Hello) tied to
 * this origin, and unlocking prompts the platform authenticator with
 * user-verification required. The credential id is stored locally so unlock can
 * scope the assertion to it.
 */
import { storage } from "./storage";

const CRED_KEY = "thea.biometric.credentialId";

function bufToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuf(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function randomBytes(len: number): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(new ArrayBuffer(len));
  crypto.getRandomValues(arr);
  return arr;
}

/** True when the platform exposes a user-verifying authenticator (biometric). */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (
      typeof window === "undefined" ||
      typeof window.PublicKeyCredential === "undefined" ||
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
        "function"
    ) {
      return false;
    }
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Best-effort human label based on the platform. */
export function biometricLabel(): string {
  if (typeof navigator === "undefined") return "biometrics";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "Face ID or Touch ID";
  if (/Mac/i.test(ua)) return "Touch ID";
  if (/Android/i.test(ua)) return "fingerprint or face unlock";
  if (/Windows/i.test(ua)) return "Windows Hello";
  return "device biometrics";
}

export function hasBiometricCredential(): boolean {
  return !!storage.get(CRED_KEY);
}

/**
 * Registers a platform passkey and stores its id. Returns true on success.
 * Must be called from a user gesture.
 */
export async function enrollBiometric(user: {
  id: string;
  email: string;
  name: string;
}): Promise<boolean> {
  if (!(await isBiometricAvailable())) return false;
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: "THEA Access", id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(user.id),
          name: user.email,
          displayName: user.name || user.email,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!cred) return false;
    storage.set(CRED_KEY, bufToBase64Url(cred.rawId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompts the platform authenticator to reveal a locked session. Returns true
 * when the user successfully verifies. Must be called from a user gesture.
 */
export async function verifyBiometric(): Promise<boolean> {
  const stored = storage.get(CRED_KEY);
  if (!stored) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: window.location.hostname,
        allowCredentials: [
          {
            type: "public-key",
            id: base64UrlToBuf(stored),
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    // NotAllowedError (cancel / failed verification) and any other error means
    // "not unlocked" — the caller falls back to password.
    return false;
  }
}

export function clearBiometric(): void {
  storage.remove(CRED_KEY);
}
