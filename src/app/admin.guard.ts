import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { canAccessAdminRoute } from './core/services/rbac.service';

export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = await authService.waitForRole();
  if (canAccessAdminRoute(role)) return true;
  router.navigate(['']);
  return false;
};
