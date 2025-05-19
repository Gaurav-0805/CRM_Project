import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { TabStateService } from '../../../shared/tab-state.service';
import { Router } from '@angular/router';
import { AddTicketComponent } from './add-ticket/add-ticket.component';

// AG Grid Imports
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, Module, ICellRendererParams } from 'ag-grid-community';
import { ClientSideRowModelModule } from 'ag-grid-community';

@Component({
  selector: 'app-tickets',
  standalone: true,
  templateUrl: './tickets.component.html',
  styleUrls: ['./tickets.component.css'],
  imports: [CommonModule, AgGridAngular, AddTicketComponent]
})
export class TicketsComponent implements OnInit {
  tickets: any[] = [];
  allTickets: any[] = [];
  filteredTickets: any[] = [];

  showAddModal: boolean = false;
  userRole: string = '';

  currentTab: string = 'All Tickets';
  latestSearchText: string = '';
  dateRange: { start: Date | null; end: Date | null } = { start: null, end: null };

  columnDefs: ColDef[] = [
    { field: 'id', headerName: 'Ticket ID', flex:1},
    { field: 'product_name', headerName: 'Product Name', flex:1 },
    { field: 'company_name', headerName: 'Company Name', flex:1 },
    {
      field: 'status',
      headerName: 'Status', flex:1,
      cellRenderer: (params: ICellRendererParams) => {
        const status = params.value;
        const badgeMap: { [key: string]: string } = {
          Open: '#3b82f6',
          Resolved: '#22c55e',
          'In Progress': '#f59e0b',
          'On-Hold': '#f97316',
          'Canceled': '#ef4444'
        };
        const color = badgeMap[status] || '#6b7280';
        return `
          <span style="
            display: inline-block;
            padding: 2px 8px;
            font-size: 12px;
            font-weight: 600;
            line-height: 1.4;
            border-radius: 9999px;
            color: #fff;
            background-color: ${color};
            text-align: center;
            white-space: nowrap;
          ">
            ${status}
          </span>`;
      }
    },
    { field: 'created_at', headerName: 'Created At' ,flex:1},
    { field: 'resolved_at', headerName: 'Resolved At',flex:1 }
  ];

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true
  };

  public modules: Module[] = [ClientSideRowModelModule];

  constructor(
    private http: HttpClient,
    private tabService: TabStateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    localStorage.removeItem('dateRanges');
    this.dateRange = { start: null, end: null };
    this.tickets = [];

    const user = localStorage.getItem('user');
    this.userRole = user ? JSON.parse(user).role : '';

    const token = localStorage.getItem('token');
    if (!token) return;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    const apiUrl =
      this.userRole === 'Developer'
        ? `${environment.apiBaseUrl}/tickets/assigned`
        : `${environment.apiBaseUrl}/tickets`;

    this.http.get<any[]>(apiUrl, { headers }).subscribe({
      next: (res) => {
        this.allTickets = res;

        this.tabService.currentTab$.subscribe((tab) => {
          this.currentTab = tab;
          this.applyAllFilters();
        });

        this.tabService.searchText$.subscribe((text) => {
          this.latestSearchText = text;
          this.applyAllFilters();
        });

        this.tabService.refresh$.subscribe(() => {
          const updated = this.tabService.getDateRange('tickets');
          this.dateRange = updated
            ? { start: new Date(updated.start), end: new Date(updated.end) }
            : { start: null, end: null };
          this.applyAllFilters();
        });

        this.tabService.openAddTicket$.subscribe(() => {
          this.showAddModal = true;
        });
      },
      error: (err) => console.error('❌ Failed to load tickets:', err)
    });
  }

  applyAllFilters(): void {
    let filtered = [...this.allTickets];

    if (!this.dateRange.start || !this.dateRange.end) {
      this.tickets = [];
      return;
    }

    if (this.currentTab && this.currentTab !== 'All Tickets') {
      filtered = filtered.filter((t) =>
        t.status?.toLowerCase() === this.currentTab.toLowerCase()
      );
    }

    const keyword = this.latestSearchText.toLowerCase();
    if (keyword) {
      filtered = filtered.filter((t) =>
        Object.values(t).some(
          (val) => typeof val === 'string' && val.toLowerCase().includes(keyword)
        )
      );
    }

    filtered = filtered.filter((t) => {
      const created = new Date(t.created_at);
      return created >= this.dateRange.start! && created <= this.dateRange.end!;
    });

    this.tickets = filtered;
  }

  onRowClicked(event: any): void {
    const id = event.data.id || event.data.ticket_id;
    if (id) {
      this.router.navigate([`/admin/tickets/${id}`]);
    }
  }

  fetchTickets(): void {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    const apiUrl =
      this.userRole === 'Developer'
        ? `${environment.apiBaseUrl}/tickets/assigned`
        : `${environment.apiBaseUrl}/tickets`;

    this.http.get<any[]>(apiUrl, { headers }).subscribe({
      next: (res) => {
        this.allTickets = res;
        this.filteredTickets = res;
        this.tickets = res;
      },
      error: (err) => console.error('❌ Failed to reload tickets:', err)
    });
  }

  onTicketAdded(newTicket: any): void {
    this.fetchTickets();
  }

  openAddTicket(): void {
    this.showAddModal = true;
  }

  closeAddTicket(): void {
    this.showAddModal = false;
  }
}
