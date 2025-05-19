import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ClientSideRowModelModule, Module, GridReadyEvent, ModuleRegistry } from 'ag-grid-community';

// ✅ Register required AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

type TabType = 'Overview' | 'Invoices' | 'Payments' | 'Tickets' | 'Subscriptions';

const Tabs: { [key in TabType]: TabType } = {
  Overview: 'Overview',
  Invoices: 'Invoices',
  Payments: 'Payments',
  Tickets: 'Tickets',
  Subscriptions: 'Subscriptions',
};

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './customer-detail.component.html',
  styleUrls: ['./customer-detail.component.css']
})
export class CustomerDetailComponent implements OnInit {
  Tabs = Tabs;
  customerId: string = '';
  selectedTab: TabType = Tabs.Overview;

  customer: any = null;
  invoices: any[] = [];
  payments: any[] = [];
  tickets: any[] = [];
  subscriptions: any[] = [];

  headers!: HttpHeaders;
  public modules: Module[] = [ClientSideRowModelModule];

  gridApi: any;
  gridColumnApi: any;

  defaultColDef = {
    resizable: true,
    sortable: true,
    filter: true,
    flex: 1,
    minWidth: 120
  };

  invoiceColumnDefs = [
    { headerName: '#', valueGetter: 'node.rowIndex + 1', width: 70, cellStyle: { textAlign: 'center' } },
    { field: 'invoice_number', headerName: 'Invoice' },
    { field: 'amount', headerName: 'Amount', valueFormatter: (params: any) => '₹' + this.formatNumber(params.value) },
    { field: 'due_date', headerName: 'Due Date', valueFormatter: (params: any) => this.formatDate(params.value) },
    { field: 'status', headerName: 'Status' }
  ];

  paymentColumnDefs = [
    { headerName: '#', valueGetter: 'node.rowIndex + 1', width: 70, cellStyle: { textAlign: 'center' } },
    { field: 'invoice_number', headerName: 'Invoice' },
    { field: 'amount_paid', headerName: 'Paid', valueFormatter: (params: any) => '₹' + this.formatNumber(params.value) },
    { field: 'payment_method', headerName: 'Method' },
    { field: 'paid_at', headerName: 'Date', valueFormatter: (params: any) => this.formatDate(params.value) }
  ];

  ticketColumnDefs = [
    { headerName: '#', valueGetter: 'node.rowIndex + 1', width: 70 },
    { field: 'ticket_name', headerName: 'Ticket Name' }, // ✅ Add this line
    { field: 'status', headerName: 'Status' },
    { field: 'created_at', headerName: 'Created On' },
    { field: 'assigned_to_name', headerName: 'Assigned To' }
  ];
  

  subscriptionColumnDefs = [
    { headerName: '#', valueGetter: 'node.rowIndex + 1', width: 70, cellStyle: { textAlign: 'center' } },
    { field: 'product_name', headerName: 'Product' },
    { field: 'start_date', headerName: 'Start Date', valueFormatter: (params: any) => this.formatDate(params.value) },
    { field: 'end_date', headerName: 'End Date', valueFormatter: (params: any) => this.formatDate(params.value) }
  ];

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.customerId = this.route.snapshot.params['id'];
    const token = localStorage.getItem('token') || '';
    this.headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.fetchCustomerDetails();
  }

  goBack(): void {
    this.router.navigate(['/admin/customers']);
  }

  setTab(tab: TabType): void {
    this.selectedTab = tab;
    switch (tab) {
      case Tabs.Invoices: this.fetchInvoices(); break;
      case Tabs.Payments: this.fetchPayments(); break;
      case Tabs.Tickets: this.fetchTickets(); break;
      case Tabs.Subscriptions: this.fetchSubscriptions(); break;
    }
  }

  get outstandingAmount(): number {
    const totalInvoiceAmount = this.invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalPaidAmount = this.payments.reduce((sum, pay) => sum + (pay.amount_paid || 0), 0);
    return totalInvoiceAmount - totalPaidAmount;
  }

  fetchCustomerDetails(): void {
    this.http.get(`${environment.apiBaseUrl}/companies/customers/${this.customerId}`, { headers: this.headers })
      .subscribe({
        next: (res) => this.customer = res,
        error: (err) => console.error('❌ Error fetching customer details:', err)
      });
  }

  fetchInvoices(): void {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isCustomer = user.role === 'Customer';

 const url = isCustomer
  ? `${environment.apiBaseUrl}/invoices/my-invoices`
  : `${environment.apiBaseUrl}/invoices/by-company/${this.customerId}`;

  this.http.get(url, { headers: this.headers })
    .subscribe(
      (res) => this.invoices = res as any[],
      (err) => console.error('❌ Error fetching invoices:', err)
    );
}

  fetchPayments(): void {
    const today = new Date();
    const lastYear = new Date();
    lastYear.setFullYear(today.getFullYear() - 1);

    const startDate = lastYear.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    this.http.get(`${environment.apiBaseUrl}/payments?startDate=${startDate}&endDate=${endDate}&company_id=${this.customerId}`, {
      headers: this.headers
    }).subscribe(
      (res) => this.payments = res as any[],
      (err) => console.error('❌ Error fetching payments:', err)
    );
  }

  fetchTickets(): void {
    this.http.get(`${environment.apiBaseUrl}/tickets/by-company/${this.customerId}`, { headers: this.headers })
      .subscribe(
        (res) => this.tickets = res as any[],
        (err) => console.error('❌ Error fetching tickets:', err)
      );
  }

  fetchSubscriptions(): void {
    this.http.get(`${environment.apiBaseUrl}/companies/customers/${this.customerId}/subscriptions`, { headers: this.headers })
      .subscribe(
        (res) => this.subscriptions = res as any[],
        (err) => console.error('❌ Error fetching subscriptions:', err)
      );
  }

  formatNumber(value: any): string {
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    setTimeout(() => this.gridApi.sizeColumnsToFit());
  }
}
