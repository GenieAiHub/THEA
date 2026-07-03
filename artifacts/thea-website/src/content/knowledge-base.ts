export type KbBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul"; items: string[] };

export type KbArticle = {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  body: KbBlock[];
};

export const KB_CATEGORY_ORDER = [
  "Getting Started",
  "Platform",
  "Intelligence",
  "Integrations",
  "Security",
];

export const KB_ARTICLES: KbArticle[] = [
  {
    slug: "getting-started-with-thea",
    title: "Getting started with THEA",
    description:
      "A quick tour of the THEA workspace and the first steps to go from sign-up to your first live alert.",
    category: "Getting Started",
    readTime: "4 min read",
    body: [
      {
        type: "p",
        text: "THEA turns the global conversation into intelligence you can act on. This guide walks you through the essentials so you can get value in your first session.",
      },
      { type: "h", text: "1. Define what you care about" },
      {
        type: "p",
        text: "Start by adding the entities that matter to you — your brand, executives, competitors, campaigns, or policy areas. THEA immediately begins monitoring these across its full source network.",
      },
      { type: "h", text: "2. Set your alert thresholds" },
      {
        type: "p",
        text: "Choose how sensitive your alerts should be and where they should go. You can route severity-graded alerts to email, Slack, Teams, SMS, or a webhook.",
      },
      { type: "h", text: "3. Review your first briefing" },
      {
        type: "p",
        text: "Within minutes, THEA surfaces the trends, sentiment, and anomalies around your entities. From here you can drill into any signal, compare against baseline, and draft a response.",
      },
      {
        type: "ul",
        items: [
          "Add 3–5 high-priority entities to start",
          "Connect at least one real-time alert channel",
          "Bookmark the trends that matter for daily review",
        ],
      },
    ],
  },
  {
    slug: "building-effective-watchlists",
    title: "Building effective watchlists",
    description:
      "How to use Boolean queries to track exactly the entities you care about — without drowning in noise.",
    category: "Getting Started",
    readTime: "5 min read",
    body: [
      {
        type: "p",
        text: "A watchlist tells THEA precisely what to monitor. Well-built watchlists are the difference between sharp intelligence and constant noise.",
      },
      { type: "h", text: "Use Boolean logic" },
      {
        type: "p",
        text: "Combine terms with AND, OR, and NOT to capture the exact conversation you want. Group related spellings, product names, and executive handles together, and exclude unrelated homonyms.",
      },
      { type: "h", text: "Track entities, not just keywords" },
      {
        type: "p",
        text: "Beyond keywords, track competitors, executives, product lines, and industry terminology so THEA can resolve mentions and score sentiment against the right subject.",
      },
      {
        type: "ul",
        items: [
          "Start broad, then tighten based on the results you see",
          "Use NOT clauses to remove predictable false positives",
          "Create separate watchlists per theme for cleaner reporting",
        ],
      },
    ],
  },
  {
    slug: "understanding-severity-graded-alerts",
    title: "Understanding severity-graded alerts",
    description:
      "How THEA classifies alerts from Low to Critical so your team acts on what matters and ignores the rest.",
    category: "Platform",
    readTime: "4 min read",
    body: [
      {
        type: "p",
        text: "Not every spike is a crisis. THEA grades every alert by severity so your team can triage instantly and avoid alert fatigue.",
      },
      { type: "h", text: "The severity scale" },
      {
        type: "ul",
        items: [
          "Low (Information) — notable movement worth awareness, no action required",
          "Medium — a developing shift that may need monitoring or a prepared response",
          "High — a significant anomaly likely to require action soon",
          "Critical (Immediate Action) — a fast-moving event demanding a response now",
        ],
      },
      { type: "h", text: "Routing by severity" },
      {
        type: "p",
        text: "Route each severity level to the right people and channel. Send Critical alerts to on-call staff via SMS or Slack, while Low alerts collect in a daily digest.",
      },
    ],
  },
  {
    slug: "how-sentiment-analysis-works",
    title: "How sentiment analysis works",
    description:
      "A look at how THEA quantifies public emotion with context, sarcasm, and nuance across 75+ languages.",
    category: "Intelligence",
    readTime: "5 min read",
    body: [
      {
        type: "p",
        text: "Sentiment analysis is how THEA turns raw text into a measure of how the world feels about a topic. But real conversation is messy, so THEA looks beyond simple keyword polarity.",
      },
      { type: "h", text: "Context over keywords" },
      {
        type: "p",
        text: "THEA's NLP models evaluate meaning in context — understanding negation, sarcasm, and tone rather than counting positive and negative words. This produces scores that reflect what people actually mean.",
      },
      { type: "h", text: "Multilingual by design" },
      {
        type: "p",
        text: "Sentiment is scored across 75+ languages simultaneously, so a narrative forming in one language is measured alongside the global conversation instead of being missed.",
      },
    ],
  },
  {
    slug: "what-is-trend-detection",
    title: "What is real-time trend detection?",
    description:
      "How THEA spots emerging narratives early by measuring the velocity and vector of conversation shifts.",
    category: "Intelligence",
    readTime: "4 min read",
    body: [
      {
        type: "p",
        text: "Trend detection identifies narratives while they are still forming — before they reach critical mass. THEA does this by continuously modeling the shape of the conversation.",
      },
      { type: "h", text: "Velocity and vector" },
      {
        type: "p",
        text: "Rather than reporting yesterday's totals, THEA measures how fast a topic is accelerating and in what direction sentiment is moving. This is what lets you see the ripples before the wave.",
      },
      { type: "h", text: "From baseline to anomaly" },
      {
        type: "p",
        text: "THEA learns the normal rhythm of each topic and flags meaningful breaks from that baseline, separating genuine emerging trends from routine daily fluctuation.",
      },
    ],
  },
  {
    slug: "using-ai-drafted-statements",
    title: "Using AI-drafted statements",
    description:
      "How THEA generates context-aware talking points and holding statements — with a human always in the loop.",
    category: "Platform",
    readTime: "4 min read",
    body: [
      {
        type: "p",
        text: "When a situation demands a response, THEA drafts talking points, holding statements, and rebuttals grounded in the live event, so your team starts from a strong first draft instead of a blank page.",
      },
      { type: "h", text: "Matched to your voice" },
      {
        type: "p",
        text: "Enterprise deployments can fine-tune THEA on your historical statements, brand guidelines, and tone so generated drafts sound like your organization.",
      },
      { type: "h", text: "Human review by design" },
      {
        type: "p",
        text: "AI-generated content is a starting point, not a publish button. Every draft is meant to be reviewed and approved by a qualified person before it goes out.",
      },
    ],
  },
  {
    slug: "connecting-thea-via-api-and-webhooks",
    title: "Connecting THEA via API and webhooks",
    description:
      "Integrate THEA's intelligence into your own dashboards and workflows using the REST API and custom webhooks.",
    category: "Integrations",
    readTime: "5 min read",
    body: [
      {
        type: "p",
        text: "THEA is built to fit into your existing stack. Two primary mechanisms let you move intelligence wherever your team already works.",
      },
      { type: "h", text: "Enterprise REST API" },
      {
        type: "p",
        text: "Query trends, sentiment, and alerts programmatically to power internal dashboards, CRMs, or command-center software with THEA's cognitive engine.",
      },
      { type: "h", text: "Custom webhooks" },
      {
        type: "p",
        text: "Trigger automated workflows in Zapier, Slack, Teams, or proprietary systems the moment specific sentiment thresholds are breached — no polling required.",
      },
    ],
  },
  {
    slug: "data-sources-and-coverage",
    title: "Data sources and coverage",
    description:
      "What THEA monitors: 150,000+ sources and 4B+ daily data points across news, social, and the wider web.",
    category: "Intelligence",
    readTime: "4 min read",
    body: [
      {
        type: "p",
        text: "THEA's intelligence is only as good as its coverage. The platform ingests from a deliberately broad and diverse source network.",
      },
      { type: "h", text: "Where the data comes from" },
      {
        type: "ul",
        items: [
          "Major social networks and short-form platforms",
          "Global news APIs covering tens of thousands of publications",
          "Decentralized networks, forums, and communities",
          "Curated RSS feeds and custom sources you add",
        ],
      },
      { type: "h", text: "Scale" },
      {
        type: "p",
        text: "In total, THEA monitors 150,000+ sources and processes more than 4 billion distinct data points every day, normalized into a single, queryable view.",
      },
    ],
  },
  {
    slug: "security-and-data-handling",
    title: "Security and data handling",
    description:
      "How THEA protects your watchlists, internal data, and generated content with encryption and strict access controls.",
    category: "Security",
    readTime: "4 min read",
    body: [
      {
        type: "p",
        text: "Security is foundational to an intelligence platform. THEA is designed to keep your data siloed, protected, and under your control.",
      },
      { type: "h", text: "How your data is protected" },
      {
        type: "ul",
        items: [
          "Operated under SOC 2 Type II and ISO 27001 practices",
          "Encryption of data in transit and at rest",
          "Your watchlists and generated statements are siloed to your organization",
          "Your data is never used to train the base model",
        ],
      },
      { type: "h", text: "Access control" },
      {
        type: "p",
        text: "Access is limited to authorized members of your organization, with controls designed to prevent unauthorized use. For full details, see our Privacy Policy.",
      },
    ],
  },
];

export function getArticle(slug: string): KbArticle | undefined {
  return KB_ARTICLES.find((a) => a.slug === slug);
}
