export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string; // Ex: "5534999990000" ou "(34) 99999-0000"
  street: string;
  houseNumber: number; // 1 a 600
  status: 'pending' | 'approved' | 'rejected';
  role: 'morador' | 'porteiro' | 'secretaria' | 'sindico';
}