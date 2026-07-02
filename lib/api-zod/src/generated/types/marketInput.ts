export interface MarketInput {
  question: string;
  description?: string;
  category: string;
  options: string[];
  closesAt?: Date;
}
