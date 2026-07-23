import type {
  AccessEvent,
  AccessPoint,
  AuthOrg,
  AuthUser,
  Grant,
  IdentifyResult,
  Member,
  MemberDetail,
  OrgAlert,
} from "./types";

// Dev builds inject EXPO_PUBLIC_DOMAIN (Replit preview); production APK/IPA
// builds fall back to the deployed mobile origin, whose nginx proxies /api.
const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN || "m.thea.quest";
const BASE_URL = `https://${DOMAIN}`;

let authToken: string | null = null;

/** Sets the bearer token attached to every subsequent request (null clears). */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Network error — check your connection and try again.");
  }

  const text = await res.text();
  const json = text ? safeParse(text) : null;

  if (!res.ok) {
    const message =
      (json && (json.error || json.message)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return json as T;
}

interface Wrapped<T> {
  data: T;
}

export interface AuthSession {
  user: AuthUser;
  org?: AuthOrg;
  token: string;
  expiresAt: string;
}

export interface MeResponse {
  user: AuthUser;
  org: AuthOrg;
  tier: string;
  featureFlags: Record<string, boolean>;
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<AuthSession> {
    const res = await request<Wrapped<AuthSession>>("/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
    return res.data;
  },

  async register(
    email: string,
    password: string,
    name: string | null,
  ): Promise<AuthSession> {
    const res = await request<Wrapped<AuthSession>>("/v1/auth/register", {
      method: "POST",
      body: { email, password, name },
    });
    return res.data;
  },

  async me(): Promise<MeResponse> {
    const res = await request<Wrapped<MeResponse>>("/v1/auth/me");
    return res.data;
  },

  async logout(): Promise<void> {
    await request<unknown>("/v1/auth/logout", { method: "POST" });
  },

  // ── Members ─────────────────────────────────────────────────────────────
  async listMembers(): Promise<Member[]> {
    const res = await request<{ data: Member[]; total: number }>("/v1/members");
    return res.data;
  },

  async getMember(id: string): Promise<MemberDetail> {
    return request<MemberDetail>(`/v1/members/${id}`);
  },

  async createMember(input: {
    fullName: string;
    email?: string;
    phone?: string;
    notes?: string;
    consentGiven?: boolean;
  }): Promise<Member> {
    return request<Member>("/v1/members", { method: "POST", body: input });
  },

  async updateMember(
    id: string,
    input: Partial<{
      fullName: string;
      email: string;
      phone: string;
      notes: string;
      status: string;
    }>,
  ): Promise<Member> {
    return request<Member>(`/v1/members/${id}`, { method: "PATCH", body: input });
  },

  async recordConsent(id: string): Promise<Member> {
    return request<Member>(`/v1/members/${id}/consent`, { method: "POST" });
  },

  async deleteMember(id: string): Promise<void> {
    await request<unknown>(`/v1/members/${id}`, { method: "DELETE" });
  },

  async enrollFace(
    id: string,
    imageBase64: string,
  ): Promise<{ face: { id: string }; embeddingCount: number }> {
    return request(`/v1/members/${id}/face`, {
      method: "POST",
      body: { imageBase64 },
    });
  },

  async deleteFace(id: string, faceId: string): Promise<void> {
    await request<unknown>(`/v1/members/${id}/face/${faceId}`, {
      method: "DELETE",
    });
  },

  // ── Access points ───────────────────────────────────────────────────────
  async listPoints(): Promise<AccessPoint[]> {
    const res = await request<{ data: AccessPoint[]; total: number }>(
      "/v1/access/points",
    );
    return res.data;
  },

  async createPoint(input: {
    name: string;
    description?: string;
  }): Promise<AccessPoint> {
    return request<AccessPoint>("/v1/access/points", {
      method: "POST",
      body: input,
    });
  },

  async updatePoint(
    id: string,
    input: Partial<{ name: string; description: string; isActive: boolean }>,
  ): Promise<AccessPoint> {
    return request<AccessPoint>(`/v1/access/points/${id}`, {
      method: "PATCH",
      body: input,
    });
  },

  async deletePoint(id: string): Promise<void> {
    await request<unknown>(`/v1/access/points/${id}`, { method: "DELETE" });
  },

  // ── Grants ──────────────────────────────────────────────────────────────
  async listGrants(params: { memberId?: string; accessPointId?: string } = {}): Promise<
    Grant[]
  > {
    const qs = new URLSearchParams();
    if (params.memberId) qs.set("memberId", params.memberId);
    if (params.accessPointId) qs.set("accessPointId", params.accessPointId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await request<{ data: Grant[]; total: number }>(
      `/v1/access/grants${suffix}`,
    );
    return res.data;
  },

  async createGrant(input: {
    memberId: string;
    accessPointId: string;
  }): Promise<Grant> {
    return request<Grant>("/v1/access/grants", { method: "POST", body: input });
  },

  async deleteGrant(id: string): Promise<void> {
    await request<unknown>(`/v1/access/grants/${id}`, { method: "DELETE" });
  },

  // ── Identify + events ───────────────────────────────────────────────────
  async identify(
    imageBase64: string,
    accessPointId: string,
  ): Promise<IdentifyResult> {
    return request<IdentifyResult>("/v1/access/identify", {
      method: "POST",
      body: { imageBase64, accessPointId },
    });
  },

  async listEvents(limit = 50): Promise<AccessEvent[]> {
    const res = await request<{ data: AccessEvent[]; total: number }>(
      `/v1/access/events?limit=${limit}`,
    );
    return res.data;
  },

  // ── Intelligence alerts ─────────────────────────────────────────────────
  async listAlerts(limit = 100): Promise<OrgAlert[]> {
    const res = await request<{ data: OrgAlert[] }>(`/v1/alerts?limit=${limit}`);
    return res.data;
  },

  // ── Push notifications ──────────────────────────────────────────────────
  async registerPushToken(
    token: string,
    platform: string,
  ): Promise<{ sightingAlerts: boolean }> {
    const res = await request<Wrapped<{ id: string; sightingAlerts: boolean }>>(
      "/v1/push/register",
      { method: "POST", body: { token, platform } },
    );
    return res.data;
  },

  async unregisterPushToken(token: string): Promise<void> {
    await request<unknown>("/v1/push/register", {
      method: "DELETE",
      body: { token },
    });
  },

  async getPushPreferences(): Promise<{
    sightingAlerts: boolean;
    deviceCount: number;
  }> {
    const res = await request<
      Wrapped<{ sightingAlerts: boolean; deviceCount: number }>
    >("/v1/push/preferences");
    return res.data;
  },

  async setPushPreferences(sightingAlerts: boolean): Promise<void> {
    await request<unknown>("/v1/push/preferences", {
      method: "PATCH",
      body: { sightingAlerts },
    });
  },

  // ── Security Watch sightings ────────────────────────────────────────────
  async getSighting(id: string): Promise<Sighting> {
    return request<Sighting>(`/v1/watch/sightings/${id}`);
  },

  // ── Image recognition ───────────────────────────────────────────────────
  async recognize(imageBase64: string): Promise<RecognitionResult> {
    return request<RecognitionResult>("/v1/watch/recognize", {
      method: "POST",
      body: { imageBase64 },
    });
  },
};

export interface RecognizedObject {
  class: string;
  score: number;
  box: [number, number, number, number];
}

export interface RecognizedFace {
  score: number;
  member: { id: string; fullName: string } | null;
  distance: number | null;
}

export interface RecognizedPlate {
  text: string;
  confidence: number;
}

export interface RecognizedTargetMatch {
  targetId: string;
  name: string;
  type: string;
  matchType: "face" | "object" | "plate";
  confidence: number;
  detail: string | null;
}

export interface RecognitionResult {
  objects: RecognizedObject[];
  faces: RecognizedFace[];
  plates: RecognizedPlate[];
  targetMatches: RecognizedTargetMatch[];
}

export interface Sighting {
  id: string;
  targetId: string | null;
  cameraId: string | null;
  matchType: string;
  confidence: number | null;
  detail: string | null;
  createdAt: string;
  targetName: string | null;
  targetType: string | null;
  cameraName: string | null;
  cameraLocation: string | null;
  hasSnapshot: boolean;
}

/** Image source (uri + auth headers) for a sighting's snapshot. */
export function sightingSnapshotSource(id: string): {
  uri: string;
  headers?: Record<string, string>;
} {
  return {
    uri: `${BASE_URL}/api/v1/watch/sightings/${id}/snapshot`,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  };
}
