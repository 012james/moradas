import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'atas',
    loadComponent: () => import('./features/atas-list/atas-list.component').then(m => m.AtasListComponent)
  },
  {
    path: 'new-ata',
    loadComponent: () => import('./features/ata-create/ata-create.component').then(m => m.AtaCreateComponent)
  },
  {
    path: 'atas/:id',
    loadComponent: () => import('./features/ata-detail/ata-detail.component').then(m => m.AtaDetailComponent)
  },
    {
    path: 'user',
    loadComponent: () => import('./features/user/user.component').then(m => m.UserComponent)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];