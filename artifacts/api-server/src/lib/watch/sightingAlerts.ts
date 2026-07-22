import { db } from "@workspace/db";
import {
  emailPreferencesTable,
  organizationsTable,
  watchSightingsTable,
  type WatchCamera,
  type WatchTarget,
  type WatchSighting,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getRedis } from "../redis";
import { addJob } from "../queues";
import { dispatchWebhookEvent } from "../webhookDispatcher";
import { logger } from "../logger";
import { getPlatformConfig } from "../platform-config";
import { sendSightingPush, orgHasPushSubscribers } from "./pushSightings";
import { redactStreamCredentials } from "./mask";

/**
 * Alert fan-out for a live-camera sighting, gated by a per-(target, camera)
 * cooldown so a lingering match doesn't flood every channel each sampled frame.
 * Cooldown is a Redis SET NX PX key — atomic across workers.
 */
export async function maybeAlertSighting(args: {
  target: WatchTarget;
  camera: WatchCamera | null;
  sighting: WatchSighting;
}): Promise<boolean> {
  const { target, camera, sighting } = args;
  const channels = target.alertChannels ?? {};
  // Push is user-level (opt-in per org member), not per-target, so it counts
  // as a wanted channel whenever any org member has an opted-in device.
  const wantsPush = await orgHasPushSubscribers(target.orgId);
  const wantsAny = channels.email || channels.webhook || channels.slack || channels.teams || wantsPush;
  if (!wantsAny) return false;

  const cooldownMs = Math.max(10, target.cooldownSec) * 1000;
  const key = `watch:cooldown:${target.id}:${camera?.id ?? "video"}`;
  try {
    const acquired = await getRedis().set(key, "1", "PX", cooldownMs, "NX");
    if (acquired !== "OK") return false;
  } catch (err) {
    logger.warn({ err }, "Sighting cooldown check failed — skipping alert");
    return false;
  }

  const [org] = await db
    .select({ name: organizationsTable.name })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, target.orgId))
    .limit(1);
  const orgName = org?.name ?? "Your Organisation";
  // Camera name/location are free-form user input; redact any embedded
  // scheme://user:pass@ credentials so they never reach outbound channels.
  const source = redactStreamCredentials(
    camera ? `Camera: ${camera.name}${camera.location ? ` (${camera.location})` : ""}` : "Uploaded video",
  );
  const detail = sighting.detail ? redactStreamCredentials(sighting.detail) : sighting.detail;
  const confidencePct = sighting.confidence != null ? `${Math.round(sighting.confidence * 100)}%` : "—";
  const seenAt = (sighting.createdAt ?? new Date()).toISOString();
  const baseUrl = (await getPlatformConfig("portal_base_url")) ?? "https://thea.quest";
  const dashboardUrl = `${baseUrl.replace(/\/$/, "")}/security-watch`;

  // Email
  if (channels.email) {
    const emails = (channels.emails ?? []).filter((e) => /.+@.+\..+/.test(e));
    if (emails.length > 0) {
      try {
        await addJob("emailDelivery", "watch-sighting-alert", {
          to: emails.map((email) => ({ email })),
          subject: `Security Watch: ${target.name} spotted — ${orgName}`,
          template: "sighting-alert",
          data: {
            orgName,
            targetName: target.name,
            targetType: target.type,
            source,
            matchType: sighting.matchType,
            confidence: confidencePct,
            detail: detail ?? "",
            seenAt,
            dashboardUrl,
          },
        });
      } catch (err) {
        logger.warn({ err, targetId: target.id }, "Sighting email enqueue failed");
      }
    }
  }

  // Webhook (org's registered webhooks, SSRF-guarded by the dispatcher)
  if (channels.webhook) {
    try {
      await dispatchWebhookEvent(target.orgId, "sighting.detected", {
        sightingId: sighting.id,
        targetId: target.id,
        targetName: target.name,
        targetType: target.type,
        cameraId: camera?.id ?? null,
        cameraName: camera?.name ?? null,
        matchType: sighting.matchType,
        confidence: sighting.confidence,
        detail: detail,
        seenAt,
      });
    } catch (err) {
      logger.warn({ err, targetId: target.id }, "Sighting webhook dispatch failed");
    }
  }

  // Slack / Teams via the org's configured webhook URLs (same allowlists as digests)
  if (channels.slack || channels.teams) {
    const [pref] = await db
      .select()
      .from(emailPreferencesTable)
      .where(eq(emailPreferencesTable.orgId, target.orgId))
      .limit(1);

    const text = `👁 *THEA Security Watch* — *${target.name}* spotted\n${source}\nMatch: ${sighting.matchType}${detail ? ` (${detail})` : ""} · Confidence: ${confidencePct}\n${dashboardUrl}`;

    if (channels.slack && pref?.slackWebhookUrl) {
      try {
        const parsed = new URL(pref.slackWebhookUrl);
        if (parsed.protocol === "https:" && parsed.hostname === "hooks.slack.com") {
          await fetch(pref.slackWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
            signal: AbortSignal.timeout(5000),
          });
        }
      } catch (err) {
        logger.warn({ err, orgId: target.orgId }, "Sighting Slack delivery failed");
      }
    }

    if (channels.teams && pref?.teamsWebhookUrl) {
      try {
        const parsed = new URL(pref.teamsWebhookUrl);
        if (parsed.protocol === "https:" && parsed.hostname.endsWith(".webhook.office.com")) {
          await fetch(pref.teamsWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              "@type": "MessageCard",
              "@context": "http://schema.org/extensions",
              themeColor: "dc2626",
              summary: `Security Watch: ${target.name} spotted`,
              sections: [{
                activityTitle: `👁 Security Watch — ${target.name} spotted`,
                activitySubtitle: source,
                facts: [
                  { name: "Match", value: `${sighting.matchType}${detail ? ` (${detail})` : ""}` },
                  { name: "Confidence", value: confidencePct },
                  { name: "Seen at", value: seenAt },
                ],
                markdown: true,
              }],
            }),
            signal: AbortSignal.timeout(5000),
          });
        }
      } catch (err) {
        logger.warn({ err, orgId: target.orgId }, "Sighting Teams delivery failed");
      }
    }
  }

  // Mobile push (opted-in org members' devices)
  if (wantsPush) {
    try {
      const sent = await sendSightingPush(target.orgId, {
        title: `👁 ${target.name} spotted`,
        body: `${source} · Match: ${sighting.matchType}${detail ? ` (${detail})` : ""} · Confidence: ${confidencePct}`,
        data: {
          type: "sighting",
          sightingId: sighting.id,
          url: `/sighting/${sighting.id}`,
        },
      });
      if (sent > 0) logger.info({ targetId: target.id, sent }, "Sighting push notifications sent");
    } catch (err) {
      logger.warn({ err, targetId: target.id }, "Sighting push delivery failed");
    }
  }

  await db
    .update(watchSightingsTable)
    .set({ alerted: true })
    .where(eq(watchSightingsTable.id, sighting.id))
    .catch((err: unknown) => logger.warn({ err }, "Failed to mark sighting alerted"));

  logger.info({ targetId: target.id, sightingId: sighting.id, cameraId: camera?.id }, "Sighting alert dispatched");
  return true;
}
