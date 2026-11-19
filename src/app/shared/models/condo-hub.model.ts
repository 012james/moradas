export type NoticePriority = 'urgente' | 'manutencao' | 'informativo';

export interface NoticeItem {
  id: string;
  title: string;
  content: string;
  priority: NoticePriority;
  pinned: boolean;
  createdAt: number;
  authorName: string;
}

export interface CondoContact {
  id: string;
  roleTitle: string;     // Ex: "Portaria 24h", "Secretaria / Administração"
  schedule: string;      // Ex: "Atendimento 24 horas", "Seg a Sex • 08h às 17h"
  phone: string;         // Ex: "(34) 3820-0000"
  whatsapp?: string;     // Apenas números com DDD ex: "5534999990000"
  notes?: string;        // Ex: "Interfone: Ramal 9"
}

export interface CondoRule {
  id: string;
  icon: string;          // Ícone Material Symbols ex: "volume_off", "construction", "speed"
  title: string;         // Ex: "Horário de Silêncio"
  summary: string;       // Ex: "Das 22h às 08h. Evite ruídos..."
}

export interface CondoGeneralSettings {
  regimentoPdfUrl?: string;
  contacts: CondoContact[];
  rules: CondoRule[];
  updatedAt?: number;
  updatedBy?: string;
}