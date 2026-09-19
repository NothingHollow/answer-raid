export interface RankedQuestion {
  id: string;
  zh: { prompt: string; options: string[]; explain?: string };
  en: { prompt: string; options: string[]; explain?: string };
  tags: string[];
  code?: string;
  chartKind?: string;
  chartData?: string;
}

export interface RankedRun {
  id: string;
  version: number;
  handle: string;
  phase: 'question' | 'review' | 'over' | 'abandoned';
  tier: string;
  progress: number;
  lives: number;
  score: number;
  correct: number;
  answered: number;
  combo: number;
  bestCombo: number;
  cleared: boolean;
  jokers: number;
  hint: boolean;
  eliminated: number[];
  deadline: number;
  serverNow: number;
  question: RankedQuestion;
  feedback: { correct: boolean; answer: number; picked: number; gain: number; timeout: boolean } | null;
}

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  player: string;
  score: number;
  tier: string;
  correct: number;
  answered: number;
  combo: number;
  cleared: boolean;
  at: string;
}

export type RankedAction = 'read' | 'answer' | 'next' | 'hint' | 'freeze' | 'fifty' | 'abandon';
