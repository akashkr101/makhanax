import { Routes } from '@angular/router';
import { adminGuard } from './admin.guard';
import { App } from './app';

export const routes: Routes = [
  { path: 'admin', loadComponent: () => import('./admin/admin-dashboard.component').then((module) => module.AdminDashboardComponent), canActivate: [adminGuard] },
  { path: '', component: App },
  { path: '**', redirectTo: '' }
];
