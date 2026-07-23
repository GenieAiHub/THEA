export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  orgId: string;
}

export interface AuthOrg {
  id: string;
  name: string;
  slug: string;
  onboardingCompletedAt: string | null;
}

export interface Member {
  id: string;
  orgId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  externalRef: string | null;
  notes: string | null;
  status: string;
  consentGivenAt: string | null;
  consentVersion: string | null;
  createdAt: string;
  updatedAt: string;
  faceCount?: number;
}

export interface Face {
  id: string;
  quality: number | null;
  createdAt: string;
}

export interface MemberDetail extends Member {
  faces: Face[];
}

export interface AccessPoint {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Grant {
  id: string;
  memberId: string;
  accessPointId: string;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  memberName: string | null;
  accessPointName: string | null;
}

export type Decision = "granted" | "denied";

export interface AccessEvent {
  id: string;
  decision: Decision;
  reason: string;
  distance: number | null;
  createdAt: string;
  memberId: string | null;
  memberName: string | null;
  accessPointId: string | null;
  accessPointName: string | null;
}

/** Org intelligence alert row from GET /v1/alerts (spike / ai_narrative / ai_sov). */
export interface OrgAlert {
  id: string;
  keyword: string;
  type: string;
  severity: string;
  status: string;
  spikeRatio: number | null;
  crisisProbability: number | null;
  sentimentShift: number | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface IdentifyResult {
  decision: Decision;
  reason: string;
  member: { id: string; fullName: string } | null;
  distance: number | null;
  accessPoint: { id: string; name: string };
}

/** Maps machine reason codes from the identify endpoint to human copy. */
export function reasonLabel(reason: string): string {
  switch (reason) {
    case "matched":
      return "Access granted";
    case "no_face_detected":
      return "No face detected";
    case "no_match":
      return "Face not recognized";
    case "no_grant":
      return "No access at this point";
    case "member_suspended":
      return "Membership suspended";
    default:
      return reason.replace(/_/g, " ");
  }
}
