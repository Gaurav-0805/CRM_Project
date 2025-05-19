import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';   // ✅ Required for *ngIf, *ngFor
import { FormsModule } from '@angular/forms';     // ✅ Required for [(ngModel)]
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-add-invoice',
  standalone: true,
  templateUrl: './add-invoice.component.html',
  styleUrls: ['./add-invoice.component.css'],
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class AddInvoiceComponent implements OnInit {
  @Output() invoiceAdded = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();

  invoice = {
    company_id: null,
    amount: null,
    due_date: '',
    // ❗ No need to set status_id manually anymore — backend handles it.
  };

  companies: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token')}`
    });

    // ✅ Fetch companies for dropdown
    this.http.get(`${environment.apiBaseUrl}/companies/customers`, { headers })
      .subscribe({
        next: (res: any) => {
          this.companies = res;
        },
        error: (err) => {
          console.error('❌ Failed to load companies:', err);
        }
      });
  }

  submit(): void {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token')}`
    });

    // Send invoice without manually setting status_id
    this.http.post(`${environment.apiBaseUrl}/invoices`, this.invoice, { headers }).subscribe({
      next: (res) => {
        this.invoiceAdded.emit(res);  // ✅ Now it will contain FULL invoice details
        this.close.emit();            // ✅ Close the modal
      },
      error: (err) => {
        console.error('❌ Failed to add invoice:', err);
      }
    });
  }
}
