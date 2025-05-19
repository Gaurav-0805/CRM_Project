import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { QuillModule } from 'ngx-quill';

@Component({
  selector: 'app-add-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule],
  templateUrl: './add-ticket.component.html',
  styleUrls: ['./add-ticket.component.css']
})
export class AddTicketComponent implements OnInit {
  @Output() ticketAdded = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();

  ticket: any = {
    company_id: '',
    product_id: '',
    category_id: null,
    status_id: '',
    ticket_name: '',
    ticket_description: ''
  };

  companies: any[] = [];
  products: any[] = [];
  categories: any[] = [];
  statuses: any[] = [];

  modules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ header: [1, 2, 3, false] }],
      ['image'],  // ✅ allow image embedding (base64)
      ['clean']
    ]
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const headers = this.getAuthHeaders();

    this.http.get(`${environment.apiBaseUrl}/companies/customers`, { headers }).subscribe((res: any) => {
      this.companies = res;
    });

    this.http.get(`${environment.apiBaseUrl}/products`, { headers }).subscribe((res: any) => {
      this.products = res;
    });

    this.http.get(`${environment.apiBaseUrl}/tickets/status`, { headers }).subscribe((res: any) => {
      this.statuses = res;
    });

    this.http.get(`${environment.apiBaseUrl}/categories`, { headers }).subscribe((res: any) => {
      this.categories = res;
    });
  }

  submit(): void {
    const {
      ticket_name,
      ticket_description,
      product_id,
      status_id,
      category_id,
      company_id,
      assigned_to
    } = this.ticket;

    if (!ticket_name?.trim()) return alert('Ticket Title is required.');
    if (!ticket_description?.trim()) return alert('Ticket Description is required.');
    if (!product_id || isNaN(product_id)) return alert('Product must be selected.');
    if (!status_id || isNaN(status_id)) return alert('Status must be selected.');
    if (!category_id || isNaN(category_id)) return alert('Category must be selected.');

    const headers = this.getAuthHeaders();
    const formData = new FormData();

    formData.append('ticket_name', ticket_name);
    formData.append('ticket_description', ticket_description); // Base64 embedded HTML
    formData.append('product_id', String(product_id));
    formData.append('status_id', String(status_id));
    formData.append('category_id', String(category_id));

    if (company_id && !isNaN(company_id)) {
      formData.append('company_id', String(company_id));
    }

    if (assigned_to && !isNaN(assigned_to)) {
      formData.append('assigned_to', String(assigned_to));
    }

    this.http.post(`${environment.apiBaseUrl}/tickets`, formData, { headers }).subscribe({
      next: (res) => {
        console.log('✅ Ticket created:', res);
        this.ticketAdded.emit(res);
        this.close.emit();
      },
      error: (err) => {
        console.error('❌ Failed to submit ticket:', err);
        alert('Ticket creation failed. See console for details.');
      }
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
