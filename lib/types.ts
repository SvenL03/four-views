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
