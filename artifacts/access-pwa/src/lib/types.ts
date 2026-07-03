/**
 * Domain types for the app come straight from the shared, generated API client
 * (`@workspace/api-client-react`) so there is a single source of truth. This
 * module only re-exports the ones the UI references plus a couple of local
 * display helpers.
 */
export type {
  AuthUser,
  AuthOrg,
  Member,
  MemberListItem,
  MemberDetail,
  EnrolledFace,
  AccessPoint,
  AccessGrant,
  AccessEvent,
  IdentifyResult,
} from "@workspace/api-client-react";

/** Access decision returned by the identify endpoint and stored on events. */
export type Decision = "granted" | "denied";

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
