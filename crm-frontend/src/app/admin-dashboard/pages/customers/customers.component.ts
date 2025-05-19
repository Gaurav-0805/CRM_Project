import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { Router } from '@angular/router';
import { ICellRendererParams } from 'ag-grid-community';

import { AgGridAngular } from 'ag-grid-angular';
import { ClientSideRowModelModule } from 'ag-grid-community';
import { ColDef, Module } from 'ag-grid-community';

import { TabStateService } from '../../../shared/tab-state.service';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.css'],
  imports: [CommonModule, AgGridAngular]
})
export class CustomersComponent implements OnInit {
  customers: any[] = [];
  allCustomers: any[] = [];

  currentTab: string = '';
  searchText: string = '';
  dateRange: { start: Date | null; end: Date | null } = { start: null, end: null };

  columnDefs: ColDef[] = [
    { field: 'company_id', headerName: 'ID', flex: 1 },
    { field: 'company_name', headerName: 'Company Name', flex: 1 },
    { field: 'contact_person', headerName: 'Contact Person', flex: 1 },
    { field: 'email', headerName: 'Contact Email', flex: 1 },
    {
      field: 'project_status',
      headerName: 'Status',
      flex: 1,
      cellRenderer: (params: ICellRendererParams) => {
        const status = params.value;
        const badgeMap: { [key: string]: string } = {
          Active: '#22c55e',
          Onboarding: '#3b82f6',
          Lead: '#6b7280'
        };
        const color = badgeMap[status] || '#6b7280';
        return `
          <span style="
            display: inline-block;
            padding: 1px 8px;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.3;
            border-radius: 9999px;
            color: #fff;
            background-color: ${color};
            text-align: center;
            white-space: nowrap;">
            ${status}
          </span>`;
      }
    },
    { field: 'created_at', headerName: 'Created At', flex: 1 },
    { field: 'address', headerName: 'Address', flex: 1 }
  ];

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
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    const savedFilters = localStorage.getItem('customerFilters');
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      this.currentTab = parsed.currentTab || '';
      this.searchText = parsed.searchText || '';
      this.dateRange = {
        start: parsed.dateRange?.start ? new Date(parsed.dateRange.start) : null,
        end: parsed.dateRange?.end ? new Date(parsed.dateRange.end) : null
      };
    } else {
      this.dateRange = { start: null, end: null };
      this.currentTab = '';
      this.searchText = '';
    }

    this.customers = [];

    this.http.get<any[]>(`${environment.apiBaseUrl}/companies/customers`, { headers }).subscribe({
      next: (res) => {
        this.allCustomers = res;

        this.tabService.currentTab$.subscribe(tab => {
          this.currentTab = tab;
          this.filterCustomers();
        });

        this.tabService.searchText$.subscribe(text => {
          this.searchText = text;
          this.filterCustomers();
        });

        this.tabService.refresh$.subscribe(() => {
          const updated = this.tabService.getDateRange('customers');
          if (updated) {
            this.dateRange = {
              start: new Date(updated.start),
              end: new Date(updated.end)
            };
          }
          this.filterCustomers();
        });

        this.filterCustomers();

        localStorage.removeItem('customerFilters');
      },
      error: (err) => console.error('❌ Failed to load customers:', err)
    });
  }

  filterCustomers(): void {
    if (!this.dateRange.start || !this.dateRange.end) {
      this.customers = [];
      return;
    }

    let filtered = [...this.allCustomers];

    if (this.currentTab && this.currentTab !== 'All Customers') {
      filtered = filtered.filter(c =>
        c.project_status?.toLowerCase() === this.currentTab.toLowerCase()
      );
    }

    if (this.searchText) {
      const keyword = this.searchText.toLowerCase();
      filtered = filtered.filter(c =>
        Object.values(c).some(val =>
          typeof val === 'string' && val.toLowerCase().includes(keyword)
        )
      );
    }

    const start = this.dateRange?.start;
    const end = this.dateRange?.end;

    if (start && end) {
      filtered = filtered.filter(c => {
        const created = new Date(c.created_at);
        return created >= start && created <= end;
      });
    }

    this.customers = filtered;
  }

  onRowClicked(event: any): void {
    localStorage.setItem('customerFilters', JSON.stringify({
      currentTab: this.currentTab,
      searchText: this.searchText,
      dateRange: this.dateRange
    }));

    const customerId = event.data.company_id;
    this.router.navigate([`/admin/customers/${customerId}`]);
  }
}
