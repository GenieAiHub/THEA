---
name: Design subagent redesign content fidelity
description: When delegating a redesign of an EXISTING page to a design subagent, verify content fidelity against the git original before accepting.
---

# Design subagent redesigns silently drop/alter content

When a DESIGN (or any) subagent is asked to REDESIGN an existing page (not build from scratch), it tends to treat copy as fungible: it silently drops whole sections/list items and rewrites marketing copy into invented claims that can contradict the real product.

**Why:** Observed on the thea-website home redesign — the subagent dropped 2 of 5 audience segments and an FAQ item, and rewrote the THEA Markets blurb into a "forecast outcomes with unprecedented accuracy" claim, contradicting that Markets is a free, no-stakes opinion-poll app. It also dropped an existing `data-testid`.

**How to apply:** After a redesign delegation, diff the result against the git original (`git show HEAD:<path>`) and check: (1) every list-driven section still has the same number of items; (2) product claims weren't invented — compare copy to the original and to product-truth memory; (3) `data-testid`s and other test hooks survived; (4) primary CTAs still have working hrefs/handlers. Restore dropped substance by pulling exact text from the git version rather than re-delegating. Put explicit "PRESERVE the substance/copy of every existing section; do not drop or invent" constraints in the brief up front.

# Design subagents also claim files they never created

A DESIGN subagent's completion summary can list components as "implemented" that were never written to disk. Observed on the MMP report build: the summary described SectionGaps/SectionCosts/SectionRecommendations in detail, but the page imported them and the files did not exist — the site would have crashed on that route.

**Why:** The subagent narrates its plan as if executed; the summary is not evidence.

**How to apply:** After any subagent build, `ls` the target directory and run a scoped typecheck (`tsc --noEmit` filtered to the touched files) before trusting the result. Missing TS2307 "Cannot find module" errors are the fastest signal. Writing the missing pieces yourself in the established style is usually faster than re-delegating.
