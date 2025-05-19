import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { TabStateService } from '../../../../shared/tab-state.service';
import { Subscription } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';

@Component({
  selector: 'app-invoice-due',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './invoice-due.component.html',
  styleUrls: ['./invoice-due.component.css']
})
export class InvoiceDueComponent implements OnInit, OnDestroy {
  rowData: any[] = [];
  loading = true;
  error = '';
  sub!: Subscription;

  rowHeight = 38;

  columnDefs: ColDef[] = [
    { headerName: 'Invoice ID', field: 'invoice_number', width: 250 },
    { headerName: 'Company', field: 'company_name', width: 310 },
    {
      headerName: 'Amount',
      field: 'amount',
      width: 270,
      valueFormatter: this.currencyFormatter.bind(this)
    },
    {
      headerName: 'Due Date',
      field: 'due_date',
      width: 300,
      valueFormatter: this.dateFormatter.bind(this)
    },
    { headerName: 'Status', field: 'status', width: 270 }
  ];

  defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: true
  };

  constructor(private http: HttpClient, private tabService: TabStateService) {}

  ngOnInit(): void {
    this.sub = this.tabService.refresh$.subscribe(() => {
      const filters = this.tabService.getCurrentFilters()?.dateRange;
      const start = typeof filters?.['invoice-due']?.start === 'string'
        ? new Date(filters['invoice-due'].start)
        : filters?.['invoice-due']?.start;

      const end = typeof filters?.['invoice-due']?.end === 'string'
        ? new Date(filters['invoice-due'].end)
        : filters?.['invoice-due']?.end;

      if (!(start instanceof Date) || isNaN(start.getTime()) ||
          !(end instanceof Date) || isNaN(end.getTime())) {
        this.error = 'Invalid or missing date range. Please select a valid range.';
        this.loading = false;
        return;
      }

      this.loadData(start, end);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  loadData(start: Date, end: Date): void {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];
    const queryParams = `?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;

    this.loading = true;
    this.error = '';

    this.http
      .get<any[]>(`${environment.apiBaseUrl}/reports/invoice-due${queryParams}`, { headers })
      .subscribe({
        next: (res) => {
          this.rowData = res || [];
          this.loading = false;
        },
        error: (err) => {
          console.error('❌ Failed to fetch invoice due report:', err);
          this.error = 'Failed to load data';
          this.loading = false;
        }
      });
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
}
