import { db } from "@workspace/db";
import { pushTokensTable, usersTable } from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "../logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

export interface SightingPushPayload {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/** True for both classic and bare Expo push token formats. */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

/**
 * Sends a sighting push notification to every device of opted-in org members
 * via Expo's push API. The opt-in lives on users.push_sighting_alerts, so the
 * token join filters on it. Tokens that Expo reports as no longer registered
 * are deleted so the table self-heals. Failures are logged, never thrown.
 */
export async function sendSightingPush(orgId: string, payload: SightingPushPayload): Promise<number> {
  let tokens: { token: string }[];
  try {
    tokens = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .innerJoin(usersTable, eq(pushTokensTable.userId, usersTable.id))
      .where(and(eq(pushTokensTable.orgId, orgId), eq(usersTable.pushSightingAlerts, true)));
  } catch (err) {
    logger.warn({ err, orgId }, "Sighting push: token lookup failed");
    return 0;
  }
  const valid = tokens.map((t) => t.token).filter(isExpoPushToken);
  if (valid.length === 0) return 0;

  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
    const chunk = valid.slice(i, i + CHUNK_SIZE);
    const messages = chunk.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: "default" as const,
      priority: "high" as const,
      channelId: "sighting-alerts",
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        logger.warn({ status: res.status, orgId }, "Sighting push: Expo API returned non-OK");
        continue;
      }
      const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      const tickets = json.data ?? [];
      tickets.forEach((ticket, idx) => {
        if (ticket.status === "ok") {
          sent += 1;
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          const token = chunk[idx];
          if (token) dead.push(token);
        }
      });
    } catch (err) {
      logger.warn({ err, orgId }, "Sighting push: Expo API call failed");
    }
  }

  if (dead.length > 0) {
    await db
      .delete(pushTokensTable)
      .where(inArray(pushTokensTable.token, dead))
      .catch((err: unknown) => logger.warn({ err }, "Sighting push: pruning dead tokens failed"));
    logger.info({ orgId, pruned: dead.length }, "Sighting push: pruned unregistered tokens");
  }

  return sent;
}

/** Fast existence check used to decide whether push is a wanted channel. */
export async function orgHasPushSubscribers(orgId: string): Promise<boolean> {
  try {
    const [row] = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .innerJoin(usersTable, eq(pushTokensTable.userId, usersTable.id))
      .where(and(eq(pushTokensTable.orgId, orgId), eq(usersTable.pushSightingAlerts, true)))
      .limit(1);
    return Boolean(row);
  } catch {
    return false;
  }
}
