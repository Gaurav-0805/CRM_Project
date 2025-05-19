import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ClientSideRowModelModule } from 'ag-grid-community';
import { ColDef, Module, ICellRendererParams } from 'ag-grid-community';
import { environment } from '../../../../environments/environment';
import { TabStateService } from '../../../shared/tab-state.service';

@Component({
  selector: 'app-brds',
  standalone: true,
  templateUrl: './brds.component.html',
  styleUrls: ['./brds.component.css'],
  imports: [CommonModule, AgGridAngular]
})
export class BrdsComponent implements OnInit {
  brds: any[] = [];
  allBrds: any[] = [];
  loading: boolean = true;
  userRole: string = '';

  currentTab: string = 'All BRDs';
  latestSearchText: string = '';
  dateRange: { start: Date | null; end: Date | null } = { start: null, end: null };

  columnDefs: ColDef[] = [];
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true
  };

  public modules: Module[] = [ClientSideRowModelModule];

  constructor(
    private http: HttpClient,
    private router: Router,
    private tabService: TabStateService
  ) {}

  ngOnInit(): void {
    localStorage.removeItem('dateRanges');
    this.dateRange = { start: null, end: null };
    this.brds = [];

    const userJson = localStorage.getItem('user');
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    if (!userJson) {
      console.error('❌ No user found in localStorage');
      this.loading = false;
      return;
    }

    const user = JSON.parse(userJson);
    this.userRole = user.role;

    // ✅ Validate user.id before making API call
    if (!user.id || !user.role) {
      console.error('❌ Invalid user payload');
      this.loading = false;
      return;
    }

    let endpoint = '';
    if (this.userRole === 'Developer') {
      endpoint = `${environment.apiBaseUrl}/brds/assigned`;
    } else if (this.userRole === 'Customer') {
      endpoint = `${environment.apiBaseUrl}/brds/my-brds`;
    } else {
      endpoint = `${environment.apiBaseUrl}/brds`;
    }

    this.columnDefs = [
      { field: 'id', headerName: 'BRD ID' },
      { field: 'title', headerName: 'Title' },
      { field: 'company_name', headerName: 'Company' },
      { field: 'product_name', headerName: 'Product' },
      {
        field: 'status_name',
        headerName: 'Status',
        cellRenderer: (params: ICellRendererParams) => {
          const status = params.value;
          const badgeMap: { [key: string]: string } = {
            Approved: '#22c55e',
            Rejected: '#ef4444',
            Pending: '#f59e0b'
          };
          const color = badgeMap[status] || '#6b7280';
          return `<span style="display: inline-block; padding: 2px 8px; font-size: 12px;
                  font-weight: 700; line-height: 1.4; border-radius: 9999px; color: #fff;
                  background-color: ${color}; text-align: center;">${status}</span>`;
        }
      },
      { field: 'created_at', headerName: 'Created At' }
    ];

    this.http.get<any[]>(endpoint, { headers }).subscribe({
      next: (res) => {
        this.allBrds = res;
        this.loading = false;
        this.applyAllFilters();

        this.tabService.currentTab$.subscribe(tab => {
          this.currentTab = tab;
          this.applyAllFilters();
        });

        this.tabService.searchText$.subscribe(text => {
          this.latestSearchText = text;
          this.applyAllFilters();
        });

        this.tabService.refresh$.subscribe(() => {
          const updated = this.tabService.getDateRange('brds');
          this.dateRange = updated
            ? { start: new Date(updated.start), end: new Date(updated.end) }
            : { start: null, end: null };
          this.applyAllFilters();
        });
      },
      error: (err) => {
        console.error('❌ Failed to load BRDs:', err);
        console.error('Status:', err.status);
        console.error('Status Text:', err.statusText);
        console.error('Error body:', err.error);
        this.loading = false;
      }
    });
  }

  applyAllFilters(): void {
    let filtered = [...this.allBrds];

    if (!this.dateRange.start || !this.dateRange.end) {
      this.brds = [];
      return;
    }

    if (this.currentTab && this.currentTab !== 'All BRDs') {
      filtered = filtered.filter(brd =>
        brd.status_name?.toLowerCase() === this.currentTab.toLowerCase()
      );
    }

    const keyword = this.latestSearchText.toLowerCase();
    if (keyword) {
      filtered = filtered.filter(brd =>
        Object.values(brd).some(val =>
          typeof val === 'string' && val.toLowerCase().includes(keyword)
        )
      );
    }

    filtered = filtered.filter(brd => {
      const created = new Date(brd.created_at);
      return created >= this.dateRange.start! && created <= this.dateRange.end!;
    });

    this.brds = filtered;
  }

  onRowClicked(event: any): void {
    const brdId = event.data.id;
    this.router.navigate([`/admin/brds/${brdId}`]);
  }
}
