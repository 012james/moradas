export interface UserProfile {
  uid: string;
  nome: string;
  email: string;
  casaSolicitada: string;
  createdAt: string;
  houseNumber: number; // Número de 1 a 600
  status: 'pending' | 'approved' | 'rejected';
  role: 'morador' | 'admin';
}