export type SpaceId = 'salao_festas' | 'quiosque_1' | 'quiosque_2';

export interface CondoSpaceConfig {
  id: SpaceId;
  name: string;               // Ex: "Salão de Festas", "Quiosque 1 (Churrasqueira)"
  icon: string;               // Material Symbol ex: "celebration", "outdoor_grill"
  fee: number;                // Valor da taxa ex: 150.00 ou 50.00
  capacity: number;           // Limite de convidados
  hours: string;              // Ex: "09h00 às 22h00"
  cancellationHours: number;  // Prazo sem multa ex: 48 horas antes
  rules: string[];            // Lista clara de regras e responsabilidades
}

export interface ReservationItem {
  id: string;                 // Chave única: `${spaceId}_${date}` (trava anti-duplicidade)
  spaceId: SpaceId;
  spaceName: string;
  date: string;               // Formato YYYY-MM-DD
  feeSnapshot: number;        // Valor vigente no ato da reserva (vai para o próximo boleto)
  houseNumber: number;        // 1 a 600
  residentUid: string;
  residentName: string;
  residentPhone?: string;
  acceptedRules: boolean;
  createdAt: number;

  // Rastreio Financeiro (evita cobrar 2x a mesma reserva)
  billedInInvoiceId?: string;
  billedReferenceMonth?: string;
}