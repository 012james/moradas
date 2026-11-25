export type AtaStatus = 'open' | 'closed' | 'aberta' | 'encerrada';
export type VoteChoice = 'favor' | 'contra' | 'abster' | 'approved' | 'rejected' | 'abstain';
export type AtaOutcome = 'approved' | 'rejected' | 'insufficient_votes' | 'aprovada' | 'reprovada';

export interface Ata {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  location?: string;
  pdfUrl?: string;
  status: AtaStatus;
  outcome?: AtaOutcome;
  minimumQuorum?: number;
  expiresAt?: any;
  date?: string;
  votesCount?: number;
  favorCount?: number;
  contraCount?: number;
  absterCount?: number;
  approvedCount?: number;
  rejectedCount?: number;
  abstainCount?: number;
  userVote?: VoteChoice | null;
  createdAt?: number;
  createdByUid?: string;
  createdByName?: string;
}

export interface VoteAuditItem {
  houseNumber: number;
  voterName: string;
  voterUid: string;
  choice: 'favor' | 'contra' | 'abster';
  votedAt: Date | null;
}