// src/app/app.routes.ts (or app-routing.module.ts if using routing module)

import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { CustomersComponent } from './admin-dashboard/pages/customers/customers.component';
import { CustomerDetailComponent } from './admin-dashboard/pages/customers/customer-detail/customer-detail.component';
import { TicketsComponent } from './admin-dashboard/pages/tickets/tickets.component';
import { BrdsComponent } from './admin-dashboard/pages/brds/brds.component';
import { InvoicesComponent } from './admin-dashboard/pages/invoices/invoices.component';
import { PaymentsComponent } from './admin-dashboard/pages/payments/payments.component';
import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'customers', pathMatch: 'full' },

      // ✅ Customers
      {
        path: 'customers',
        component: CustomersComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Admin', 'Support', 'Customer'] }
      },
      {
        path: 'customers/:id',
        component: CustomerDetailComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Admin', 'Support', 'Customer'] }
      },

      // ✅ Tickets
      {
        path: 'tickets',
        component: TicketsComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Admin', 'Support', 'Developer', 'Customer'] }
      },
      {
        path: 'tickets/:id',
        loadComponent: () =>
          import('./admin-dashboard/pages/tickets/ticket-detail/ticket-detail.component')
            .then(m => m.TicketDetailComponent),
        canActivate: [AuthGuard],
        data: { roles: ['Admin', 'Support', 'Developer', 'Customer'] }
      },

      // ✅ BRDs
      {
        path: 'brds',
        component: BrdsComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Admin', 'Support', 'Developer', 'Customer'] }
      },
      {
        path: 'brds/:id',
        loadComponent: () =>
          import('./admin-dashboard/pages/brds/brd-detail/brd-detail.component')
            .then(m => m.BrdDetailComponent),
        canActivate: [AuthGuard],
        data: { roles: ['Admin', 'Support', 'Developer', 'Customer'] }
      },

      // ✅ Invoices
      {
        path: 'invoices',
        component: InvoicesComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Admin', 'Customer'] }
      },
      {
        path: 'invoices/:id',
        loadComponent: () =>
          import('./admin-dashboard/pages/invoices/invoice-detail/invoice-detail.component')
            .then(m => m.InvoiceDetailComponent),
        canActivate: [AuthGuard],
        data: { roles: ['Admin', 'Customer'] }
      },

      // ✅ Payments
      {
        path: 'payments',
        component: PaymentsComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Admin', 'Customer'] }
      },
      {
        path: 'payments/:id',
        loadComponent: () =>
          import('./admin-dashboard/pages/payments/payment-detail/payment-detail.component')
            .then(m => m.PaymentDetailComponent),
        canActivate: [AuthGuard],
        data: { roles: ['Admin', 'Customer'] }
      },

      // ✅ Reports (Admin only)
      {
        path: 'reports/new-business',
        loadComponent: () =>
          import('./admin-dashboard/pages/reports/new-business/new-business.component')
            .then(m => m.NewBusinessComponent),
        canActivate: [AuthGuard],
        data: { roles: ['Admin'] }
      },
      {
        path: 'reports/payment-due',
        loadComponent: () =>
          import('./admin-dashboard/pages/reports/payment-due/payment-due.component')
            .then(m => m.PaymentDueComponent),
        canActivate: [AuthGuard],
        data: { roles: ['Admin'] }
      },
      {
        path: 'reports/invoice-due',
        loadComponent: () =>
          import('./admin-dashboard/pages/reports/invoice-due/invoice-due.component')
            .then(m => m.InvoiceDueComponent),
        canActivate: [AuthGuard],
        data: { roles: ['Admin'] }
      },
      {
        path: 'reports/ledger',
        loadComponent: () =>
          import('./admin-dashboard/pages/reports/ledger/ledger.component')
            .then(m => m.LedgerComponent),
        canActivate: [AuthGuard],
        data: { roles: ['Admin'] }
      }
    ]
  },

  // Optional: Wildcard route for handling 404
  {
    path: '**',
    redirectTo: 'login'
  }
];
