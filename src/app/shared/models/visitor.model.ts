export type VisitorAccessType = 'unico' | 'permanente';
export type VisitorCategory = 'Convidado / Familiar' | 'Prestador de Serviço' | 'Diarista / Fixo';

export interface VisitorAuthorization {
  id: string;
  houseNumber: number;           // 1 a 606
  visitorName: string;
  visitorDoc?: string;           // RG/CPF opcional
  vehiclePlate?: string;         // Ex: "ABC-1D23"
  category: VisitorCategory;
  accessType: VisitorAccessType; // 'unico' (data específica) ou 'permanente' (sempre liberado)
  validDate?: string;            // YYYY-MM-DD (obrigatório quando accessType === 'unico')
  notes?: string;                // Ex: "Técnico de internet", "Segundas e Quintas"
  active: boolean;               // Permite pausar/revogar um visitante permanente em 1 toque

  // Quem liberou na casa
  authorizedByUid: string;
  authorizedByName: string;
  createdAt: number;

  // Auditoria da Guarita (Portaria)
  lastEntryAt?: number;
  lastCheckedInBy?: string;
  entryCount?: number;
}

export interface VisitorLog {
  id?: string;
  visitorId: string;
  houseNumber: number;
  visitorName: string;
  category: string;
  accessType: 'unico' | 'permanente';
  vehiclePlate?: string;
  visitorDoc?: string;
  authorizedByName: string;
  checkedInByUid: string;
  checkedInByName: string;
  enteredAt: number;
}