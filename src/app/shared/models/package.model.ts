export type CarrierType = 'Mercado Livre' | 'Shopee' | 'Amazon' | 'Correios' | 'Outros';

export interface PackageItem {
  id: string;
  houseNumber: number;
  recipientName: string;
  carrier: CarrierType;
  storageLocation?: string;
  pickupPin: string;
  status: 'aguardando' | 'entregue';

  // Auditoria de Entrada
  receivedAt: number;
  receivedById: string;
  receivedByName: string;

  // Auditoria de Retirada
  pickedUpAt?: number;
  pickedUpByName?: string;
  pickedUpByDoc?: string;
  releasedById?: string;
  releasedByName?: string;
  validationMethod?: 'pin' | 'manual';
}