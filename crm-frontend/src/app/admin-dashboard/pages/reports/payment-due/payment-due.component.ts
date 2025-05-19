import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { TabStateService } from '../../../../shared/tab-state.service';
import { Subscription } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';

@Component({
  selector: 'app-payment-due',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './payment-due.component.html',
  styleUrls: ['./payment-due.component.css']
})
export class PaymentDueComponent implements OnInit, OnDestroy {
  rowData: any[] = [];
  loading = true;
  error = '';
  refreshSub!: Subscription;

  defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: true
  };

  columnDefs: ColDef[] = [];

  constructor(
    private http: HttpClient,
    private tabService: TabStateService
  ) {}

  ngOnInit(): void {
    this.initializeColumns();

    this.refreshSub = this.tabService.refresh$.subscribe(() => {
      const filters = this.tabService.getCurrentFilters()?.dateRange;
      let start = filters?.['payment-due']?.start;
      let end = filters?.['payment-due']?.end;

      start = typeof start === 'string' ? new Date(start) : start;
      end = typeof end === 'string' ? new Date(end) : end;

      if (!(start instanceof Date) || isNaN(start.getTime()) || !(end instanceof Date) || isNaN(end.getTime())) {
        console.warn('❌ Invalid date range in tabService:', start, end);
        this.error = 'Invalid or missing date range. Please select a valid range.';
        this.loading = false;
        return;
      }

      this.loadData(start, end);
    });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  currencyFormatter(params: any): string {
    return params.value != null
      ? `₹${params.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : '₹0.00';
  }

  dateFormatter(params: any): string {
    return params.value
      ? new Date(params.value).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : '';
  }

  initializeColumns(): void {
    this.columnDefs = [
      { headerName: 'Invoice ID', field: 'invoice_number', width: 160 },
      { headerName: 'Company', field: 'company_name', flex: 1 },
      { headerName: 'Amount', field: 'amount', width: 180, valueFormatter: this.currencyFormatter.bind(this) },
      { headerName: 'Paid', field: 'amount_paid', width: 180, valueFormatter: this.currencyFormatter.bind(this) },
      { headerName: 'Balance Due', field: 'balance_due', width: 200, valueFormatter: this.currencyFormatter.bind(this) },
      { headerName: 'Due Date', field: 'due_date', width: 200, valueFormatter: this.dateFormatter.bind(this) },
      { headerName: 'Status', field: 'status', width: 200 }
    ];
  }

  loadData(start: Date, end: Date): void {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    const queryParams = `?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;

    this.loading = true;
    this.error = '';

    this.http.get<any[]>(`${environment.apiBaseUrl}/reports/payment-due${queryParams}`, { headers }).subscribe({
      next: (res) => {
        this.rowData = res || [];
        this.loading = false;

        if (!this.rowData.length) {
          console.warn('⚠ No records returned for payment due report');
        } else {
          console.log(`✅ Loaded ${this.rowData.length} rows for payment due report`);
        }
      },
      error: (err) => {
        console.error('❌ Failed to fetch payment due report:', err);
        this.error = 'Failed to load data';
        this.loading = false;
      }
    });
  }
}
