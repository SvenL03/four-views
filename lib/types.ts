export interface TraditionOption {
  id: string;
  name: string;
  shortName: string;
  description: string;
  systemPrompt: string;
  accentColor: string; // Tailwind border color class
  badgeClass: string;  // Tailwind badge bg/text classes
}

export interface SelectedTradition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  accentColor: string;
  badgeClass: string;
}

export interface ViewState {
  tradition: SelectedTradition;
  text: string;
  isLoading: boolean;
  isComplete: boolean;
  error: string | null;
}

export interface TheologianState {
  name: string;
  text: string;
  isLoading: boolean;
  isComplete: boolean;
  error: string | null;
}

export interface AgreementPair {
  tradition1Id: string;
  tradition1Name: string;
  tradition2Id: string;
  tradition2Name: string;
  score: number; // 0-100
  note: string;  // one-sentence explanation
}

export interface AgreementResult {
  overallConsensus: number; // 0-100
  summary: string;
  pairs: AgreementPair[];
}

export interface AgreementState {
  result: AgreementResult | null;
  isLoading: boolean;
  error: string | null;
}
