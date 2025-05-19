import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-company-key',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './company-key.component.html',
  styleUrl: './company-key.component.css'
})
export class CompanyKeyComponent {
  key = '';
  @Output() keyChanged = new EventEmitter<string>();

  constructor(private router: Router) {} // ✅ Inject Router

  continue() {
    if (this.key.trim()) {
      localStorage.setItem('companyKey', this.key.trim()); // ✅ Save key
      this.keyChanged.emit(this.key.trim());               // Optional: emit key if needed
      this.router.navigate(['/login']);                    // ✅ Navigate to login page
    }
  }
}
