// ✅ FULL UPDATED CODE FOR LEDGER REPORT SUPPORT

import { Component, OnInit, ViewChild } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { TabStateService } from '../shared/tab-state.service';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';

import { AddTicketComponent } from './pages/tickets/add-ticket/add-ticket.component';
import { AddInvoiceComponent } from './pages/invoices/add-invoice/add-invoice.component';
import { AddBrdComponent } from './pages/brds/add-brd/add-brd.component';
import { BrdsComponent } from './pages/brds/brds.component';
import { InvoicesComponent } from './pages/invoices/invoices.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    AddTicketComponent,
    AddInvoiceComponent,
    AddBrdComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  @ViewChild(InvoicesComponent) invoicesComponent!: InvoicesComponent;
  @ViewChild(BrdsComponent) brdsComponent!: BrdsComponent;

  currentTab: string = '';
  tabs: string[] = [];
  pageTitle: string = '';
  userRole: string = '';
  isDetailPage: boolean = false;

  showAddButton: boolean = false;
  addButtonText: string = '';
  showAddTicketForm: boolean = false;
  showAddInvoiceForm: boolean = false;
  showAddBrdForm: boolean = false;

  isReportsOpen: boolean = false;

  searchTexts: { [section: string]: string } = {
    customers: '',
    tickets: '',
    brds: '',
    invoices: '',
    payments: ''
  };

  dateRangeForm: FormGroup;

  constructor(
    private router: Router,
    private tabService: TabStateService,
    private fb: FormBuilder
  ) {
    this.dateRangeForm = this.fb.group({
      start: [null],
      end: [null]
    });

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.isReportsOpen = this.router.url.includes('/admin/reports');
        this.initializeRouteData();
      });
  }

  ngOnInit(): void {
    const user = localStorage.getItem('user');
    this.userRole = user ? JSON.parse(user).role : '';
    this.isReportsOpen = this.router.url.includes('/admin/reports');
    this.initializeRouteData();
  }

  private initializeRouteData(): void {
    const currentRoute = this.router.url;
   const isDetailsPage = (baseRoute: string) =>
  new RegExp(`${baseRoute}/\\d+$`).test(currentRoute);

    this.isDetailPage = false;
    this.tabs = [];
    this.showAddButton = false;
    this.addButtonText = '';

    if (currentRoute.includes('tickets')) {
      this.pageTitle = 'Tickets';
      this.isDetailPage = isDetailsPage('tickets');
      if (!this.isDetailPage) {
        this.tabs = this.userRole !== 'Customer'
          ? ['All Tickets', 'Open', 'Resolved', 'In Progress']
          : [];
        this.showAddButton = this.userRole !== 'Developer' && this.userRole !== 'Customer';
        this.addButtonText = 'Add Ticket';
      }

    } else if (currentRoute.includes('customers')) {
      this.pageTitle = 'Customers';
      this.isDetailPage = isDetailsPage('customers');
      this.tabs = this.isDetailPage ? [] : ['All Customers', 'Active', 'Lead', 'Onboarding'];
      this.showAddButton = false;

    } else if (currentRoute.includes('brds')) {
      this.pageTitle = 'BRDs';
      this.isDetailPage = isDetailsPage('brds');
      if (!this.isDetailPage) {
        this.tabs = this.userRole !== 'Customer'
          ? ['All BRDs', 'Approved', 'Pending', 'Rejected']
          : [];
        this.showAddButton = this.userRole === 'Customer';
        this.addButtonText = 'Create BRD';
      }

    } else if (currentRoute.includes('invoices')) {
      this.pageTitle = 'Invoices';
      this.isDetailPage = isDetailsPage('invoices');
      this.tabs = this.isDetailPage ? [] : ['All Invoices', 'Unpaid', 'Paid', 'Overdue', 'Partially Paid'];
      this.showAddButton = this.userRole === 'Admin' || this.userRole === 'Support';
      this.addButtonText = 'Add Invoice';

    } else if (currentRoute.includes('payments')) {
      this.pageTitle = 'Payments';
      this.isDetailPage = isDetailsPage('payments');
      this.tabs = this.isDetailPage ? [] : ['All Payments', 'Paid', 'Unpaid', 'Partially Paid', 'Overdue'];
      this.showAddButton = false;

    } else if (currentRoute.includes('reports/new-business')) {
      this.pageTitle = 'New Business';
      this.isDetailPage = false;
      this.tabs = [];
      this.showAddButton = false;
      this.tabService.setTab('New Business');

    } else if (currentRoute.includes('reports/payment-due')) {
      this.pageTitle = 'Payment Due Report';
      this.isDetailPage = false;
      this.tabs = [];
      this.showAddButton = false;
      this.tabService.setTab('Payment Due');

    } else if (currentRoute.includes('reports/invoice-due')) {
      this.pageTitle = 'Invoice Due Report';
      this.isDetailPage = false;
      this.tabs = [];
      this.showAddButton = false;
      return;

    } else if (currentRoute.includes('reports/ledger')) {
      this.pageTitle = 'Ledger Report';
      this.isDetailPage = false;
      this.tabs = [];
      this.showAddButton = false;
      return;

    } else {
      this.pageTitle = '';
      this.tabs = [];
      this.isDetailPage = false;
      this.showAddButton = false;
    }

    if (!this.router.url.includes('reports/invoice-due') && !this.router.url.includes('reports/ledger')) {
      this.currentTab = this.tabs[0] || '';
      this.tabService.setTab(this.currentTab);
      localStorage.removeItem('dateRanges');
      this.dateRangeForm.reset();
      this.tabService.resetAllFilters();
    }
  }

  get searchText(): string {
    const section = this.pageTitle.toLowerCase();
    return this.searchTexts[section] || '';
  }

  set searchText(value: string) {
    const section = this.pageTitle.toLowerCase();
    this.searchTexts[section] = value;
  }

  setTab(tab: string) {
    this.currentTab = tab;
    this.tabService.setTab(tab);
  }

  onSearch() {
    const section = this.pageTitle.toLowerCase();
    this.tabService.setSearchText(this.searchTexts[section]);
  }

  applyDateFilter(): void {
    const { start, end } = this.dateRangeForm.value;

    console.log('🟡 Selected Start:', start);
    console.log('🟡 Selected End:', end);

    if (!start || !end || !(start instanceof Date) || !(end instanceof Date)) {
      alert('Please select a valid date range');
      return;
    }

    let section = this.pageTitle.toLowerCase();

    if (this.router.url.includes('reports/new-business')) {
      section = 'new-business';
    } else if (this.router.url.includes('reports/payment-due')) {
      section = 'payment-due';
    } else if (this.router.url.includes('reports/invoice-due')) {
      section = 'invoice-due';
    } else if (this.router.url.includes('reports/ledger')) {
      section = 'ledger';
    }

    localStorage.setItem(
      'dateRanges',
      JSON.stringify({
        [section]: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      })
    );

    console.log('✅ Applying Filter', section, start, end);
    this.tabService.setDateRange({ section, start, end });
    this.tabService.triggerRefresh();
  }

  openAddModal(): void {
    const section = this.pageTitle.toLowerCase();
    if (section === 'tickets') {
      this.showAddTicketForm = true;
    } else if (section === 'invoices') {
      this.showAddInvoiceForm = true;
    } else if (section === 'brds') {
      this.showAddBrdForm = true;
    }
  }

  onTicketAdded(ticket: any) {
    this.showAddTicketForm = false;
    this.tabService.triggerRefresh();
  }

  onInvoiceAdded(invoice: any) {
    this.showAddInvoiceForm = false;
    this.tabService.triggerRefresh();
  }

  onBrdAdded(brd: any) {
    this.showAddBrdForm = false;
    this.tabService.triggerRefresh();
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}