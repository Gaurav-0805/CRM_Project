import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { CompanyKeyComponent } from '../company-key/company-key.component';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, CompanyKeyComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username = '';
  password = '';
  company_key = '';
  errorMessage = '';
  showLoginForm = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/admin'], { replaceUrl: true });
    }
  }

  onCompanyKeyReceived(key: string) {
    this.company_key = key;
    this.showLoginForm = true;
  }

  login() {
    const body = {
      username: this.username,
      password: this.password,
      company_key: this.company_key
    };

    const apiUrl = `${environment.apiBaseUrl}/auth/login`;

    this.http.post<any>(apiUrl, body).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('role', res.user.role);

        const role = res.user.role;

        // 🔁 Role-specific redirect
        let targetRoute = '/admin';

        switch (role) {
          case 'Admin':
          case 'Support':
          case 'Customer':
            targetRoute = '/admin/customers';
            break;
          case 'Developer':
            targetRoute = '/admin/tickets';
            break;
          default:
            targetRoute = '/';
        }

        this.router.navigate([targetRoute], { replaceUrl: true });
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'Login failed. Please try again.';
      }
    });
  }
}
