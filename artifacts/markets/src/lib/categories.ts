import {
  Bitcoin,
  Clapperboard,
  Cpu,
  HeartPulse,
  Landmark,
  Leaf,
  Megaphone,
  Newspaper,
  Radio,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface MarketCategory {
  name: string;
  icon: LucideIcon;
}

/**
 * Canonical THEA market taxonomy. Mirrors the backend VALID_CATEGORIES list so
 * the browse bar always shows the full set of categories, even ones that don't
 * yet have live markets. Live counts are merged in from the API at render time.
 */
export const MARKET_CATEGORIES: MarketCategory[] = [
  { name: "Politics", icon: Landmark },
  { name: "Crypto", icon: Bitcoin },
  { name: "Technology", icon: Cpu },
  { name: "Sports", icon: Trophy },
  { name: "Entertainment", icon: Clapperboard },
  { name: "Society", icon: Users },
  { name: "Media", icon: Radio },
  { name: "Health", icon: HeartPulse },
  { name: "Environment", icon: Leaf },
  { name: "Branding", icon: Megaphone },
  { name: "News", icon: Newspaper },
];
