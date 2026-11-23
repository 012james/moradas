import { Routes } from '@angular/router';
import { roleGuard } from './guards/role.guard';

// Componentes do Morador
import { AtasListComponent } from './features/atas-list/atas-list.component';
import { AtaDetailComponent } from './features/ata-detail/ata-detail.component';
import { MinhasEncomendasComponent } from './features/minhas-encomendas/minhas-encomendas.component';
import { MeusVisitantesComponent } from './features/meus-visitantes/meus-visitantes.component';
import { ReservasComponent } from './features/reservas/reservas.component';
import { MeusBoletosComponent } from './features/meus-boletos/meus-boletos.component';
import { AvisosComponent } from './features/avisos/avisos.component';


// Componentes da Portaria e Administração (Síndico)

import { PortariaEncomendasComponent } from './features/portaria-encomendas/portaria-encomendas.component';
import { PortariaVisitantesComponent } from './features/portaria-visitantes/portaria-visitantes.component';
import { SindicoApprovalComponent } from './features/sindico-approval/sindico-approval.component';

import { AdminBoletosComponent } from './features/admin-boletos/admin-boletos.component';

import { PerfilComponent } from './features/user/user.component';
import { AdminComponent } from './features/admin/admin.component';
import { AtaCreateComponent } from './features/ata-create/ata-create.component';
import { LoginComponent } from './features/login/login.component';
import { RegisterComponent } from './features/register/register.component';
import { registrationGuard } from './guards/registration.guard';

export const routes: Routes = [
 
  // --- ÁREA DO MORADOR (Casas 1 a 606) ---
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: '', redirectTo: 'atas', pathMatch: 'full' },
  {
    path: 'termos',
    loadComponent: () =>
      import('./features/termos-uso/termos-uso.component').then(
        (m) => m.TermosUsoComponent
      )
  },


  { path: 'atas', component: AtasListComponent, canActivate: [registrationGuard] },
  { path: 'atas/:id', component: AtaDetailComponent, canActivate: [registrationGuard] },
  { path: 'encomendas', component: MinhasEncomendasComponent, canActivate: [registrationGuard] },
  { path: 'visitantes', component: MeusVisitantesComponent, canActivate: [registrationGuard] },
  { path: 'reservas', component: ReservasComponent, canActivate: [registrationGuard] },
  { path: 'boletos', component: MeusBoletosComponent, canActivate: [registrationGuard] },
  { path: 'avisos', component: AvisosComponent, canActivate: [registrationGuard] },
  { path: 'perfil', component: PerfilComponent, canActivate: [registrationGuard] },

  // --- OPERAÇÃO DA PORTARIA & SÍNDICO ---
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [roleGuard(['porteiro', 'sindico', 'secretaria'])]
  },
  {
    path: 'admin/portaria',
    component: PortariaEncomendasComponent,
    canActivate: [roleGuard(['porteiro', 'sindico'])]
  },
  {
    path: 'admin/visitantes',
    component: PortariaVisitantesComponent,
    canActivate: [roleGuard(['porteiro', 'sindico'])]
  },

  // --- EXCLUSIVO DO SÍNDICO ---
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [roleGuard(['porteiro', 'sindico'])]
  },
  {
    path: 'admin/aprovacoes',
    component: SindicoApprovalComponent,
    canActivate: [roleGuard(['sindico'])]
  },
  {
    path: 'admin/nova-ata',
    component: AtaCreateComponent,
    canActivate: [roleGuard(['sindico'])]
  },
  {
    path: 'admin/boletos',
    component: AdminBoletosComponent,
    canActivate: [roleGuard(['sindico', 'secretaria'])]
  },

  { path: '**', redirectTo: 'atas' }
];