export type AtaStatus = 'open' | 'approved' | 'rejected';
export type VoteChoice = 'A Favor' | 'Contra' | 'Abster';

export interface Ata {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  date: string;
  dateFormatted: string;
  time?: string;
  location?: string;
  status: AtaStatus;
  statusLabel: string;
  pdfUrl?: string;
  userVote?: VoteChoice;
  votesCount?: {
    favorable: number;
    against: number;
    abstain: number;
  };
}