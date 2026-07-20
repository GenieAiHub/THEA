/**
 * MMP Competitive Landscape & Gap Analysis — embedded report data.
 *
 * This file is the single source of truth for the hidden /mmp-report page.
 * All content is static; there is no backend for this report.
 */

/* ------------------------------------------------------------------ */
/* Section 1 — Market Overview                                         */
/* ------------------------------------------------------------------ */

export interface MarketStat {
  label: string;
  value: string;
  detail: string;
}

export const MARKET_STATS: MarketStat[] = [
  {
    label: "MMP market size",
    value: "$3.37B",
    detail: "Global mobile measurement partner market, 2025",
  },
  {
    label: "Market CAGR",
    value: "12.65%",
    detail: "Projected compound annual growth through 2030",
  },
  {
    label: "UA spend measured",
    value: "$78B",
    detail: "Annual mobile user-acquisition spend flowing through MMPs",
  },
  {
    label: "Ad spend tracked",
    value: "$500B",
    detail: "Total digital ad spend touched by attribution tooling",
  },
];

export interface MarketTrend {
  title: string;
  description: string;
}

export const MARKET_TRENDS: MarketTrend[] = [
  {
    title: "Privacy-first measurement",
    description:
      "ATT, SKAdNetwork, and Android Privacy Sandbox have ended deterministic device-level tracking. Winners are rebuilding attribution around aggregate, consented, and modeled data.",
  },
  {
    title: "AI moves into the stack",
    description:
      "Predictive LTV, automated insights, anomaly detection, and creative scoring are becoming table stakes. Buyers now expect the MMP to tell them what to do, not just what happened.",
  },
  {
    title: "Incrementality over correlation",
    description:
      "Growth teams increasingly distrust claimed conversions and demand causal lift measurement — geo holdouts, ghost bids, and conversion-lift experiments.",
  },
  {
    title: "Data clean rooms",
    description:
      "Privacy-safe collaboration between advertiser first-party data and platform data is the new integration surface — AWS Clean Rooms, Google ADH, and MMP-native clean rooms.",
  },
  {
    title: "Death of last-click",
    description:
      "Single-touch, last-click attribution is collapsing as a decision framework. Multi-touch, MMM, and incrementality triangulation are replacing it in sophisticated orgs.",
  },
];

/** MMP market projection at 12.65% CAGR, used for the growth visualization. */
export interface MarketProjectionPoint {
  year: number;
  valueBillions: number;
}

export const MARKET_PROJECTION: MarketProjectionPoint[] = [
  { year: 2025, valueBillions: 3.37 },
  { year: 2026, valueBillions: 3.8 },
  { year: 2027, valueBillions: 4.28 },
  { year: 2028, valueBillions: 4.82 },
  { year: 2029, valueBillions: 5.43 },
  { year: 2030, valueBillions: 6.11 },
];

/* ------------------------------------------------------------------ */
/* Section 2 — AppsFlyer Product Suite                                 */
/* ------------------------------------------------------------------ */

export interface AppsFlyerProduct {
  name: string;
  whatItDoes: string;
  benefit: string;
  /** 1–10: how hard the product is to replicate / how unique it is in the market. */
  uniqueness: number;
}

