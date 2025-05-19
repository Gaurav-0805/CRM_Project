import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor() {}

  /**
   * Check if the user is logged in based on presence of token
   */
  isLoggedIn(): boolean {
    const token = localStorage.getItem('token');
    return !!token;
  }

  /**
   * Logs out the user by clearing stored data
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  /**
   * Safely gets the user role from localStorage
   */
  getUserRole(): string | null {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user).role : null;
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
      return null;
    }
  }

  /**
   * Optionally get the token for attaching to requests
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * ✅ New:s Get full current user object from localStorage
   */
  getCurrentUser(): any {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
      return null;
    }
  }
}
