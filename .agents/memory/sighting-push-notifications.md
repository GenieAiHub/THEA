---
name: Sighting push notifications
description: Design decisions for Security Watch push alerts to the Expo mobile app
---

- Push is a **user-level** channel, not per-target: `maybeAlertSighting` treats "org has any opted-in push token" as a wanted channel (`orgHasPushSubscribers`), independent of the target's `alertChannels`.
- **Why:** field staff opt in personally; target-level channel config is org-admin territory and would silently suppress push.
- The opt-in lives on `users.push_sighting_alerts`, NOT on token rows. Token rows are pure device registrations that get deleted at logout — storing the preference there loses it on logout/login (a code review caught exactly that). The send query joins users on the flag.
- Delivery is inline `fetch` to Expo's push API (chunked 100), no queue; `DeviceNotRegistered` tickets prune the token row so the table self-heals.
- Deep link contract: notification `data.url = "/sighting/<id>"`; mobile routing buffers the path and only navigates once auth status is "authed" — routing earlier gets clobbered by the login redirect in the root layout. Cold start handled via `getLastNotificationResponseAsync`.
- Snapshot images in RN load via `Image source={{ uri, headers: { Authorization } }}` (native supports request headers).