export const APPSFLYER_PRODUCTS: AppsFlyerProduct[] = [
  {
    name: "Core Attribution",
    whatItDoes:
      "Matches installs and in-app events to the ads that drove them across 10,000+ integrated ad networks and partners.",
    benefit: "One neutral source of truth for which channels actually drive users.",
    uniqueness: 3,
  },
  {
    name: "SKAN Solution (iOS SSOT)",
    whatItDoes:
      "Unifies SKAdNetwork postbacks with real-time consented data into a single de-duplicated iOS view, with conversion-value management tooling.",
    benefit: "Coherent iOS reporting despite Apple's privacy constraints.",
    uniqueness: 8,
  },
  {
    name: "Incrementality",
    whatItDoes:
      "Runs always-on lift experiments (holdout groups, geo tests) to measure the true causal impact of campaigns and channels.",
    benefit: "Separates ads that create demand from ads that claim credit for it.",
    uniqueness: 7,
  },
  {
    name: "Predict (pLTV)",
    whatItDoes:
      "Machine-learning models that estimate cohort lifetime value from early signals, designed to work within SKAN's limited postback window.",
    benefit: "Optimize campaigns on day 1 instead of waiting 90 days for revenue data.",
    uniqueness: 7,
  },
  {
    name: "Protect360",
    whatItDoes:
      "Multi-layer ad-fraud protection: install hijacking, click flooding, bots, SDK spoofing, and post-attribution fraud detection with refund workflows.",
    benefit: "Stops paying for fake installs and poisoned attribution data.",
    uniqueness: 6,
  },
  {
    name: "OneLink",
    whatItDoes:
      "Deep linking and deferred deep linking across channels — links route users to in-app content whether or not the app is installed.",
    benefit: "Seamless web-to-app, email, QR, and social journeys that convert.",
    uniqueness: 5,
  },
  {
    name: "Audiences",
    whatItDoes:
      "Builds behavioral user segments from attribution data and syncs them to ad networks for targeting, retargeting, and suppression.",
    benefit: "Attribution data becomes actionable media buying without CSV exports.",
    uniqueness: 5,
  },
  {
    name: "Data Clean Room (Privacy Cloud)",
    whatItDoes:
      "Privacy-safe environment where advertiser first-party data can be joined with attribution and partner data without exposing user-level records.",
    benefit: "Deep analysis and partner collaboration that survives privacy review.",
    uniqueness: 8,
  },
  {
    name: "Data Locker & Push API",
    whatItDoes:
      "Streams raw attribution events to the customer's own warehouse (S3, GCS, BigQuery, Snowflake) and real-time endpoints.",
    benefit: "Full data ownership — BI and data-science teams work on raw events.",
    uniqueness: 4,
  },
  {
    name: "Xpend (Cost Aggregation)",
    whatItDoes:
      "Ingests and normalizes ad spend from hundreds of media sources so cost, revenue, and ROAS live in one report.",
    benefit: "True ROI per channel/campaign/creative without spreadsheet stitching.",
    uniqueness: 5,
  },
  {
    name: "Creative Optimization",
    whatItDoes:
      "Creative-level analytics that tag, group, and score ad creatives, connecting creative elements to install and post-install performance.",
    benefit: "Tells UA teams which hooks, formats, and scenes actually perform.",
    uniqueness: 6,
  },
  {
    name: "CTV & Cross-Device Measurement",
    whatItDoes:
      "Measures Connected-TV, PC, and console campaigns and ties cross-device exposure to mobile installs and events.",
    benefit: "Extends the measurement graph beyond the phone as budgets shift to CTV.",
    uniqueness: 7,
  },
];

/* ------------------------------------------------------------------ */
/* Section 3 — Competitor Matrix                                       */
/* ------------------------------------------------------------------ */

export type CompetitorKey =
  | "appsflyer"
  | "adjust"
  | "branch"
  | "singular"
  | "kochava"
  | "tenjin"
  | "airbridge"
  | "firebase"
  | "attriax";

export interface Competitor {
  key: CompetitorKey;
  name: string;
  focus: string;
  strengths: string[];
  weaknesses: string[];
}

