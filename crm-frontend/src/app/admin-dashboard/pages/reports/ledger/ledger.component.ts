import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { TabStateService } from '../../../../shared/tab-state.service';
import { Subscription } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';

@Component({
  selector: 'app-ledger',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './ledger.component.html',
  styleUrls: ['./ledger.component.css']
})
export class LedgerComponent implements OnInit, OnDestroy {
  rowData: any[] = []; // ✅ renamed from 'rows'
  loading = true;
  error = '';
  refreshSub!: Subscription;

  columnDefs: ColDef[] = [
    { headerName: 'Company', field: 'company_name', flex: 1 },
    {
      headerName: 'Total Invoiced',
      field: 'total_invoiced',
      width: 320,
      valueFormatter: this.currencyFormatter
    },
    {
      headerName: 'Total Paid',
      field: 'total_paid',
      width: 320,
      valueFormatter: this.currencyFormatter
    },
    {
      headerName: 'Balance Due',
      field: 'balance_due',
      width: 320,
      valueFormatter: this.currencyFormatter
    }
  ];

  defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: true
  };

  constructor(private http: HttpClient, private tabService: TabStateService) {}

  ngOnInit(): void {
    this.refreshSub = this.tabService.refresh$.subscribe(() => this.loadData());
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  currencyFormatter(params: any): string {
  return params.value != null
    ? `₹${params.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : '₹0.00';
}

  loadData(): void {
  const token = localStorage.getItem('token') || '';
  const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

  const filters = this.tabService.getCurrentFilters()?.dateRange?.['ledger'];

  if (!filters?.start || !filters?.end) {
    console.warn('❌ No filter range applied. Skipping request.');
    this.rowData = [];
    this.loading = false;
    return;
  }

  const start = new Date(filters.start).toISOString().split('T')[0];
  const end = new Date(filters.end).toISOString().split('T')[0];
  const queryParams = `?start=${start}&end=${end}`;

  this.loading = true;
  this.http.get<any[]>(`${environment.apiBaseUrl}/reports/ledger${queryParams}`, { headers }).subscribe({
    next: (res) => {
      this.rowData = res;
      this.loading = false;
      console.log('✅ Loaded ledger data:', res.length);
    },
    error: (err) => {
      console.error('❌ Ledger Report fetch failed:', err);
      this.error = 'Failed to load data';
      this.loading = false;
    }
  });
}
}