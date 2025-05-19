import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { TabStateService } from '../../../../shared/tab-state.service';
import { Subscription } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';

@Component({
  selector: 'app-new-business',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './new-business.component.html',
  styleUrls: ['./new-business.component.css']
})
export class NewBusinessComponent implements OnInit, OnDestroy {
  customers: any[] = [];
  loading = true;
  error = '';
  refreshSub!: Subscription;

  columnDefs: ColDef[] = [
    { headerName: 'Customer ID', field: 'customer_id', width: 140 },
    { headerName: 'Name', field: 'name', flex: 1 },
    { headerName: 'Email', field: 'email', flex: 1 },
    { headerName: 'Company', field: 'company_name', flex: 1 },
    {
      headerName: 'Created At',
      field: 'created_at',
      flex: 1,
      valueFormatter: (params) => new Date(params.value).toLocaleString()
    }
  ];

  defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: true
  };

  constructor(
    private http: HttpClient,
    private tabService: TabStateService
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.refreshSub = this.tabService.refresh$.subscribe(() => this.loadData());
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  loadData(): void {
  const token = localStorage.getItem('token') || '';
  const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

  const filters = this.tabService.getCurrentFilters?.();
  const start = filters?.dateRange?.['new-business']?.start;
  const end = filters?.dateRange?.['new-business']?.end;

  if (!(start instanceof Date) || !(end instanceof Date)) {
    this.customers = [];
    this.loading = false;
    return; // Don't fetch anything if no valid date range is selected
  }

  const queryParams = `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;

  this.loading = true;
  this.http.get<any[]>(`${environment.apiBaseUrl}/reports/new-business${queryParams}`, { headers }).subscribe({
    next: (res) => {
      this.customers = res;
      this.loading = false;
    },
    error: (err) => {
      console.error('❌ Failed to fetch new business:', err);
      this.error = 'Failed to load data';
      this.loading = false;
    }
  });
}
}