export const COMPETITORS: Competitor[] = [
  {
    key: "adjust",
    name: "Adjust",
    focus: "Full-suite attribution with fraud prevention and automation (AppLovin-owned)",
    strengths: [
      "Very strong in gaming and EU markets, with EU data residency",
      "Mature fraud prevention and CTV measurement (AdVision)",
      "Automation layer for campaign management across networks",
    ],
    weaknesses: [
      "Owned by ad network AppLovin — neutrality concerns for advertisers",
      "Premium pricing with modules sold separately",
      "Innovation pace slowed post-acquisition",
    ],
  },
  {
    key: "branch",
    name: "Branch",
    focus: "Deep linking and cross-platform journey measurement first, attribution second",
    strengths: [
      "Best-in-class deep linking and deferred deep linking",
      "Strong web-to-app, email, and owned-media attribution",
      "Loved by product and engineering teams, not just marketers",
    ],
    weaknesses: [
      "Analytics and cost-aggregation depth trails dedicated MMPs",
      "Less focus on gaming UA workflows",
      "Enterprise pricing for full measurement suite",
    ],
  },
  {
    key: "singular",
    name: "Singular",
    focus: "Marketing analytics and cost aggregation unified with attribution",
    strengths: [
      "Best cost aggregation and ROI reporting in the category",
      "Strong SKAN conversion-model tooling",
      "Flexible data export and warehouse-native pipelines",
    ],
    weaknesses: [
      "Smaller partner ecosystem than AppsFlyer/Adjust",
      "Lower brand recognition outside performance-marketing circles",
      "Fewer adjacent products (clean room, audiences)",
    ],
  },
  {
    key: "kochava",
    name: "Kochava",
    focus: "Enterprise measurement with maximum data flexibility and ownership",
    strengths: [
      "Highly configurable; strong raw-data ownership story",
      "Early mover in CTV and OTT measurement",
      "Publisher/media-side tooling alongside advertiser tools",
    ],
    weaknesses: [
      "Dated UX compared to newer challengers",
      "Weaker SMB/self-serve motion and mindshare",
      "Past data-marketplace privacy controversies linger",
    ],
  },
  {
    key: "tenjin",
    name: "Tenjin",
    focus: "Affordable attribution for indie and hyper-casual game studios",
    strengths: [
      "Aggressive pricing with a genuinely useful free tier",
      "DataVault gives SQL access to raw data cheaply",
      "Purpose-built for hyper-casual UA loops",
    ],
    weaknesses: [
      "Thin enterprise feature set (fraud, clean rooms, audiences)",
      "Smaller integration network",
      "Limited traction outside gaming",
    ],
  },
  {
    key: "airbridge",
    name: "Airbridge",
    focus: "Rising APAC-born challenger unifying web and app attribution",
    strengths: [
      "Modern UX and genuinely unified web + app measurement",
      "Aggressive pricing against the big two",
      "Fast-shipping product team; strong APAC presence",
    ],
    weaknesses: [
      "Smaller partner/integration ecosystem",
      "Limited brand presence in NA/EU enterprise deals",
      "Fewer advanced modules (incrementality, clean room)",
    ],
  },
  {
    key: "firebase",
    name: "Firebase (Google)",
    focus: "Free app analytics with attribution biased toward the Google ecosystem",
    strengths: [
      "Free and already installed in most Android apps",
      "Deep, native Google Ads integration",
      "Rich product analytics beyond marketing",
    ],
    weaknesses: [
      "Not a neutral MMP — self-attributing network measuring itself",
      "Weak non-Google attribution and no fraud protection",
      "No SKAN management, cost aggregation, or partner ecosystem",
    ],
  },
  {
    key: "attriax",
    name: "Attriax",
    focus: "Low-cost newer entrant competing on price and simplicity",
    strengths: [
      "Disruptive pricing for cost-sensitive teams",
      "Simple onboarding and lightweight SDK",
      "Covers core attribution basics well",
    ],
    weaknesses: [
      "Unproven at enterprise scale",
      "Minimal integration ecosystem and adjacent products",
      "Small team — roadmap and support risk",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Section 4 — Full Service Catalogue (24 services)                    */
/* ------------------------------------------------------------------ */

export type DemandTier = "high" | "emerging" | "medium";

export const DEMAND_TIER_LABELS: Record<DemandTier, string> = {
  high: "High demand",
  emerging: "Emerging-High",
  medium: "Medium demand",
};

export interface ServiceCategory {
  name: string;
  demand: DemandTier;
  description: string;
  keyDriver: string;
  /** Which vendors offer a credible version of this service. */
  offeredBy: CompetitorKey[];
}

export const SERVICE_CATALOGUE: ServiceCategory[] = [
  {
    name: "Mobile install attribution",
    demand: "high",
    description: "Match installs to the ad, network, campaign, and creative that drove them.",
    keyDriver: "Foundation of all UA spend accountability.",
    offeredBy: ["appsflyer", "adjust", "branch", "singular", "kochava", "tenjin", "airbridge", "firebase", "attriax"],
  },
  {
    name: "In-app event & revenue tracking",
    demand: "high",
    description: "Attribute post-install events — purchases, subscriptions, retention — to acquisition source.",
    keyDriver: "ROAS optimization needs revenue tied to source.",
    offeredBy: ["appsflyer", "adjust", "branch", "singular", "kochava", "tenjin", "airbridge", "firebase", "attriax"],
  },
  {
    name: "SKAN / iOS privacy measurement",
    demand: "high",
    description: "Manage SKAdNetwork conversion values and merge postbacks with consented real-time data.",
    keyDriver: "ATT wiped out deterministic iOS attribution.",
    offeredBy: ["appsflyer", "adjust", "singular", "kochava", "airbridge"],
  },
  {
    name: "Ad fraud prevention",
    demand: "high",
    description: "Detect and block install hijacking, click flooding, bots, and SDK spoofing.",
    keyDriver: "Fraud consumes an estimated 10–20% of UA budgets.",
    offeredBy: ["appsflyer", "adjust", "kochava", "singular"],
  },
  {
    name: "Deep linking & deferred deep linking",
    demand: "high",
    description: "Route users to in-app content from any channel, surviving the install step.",
    keyDriver: "Conversion-rate gains across email, web, QR, and social.",
    offeredBy: ["appsflyer", "adjust", "branch", "kochava", "airbridge"],
  },
  {
    name: "Cost aggregation & ROAS reporting",
    demand: "high",
    description: "Normalize spend from hundreds of networks so cost and revenue live in one report.",
    keyDriver: "CFO-grade ROI reporting without spreadsheets.",
    offeredBy: ["appsflyer", "adjust", "singular", "kochava", "airbridge"],
  },
  {
    name: "Raw data export & warehouse streaming",
    demand: "high",
    description: "Stream attribution events to customer-owned warehouses and real-time endpoints.",
    keyDriver: "Data teams demand ownership of event-level data.",
    offeredBy: ["appsflyer", "adjust", "singular", "kochava", "tenjin", "airbridge", "branch"],
  },
  {
    name: "Cohort & retention analytics",
    demand: "high",
    description: "LTV, retention, and engagement curves segmented by acquisition source.",
    keyDriver: "Payback-window math drives every UA budget.",
    offeredBy: ["appsflyer", "adjust", "singular", "kochava", "tenjin", "airbridge", "firebase"],
  },
  {
    name: "Audience segmentation & sync",
    demand: "high",
    description: "Build behavioral segments and sync them to networks for targeting and suppression.",
    keyDriver: "Retargeting efficiency and churn-risk winbacks.",
    offeredBy: ["appsflyer", "adjust", "kochava"],
  },
  {
    name: "Incrementality measurement",
    demand: "emerging",
    description: "Causal lift experiments — holdouts, geo tests — measuring true campaign impact.",
    keyDriver: "Distrust of claimed conversions after privacy changes.",
    offeredBy: ["appsflyer", "adjust", "kochava"],
  },
  {
    name: "Predictive LTV (pLTV)",
    demand: "emerging",
    description: "ML models estimating cohort value from early signals for day-1 optimization.",
    keyDriver: "SKAN postback windows force early-signal decisions.",
    offeredBy: ["appsflyer"],
  },
  {
    name: "Data clean rooms",
    demand: "emerging",
    description: "Privacy-safe joins between first-party, attribution, and platform data.",
    keyDriver: "Privacy/legal teams block raw data sharing.",
    offeredBy: ["appsflyer", "kochava"],
  },
  {
    name: "CTV attribution",
    demand: "emerging",
    description: "Tie Connected-TV ad exposure to mobile installs via household-level matching.",
    keyDriver: "CTV budgets growing 30%+ YoY need app-side proof.",
    offeredBy: ["appsflyer", "adjust", "kochava"],
  },
  {
    name: "Web-to-app & cross-platform identity",
    demand: "emerging",
    description: "Unified user journeys across web, mobile web, and native app.",
    keyDriver: "PLG and e-commerce funnels start on the web.",
    offeredBy: ["appsflyer", "branch", "airbridge", "singular"],
  },
  {
    name: "Android Privacy Sandbox readiness",
    demand: "emerging",
    description: "Attribution Reporting API support as GAID deprecation approaches.",
    keyDriver: "Google will retire the ad ID as we know it.",
    offeredBy: ["appsflyer", "adjust", "singular", "kochava"],
  },
  {
    name: "Media mix modeling (MMM)",
    demand: "emerging",
    description: "Top-down statistical models allocating credit across all channels including offline.",
    keyDriver: "Boards want channel-mix answers user-level data can't give.",
    offeredBy: ["appsflyer", "kochava"],
  },
  {
    name: "Creative analytics",
    demand: "emerging",
    description: "Tag, group, and score creatives; connect creative elements to performance.",
    keyDriver: "Creative is the last big performance lever left.",
    offeredBy: ["appsflyer", "adjust", "singular"],
  },
  {
    name: "Uninstall measurement",
    demand: "medium",
    description: "Track uninstalls by source to expose low-quality acquisition channels.",
    keyDriver: "Uninstall rate is a proxy for traffic quality.",
    offeredBy: ["appsflyer", "adjust", "kochava", "singular"],
  },
  {
    name: "Owned-media attribution (email/SMS/push)",
    demand: "medium",
    description: "Attribute conversions to owned channels alongside paid media.",
    keyDriver: "CRM teams need credit for re-engagement wins.",
    offeredBy: ["appsflyer", "branch", "adjust"],
  },
  {
    name: "QR & offline-to-app attribution",
    demand: "medium",
    description: "Measure app installs originating from QR codes and offline touchpoints.",
    keyDriver: "Post-COVID QR ubiquity in retail and OOH.",
    offeredBy: ["appsflyer", "branch", "adjust"],
  },
  {
    name: "Agency & partner access controls",
    demand: "medium",
    description: "Scoped multi-tenant access for agencies, networks, and regional teams.",
    keyDriver: "Enterprise governance and agency workflows.",
    offeredBy: ["appsflyer", "adjust", "kochava", "singular"],
  },
  {
    name: "Benchmarks & market intelligence",
    demand: "medium",
    description: "Anonymized vertical benchmarks for CPI, retention, and ROAS.",
    keyDriver: "Teams can't judge performance without context.",
    offeredBy: ["appsflyer"],
  },
  {
    name: "PC & console attribution",
    demand: "medium",
    description: "Extend measurement to PC and console game launches and cross-play.",
    keyDriver: "Cross-platform gaming budgets keep growing.",
    offeredBy: ["appsflyer", "adjust", "kochava"],
  },
  {
    name: "SDK debugging & developer tools",
    demand: "medium",
    description: "Integration validators, test consoles, and event debuggers for engineers.",
    keyDriver: "Bad SDK setups silently corrupt attribution data.",
    offeredBy: ["appsflyer", "adjust", "branch", "tenjin"],
  },
];

/* ------------------------------------------------------------------ */
/* Section 5 — Market Gaps (priority-ranked)                           */
/* ------------------------------------------------------------------ */

export type GapTier = "hot" | "warm" | "future";

export const GAP_TIER_LABELS: Record<GapTier, string> = {
  hot: "Build now",
  warm: "Strong second wave",
  future: "Frontier bets",
};

export interface MarketGap {
  priority: number;
  tier: GapTier;
  name: string;
  whatsMissing: string;
  whatToBuild: string;
  clients: string;
  /** 1–5 stars */
  difficulty: number;
  revenueModel: string;
  aiCost?: string;
  whyRanked?: string;
}

export const MARKET_GAPS: MarketGap[] = [
  {
    priority: 1,
    tier: "hot",
    name: "Attribution Health Monitor",
    whatsMissing:
      "Apps have broken attribution setups (misconfigured SKAN postbacks, duplicate SDK events, revenue misattribution) and discover the problem months later — silently losing millions.",
    whatToBuild:
      "Continuous attribution health score with specific failure diagnosis, event duplication detector, revenue reconciliation checker, SDK version monitoring, daily data quality report to Slack/email.",
    clients: "Every MMP customer — universal need.",
    difficulty: 2,
    revenueModel: "$99–$500/month standalone; natural upsell into full platform.",
    whyRanked:
      "Lowest build cost, zero competition, every single MMP customer needs it, strong free-tier acquisition funnel.",
  },
  {
    priority: 2,
    tier: "hot",
    name: "Influencer & Creator Attribution",
    whatsMissing:
      "$21B influencer market with zero proper measurement. When a YouTuber or TikToker mentions your app, MMPs can't attribute the installs at all. Promo codes are the only current \"solution.\"",
    whatToBuild:
      "Unique deferred deep links per creator, creator performance dashboard (installs / Day-7 retention / LTV per creator), organic vs. paid lift measurement, integrations with YouTube API, TikTok Creator Marketplace, AspireIQ.",
    clients: "Consumer app brands, gaming studios, DTC brands with apps.",
    difficulty: 3,
    revenueModel: "$500–$5,000/month per brand.",
    whyRanked:
      "$21B market, no serious competitor in this exact niche, viral word-of-mouth among creator economy brands.",
  },
  {
    priority: 3,
    tier: "hot",
    name: "Predictive LTV + Paywall Optimization",
    whatsMissing:
      "MMPs show historical LTV; nobody predicts what a fresh cohort will be worth in 90 days. Separately, no tool connects attribution source data to paywall A/B testing — so brands can't show TikTok users a 7-day trial and Google users a 50% annual discount based on what actually converts each cohort.",
    whatToBuild:
      "ML model predicting 30/60/90/180-day LTV at install time, real-time LTV score fed to Meta/Google bidding APIs, churn probability score for retargeting, attribution-aware paywall rules engine, A/B testing framework tracked by attribution cohort, optimal trial length predictor by source.",
    clients:
      "Subscription apps (fitness, language learning, meditation, productivity), mobile games with IAP.",
    difficulty: 4,
    revenueModel: "$2,000–$10,000/month (high ROI, easy to prove value).",
    aiCost: "AWS SageMaker / Vertex AI ~$2,000–$8,000/month at scale.",
    whyRanked:
      "Subscription economy is exploding; immediate measurable ROI story that sells itself.",
  },
  {
    priority: 4,
    tier: "hot",
    name: "B2B Mobile App Attribution",
    whatsMissing:
      "All MMPs are built for B2C. B2B SaaS companies (Salesforce, Slack, Notion, Figma) need mobile attribution connected to their CRM sales pipeline — \"did the mobile app touch influence the enterprise deal?\"",
    whatToBuild:
      "CRM integration layer (Salesforce, HubSpot, Pipedrive) linking mobile attribution events to contact/deal records, account-level attribution (multiple users from same company = one account), \"Mobile Engagement Score\" per account in CRM, LinkedIn Ads attribution (critical for B2B, unsupported by any MMP), mobile-to-web identity stitching for PLG flows.",
    clients: "B2B SaaS companies with mobile apps, enterprise software, PLG startups.",
    difficulty: 3,
    revenueModel: "$2,000–$20,000/month (B2B buyers pay more).",
    whyRanked: "Barely any competition; B2B is paying more and growing faster than B2C apps.",
  },
  {
    priority: 5,
    tier: "hot",
    name: "Competitive Intelligence & Benchmarking",
    whatsMissing:
      "You don't know if your $3.50 CPI is good or bad for your category. MMPs see aggregated data from thousands of apps but never expose it as benchmarks. Tools like SimilarWeb do download estimates but not campaign-level benchmarks.",
    whatToBuild:
      "Anonymized industry benchmarks by vertical (gaming, fintech, e-commerce, health) — \"Your CPI is 23% above median for casual games in the US\", creative benchmarking — \"Ads with people outperform product-only ads in your category by 40%\", spend trend alerts — \"3 competitors increased TikTok spend 200% this week\", share of voice tracking by channel and geo.",
    clients: "Growth teams at Series A–C companies, UA agencies, brand managers.",
    difficulty: 3,
    revenueModel:
      "$200–$1,000/month; the more customers you have the better your benchmarks — powerful network effect moat.",
  },
  {
    priority: 6,
    tier: "warm",
    name: "Consent-Aware Attribution Modeling",
    whatsMissing:
      "40–60% of iOS users decline ATT and disappear from attribution entirely. GDPR makes this worse in Europe. Nobody has built proper statistical modeling to fill this \"dark matter\" gap using privacy-safe aggregate inference.",
    whatToBuild:
      "Consent gap modeling using statistical inference for non-consented users, privacy-safe aggregate reporting with no individual IDs, \"modeled conversions\" layer, CMP integrations (OneTrust, Usercentrics, Didomi).",
    clients: "Any app with iOS or European users — that's everyone.",
    difficulty: 4,
    revenueModel: "Premium add-on at $500–$3,000/month.",
  },
  {
    priority: 7,
    tier: "warm",
    name: "Multi-App Portfolio Attribution",
    whatsMissing:
      "Gaming studios with 10–50 games can't see cross-app user journeys. When a user installs Game B after playing Game A, attribution tools treat these as completely unrelated events.",
    whatToBuild:
      "Cross-app user identity graph (same user across portfolio), cross-promotion attribution (which games drive installs of other games), portfolio-level cohort LTV by acquisition source, cannibalization detection (is Game B hurting Game A's retention?).",
    clients:
      "Mobile gaming studios (Voodoo, Miniclip, Playtika), media companies with app portfolios, fintech with multiple products.",
    difficulty: 3,
    revenueModel: "$1,000–$5,000/month per studio.",
  },
  {
    priority: 8,
    tier: "warm",
    name: "Developer-Facing Attribution Tooling",
    whatsMissing:
      "AppsFlyer is built for marketers, not engineers. SDK integration is painful — developers spend days debugging why installs aren't being attributed correctly with no good tooling.",
    whatToBuild:
      "Real-time SDK event inspector (like a network debugger for attribution events), attribution sandbox/testing environment to simulate installs without polluting real data, SKAN postback simulator, integration health checks inside the SDK itself, CLI tool for attribution testing.",
    clients: "Mobile developers at any app company.",
    difficulty: 3,
    revenueModel:
      "Freemium — free tier to win developer love → upsell to paid analytics. Top-of-funnel acquisition strategy.",
  },
  {
    priority: 9,
    tier: "warm",
    name: "Retail Media Attribution",
    whatsMissing:
      "Amazon Sponsored Products, Walmart Connect, Instacart Ads, and Target Roundel collectively represent $130B+ in ad spend. Attribution for these channels inside mobile apps is basically zero. Amazon's own tool is walled-garden.",
    whatToBuild:
      "Amazon Attribution API integration, retail media ROAS dashboard alongside paid social and search, purchase path analysis (retail ad exposure → app install → repeat purchaser).",
    clients: "CPG brands, DTC brands selling on Amazon, grocery delivery apps.",
    difficulty: 4,
    revenueModel: "$1,000–$5,000/month.",
  },
  {
    priority: 10,
    tier: "future",
    name: "CTV / Streaming Attribution",
    whatsMissing:
      "CTV (Hulu, Peacock, YouTube TV) ad spend is $30B+ growing 30% YoY. Connecting a Hulu ad exposure to a mobile app install hours later requires household IP-matching and ACR data partnerships — no standard MMP does this.",
    whatToBuild:
      "Household IP-based CTV-to-mobile attribution, Comscore/iSpot.tv data integration for ACR-based attribution, \"halo effect\" measurement (CTV ad exposure uplift on paid social performance).",
    clients:
      "Large consumer app brands running TV campaigns, streaming services, banking/insurance apps.",
    difficulty: 5,
    revenueModel: "$5,000–$20,000/month (enterprise only).",
    aiCost:
      "Probabilistic matching + IP data licenses ~$5,000–$20,000/month. High barrier = less competition.",
  },
  {
    priority: 11,
    tier: "future",
    name: "Out-of-Home (OOH) Attribution",
    whatsMissing:
      "Digital billboards (DOOH) represent a $15B market. A user seeing a Times Square billboard and installing your app an hour later is completely untracked.",
    whatToBuild:
      "Location data partnership (Foursquare, Placer.ai) to detect device exposure near billboard locations, geofencing-based OOH impression logging, probabilistic OOH-to-install matching.",
    clients: "Large consumer app brands with offline budgets.",
    difficulty: 4,
    revenueModel: "Enterprise pricing $5,000+/month.",
  },
  {
    priority: 12,
    tier: "future",
    name: "Offline & In-Store Attribution",
    whatsMissing:
      "The offline-to-online journey (see ad → walk into store → buy → install app) is completely untracked.",
    whatToBuild:
      "QR code attribution at point of sale, receipt-scanning attribution, loyalty card + app install linkage, location visit attribution using opt-in location data.",
    clients: "Retail brands, restaurant chains, CPG companies, banks.",
    difficulty: 5,
    revenueModel: "Enterprise pricing + revenue share models.",
  },
  {
    priority: 13,
    tier: "future",
    name: "AR/VR & Spatial Computing Attribution",
    whatsMissing:
      "Apple Vision Pro, Meta Quest, and mixed reality platforms are brand-new ecosystems with zero attribution tooling. First-mover advantage available right now.",
    whatToBuild:
      "visionOS and Meta Horizon OS SDK for app install attribution, spatial ad format attribution, eye-tracking engagement metrics (unique to spatial computing).",
    clients: "AR/VR app developers, immersive experience companies, enterprise training apps.",
    difficulty: 4,
    revenueModel: "Early-mover pricing; become the default before competition forms.",
  },
  {
    priority: 14,
    tier: "future",
    name: "Creative Production Closed Loop",
    whatsMissing:
      "Creative analytics tells you what works. But nobody closes the loop back to creative production — automatically generating new creative variants based on what the data says performs best.",
    whatToBuild:
      "Integration with AI creative generation (DALL-E, Runway, Midjourney) triggered by creative analytics insights, \"generate 10 variants of your top-performing hook\" workflow, Adobe Creative Cloud / Figma plugin to tag assets at creation time.",
    clients: "UA managers at gaming and e-commerce companies, creative agencies.",
    difficulty: 3,
    revenueModel: "$500–$3,000/month add-on.",
  },
];

/* ------------------------------------------------------------------ */
/* Section 6 — Third-Party AI Cost Model                               */
/* ------------------------------------------------------------------ */

export interface CostCategory {
  name: string;
  usedFor: string;
  unitPricing: string;
}

export const COST_CATEGORIES: CostCategory[] = [
  {
    name: "Frontier LLM APIs (GPT-4o / Claude class)",
    usedFor: "Narrative insights, report generation, natural-language querying",
    unitPricing: "$2.50–$15 per 1M tokens",
  },
  {
    name: "Efficient LLM APIs (mini / haiku class)",
    usedFor: "Event classification, tagging, routine summarization",
    unitPricing: "$0.15–$1.25 per 1M tokens",
  },
  {
    name: "ML model training (SageMaker / Vertex AI)",
    usedFor: "pLTV, churn, and fraud model training runs",
    unitPricing: "$1–$4 per instance-hour",
  },
  {
    name: "ML real-time inference serving",
    usedFor: "Install-time LTV scoring, live fraud checks",
    unitPricing: "$0.10–$0.50 per 1K predictions",
  },
  {
    name: "Data warehouse compute (BigQuery / Snowflake)",
    usedFor: "Cohort queries, benchmark aggregation, clean-room joins",
    unitPricing: "$5–$6.25 per TB scanned / $2–$4 per credit",
  },
  {
    name: "Event stream processing (Kinesis / PubSub)",
    usedFor: "Real-time attribution event ingestion",
    unitPricing: "$0.04–$0.08 per GB ingested",
  },
  {
    name: "IP intelligence & device-graph licenses",
    usedFor: "CTV household matching, cross-device identity",
    unitPricing: "$500–$5,000/month license",
  },
  {
    name: "Location data partnerships (Foursquare / Placer.ai)",
    usedFor: "OOH and in-store visit attribution",
    unitPricing: "$1,000–$10,000/month",
  },
  {
    name: "Generative creative APIs (image / video)",
    usedFor: "Creative variant generation in the closed loop",
    unitPricing: "$0.04–$0.12 per image; $0.05–$0.50 per video-second",
  },
  {
    name: "Embeddings + vector database",
    usedFor: "Creative similarity search, semantic benchmark lookup",
    unitPricing: "$0.02–$0.13 per 1M tokens + $70–$500/month cluster",
  },
];

export interface CostTierEstimate {
  tier: string;
  customers: string;
  llmCosts: string;
  mlCosts: string;
  infraCosts: string;
  dataLicenses: string;
  totalMonthly: string;
}

export const COST_TIER_ESTIMATES: CostTierEstimate[] = [
  {
    tier: "Starter",
    customers: "1,000 customers",
    llmCosts: "$100–$250",
    mlCosts: "$100–$300",
    infraCosts: "$100–$250",
    dataLicenses: "$0 (deferred)",
    totalMonthly: "≈ $300–$800 / month",
  },
  {
    tier: "Growth",
    customers: "10,000 customers",
    llmCosts: "$500–$1,500",
    mlCosts: "$800–$2,500",
    infraCosts: "$700–$2,000",
    dataLicenses: "$0–$500",
    totalMonthly: "≈ $2,000–$6,500 / month",
  },
  {
    tier: "Scale",
    customers: "100,000 customers",
    llmCosts: "$3,000–$8,000",
    mlCosts: "$6,000–$15,000",
    infraCosts: "$4,000–$12,000",
    dataLicenses: "$2,000–$8,000",
    totalMonthly: "≈ $15,000–$43,000 / month",
  },
];

/* ------------------------------------------------------------------ */
/* Section 7 — Recommended Starting Point                              */
/* ------------------------------------------------------------------ */

export interface Recommendation {
  rank: number;
  gapPriority: number;
  name: string;
  rationale: string;
}

export const RECOMMENDATIONS: Recommendation[] = [
  {
    rank: 1,
    gapPriority: 1,
    name: "Attribution Health Monitor",
    rationale:
      "Lowest build cost (★★), zero direct competition, and every single MMP customer needs it. A free health-check tier creates a strong acquisition funnel that naturally upsells into the full platform.",
  },
  {
    rank: 2,
    gapPriority: 2,
    name: "Influencer & Creator Attribution",
    rationale:
      "A $21B market with no serious competitor in this exact niche. Creator-economy brands talk to each other constantly, so a tool that finally attributes creator-driven installs spreads by word of mouth.",
  },
  {
    rank: 3,
    gapPriority: 3,
    name: "Predictive LTV + Paywall Optimization",
    rationale:
      "The subscription economy is exploding and this delivers an immediate, measurable ROI story that sells itself: better paywalls and smarter bids paid for by the tool's own lift.",
  },
];
