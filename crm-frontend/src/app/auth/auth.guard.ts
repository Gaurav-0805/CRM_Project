import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  Router
} from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    // ✅ 1. Check if the user is logged in
    if (!this.authService.isLoggedIn()) {
      return this.router.createUrlTree(['/login']);
    }

    // ✅ 2. If route has role restrictions
    const allowedRoles = route.data['roles'] as string[] | undefined;
    if (allowedRoles && allowedRoles.length > 0) {
      const user = this.authService.getCurrentUser();
      if (!user || !allowedRoles.includes(user.role)) {
        // 🔁 Redirect to login instead of unauthorized
        return this.router.createUrlTree(['/login']);
      }
    }

    // ✅ 3. Allow access
    return true;
  }
}
