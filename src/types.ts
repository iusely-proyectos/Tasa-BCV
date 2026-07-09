export interface RateState {
  usd: number;
  eur: number;
  cny: number;
  try: number;
  rub: number;
  rawUsd: number;
  rawEur: number;
  rawCny: number;
  rawTry: number;
  rawRub: number;
  dateText: string;
  updatedAt: string;
}

export interface HistoryItem {
  id: string;
  usd: number;
  eur: number;
  dateText: string;
  updatedAt: string;
}

export interface AppState {
  current: RateState;
  history: HistoryItem[];
}

export interface ScrapeResponse {
  success: boolean;
  message: string;
  state: AppState;
}
