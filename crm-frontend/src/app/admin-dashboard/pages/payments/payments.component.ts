import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ClientSideRowModelModule } from 'ag-grid-community';
import { ColDef, Module, ICellRendererParams } from 'ag-grid-community';
import { environment } from '../../../../environments/environment';
import { TabStateService } from '../../../shared/tab-state.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-payments',
  standalone: true,
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.css'],
  imports: [CommonModule, AgGridAngular]
})
export class PaymentsComponent implements OnInit {
  payments: any[] = [];
  allPayments: any[] = [];
  selectedRowData: any = null;

  userRole: string = '';
  currentTab: string = 'All Payments';
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
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    const user = localStorage.getItem('user');
    this.userRole = user ? JSON.parse(user).role : '';

    this.columnDefs = this.getColumnDefs(this.userRole);
    this.payments = [];
    localStorage.removeItem('dateRanges');

    this.tabService.refresh$.subscribe(() => {
      const updated = this.tabService.getDateRange('payments');
      this.dateRange = updated
        ? { start: new Date(updated.start), end: new Date(updated.end) }
        : { start: null, end: null };

      this.fetchPayments(headers);
    });

    this.tabService.currentTab$.subscribe(tab => {
      this.currentTab = tab;
      this.filterPayments();
    });

    this.tabService.searchText$.subscribe(text => {
      this.latestSearchText = text;
      this.filterPayments();
    });
  }

  fetchPayments(headers: HttpHeaders): void {
    const baseUrl = `${environment.apiBaseUrl}/payments`;

    if (!this.dateRange.start || !this.dateRange.end) {
      this.payments = [];
      return;
    }

    let endpoint = baseUrl;
    if (this.userRole === 'Customer') {
      const start = this.dateRange.start.toISOString().split('T')[0];
      const end = this.dateRange.end.toISOString().split('T')[0];
      endpoint = `${baseUrl}?startDate=${start}&endDate=${end}`;
    }

    this.http.get<any[]>(endpoint, { headers }).subscribe({
      next: (res) => {
        this.allPayments = res;
        this.filterPayments();
      },
      error: (err) => {
        console.error('❌ Failed to load payments:', err);
      }
    });
  }

  getColumnDefs(role: string): ColDef[] {
    return [
      { field: 'payment_id', headerName: 'Payment ID' },
      { field: 'invoice_id', headerName: 'Invoice ID' },
      ...(role !== 'Customer' ? [{ field: 'company_name', headerName: 'Company Name' }] : []),
      {
        field: 'amount_paid',
        headerName: 'Amount Paid',
        valueFormatter: p => `₹${parseFloat(p.value).toFixed(2)}`
      },
      {
        field: 'balance_due',
        headerName: 'Balance Due',
        valueFormatter: p => `₹${parseFloat(p.value).toFixed(2)}`
      },
      { field: 'paid_at', headerName: 'Paid At' },
      { field: 'payment_method', headerName: 'Payment Method' },
      {
        field: 'payment_status',
        headerName: 'Payment Status',
        cellRenderer: (params: ICellRendererParams) => {
          const badgeMap: { [key: string]: string } = {
            Paid: '#22c55e',
            'Partially Paid': '#f97316',
            Unpaid: '#6b7280',
            Overdue: '#ef4444'
          };
          const color = badgeMap[params.value] || '#6b7280';
          return `<span style="padding: 2px 8px; font-size: 12px; font-weight: 600; color: #fff; background: ${color}; border-radius: 9999px;">${params.value}</span>`;
        }
      },
      {
        headerName: 'Receipt',
        field: 'download',
        cellRenderer: () => `
          <span class="download-link" style="color: #2563eb; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" height="16" width="16" stroke="currentColor" stroke-width="2"
                viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m0 0l-6-6m6 6l6-6" />
            </svg>
            <span>Download</span>
          </span>`,
        onCellClicked: (params: any) => {
          this.selectedRowData = params.data;
          this.generatePDF();
        }
      }
    ];
  }

  filterPayments(): void {
    let filtered = [...this.allPayments];

    if (this.currentTab && this.currentTab !== 'All Payments') {
      filtered = filtered.filter(p =>
        p.payment_status?.toLowerCase() === this.currentTab.toLowerCase()
      );
    }

    const keyword = this.latestSearchText.toLowerCase();
    if (keyword) {
      filtered = filtered.filter(p =>
        Object.values(p).some(val =>
          typeof val === 'string' && val.toLowerCase().includes(keyword)
        )
      );
    }

    if (this.dateRange.start && this.dateRange.end) {
      filtered = filtered.filter(p => {
        const paidAt = new Date(p.paid_at);
        return paidAt >= this.dateRange.start! && paidAt <= this.dateRange.end!;
      });
    }

    this.payments = filtered;
  }

  onRowClicked(event: any): void {
    const isDownload = event.event?.target?.closest('.download-link');
    if (isDownload) return;

    const paymentId = event.data?.payment_id;
    if (!paymentId) return;

    this.router.navigate([`/admin/payments/${paymentId}`]);
  }

  generatePDF(): void {
    if (!this.selectedRowData) return;

    const receipt = document.createElement('div');
    receipt.style.width = '600px';
    receipt.style.padding = '20px';
    receipt.style.background = '#fff';
    receipt.style.border = '1px solid #ccc';
    receipt.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin: 10px 0;">Payment Receipt</h2><hr />
      </div>
      <p><strong>Payment ID:</strong> ${this.selectedRowData.payment_id}</p>
      <p><strong>Invoice ID:</strong> ${this.selectedRowData.invoice_id}</p>
      ${this.userRole !== 'Customer' ? `<p><strong>Company:</strong> ${this.selectedRowData.company_name}</p>` : ''}
      <p><strong>Amount Paid:</strong> ₹${parseFloat(this.selectedRowData.amount_paid).toFixed(2)}</p>
      <p><strong>Balance Due:</strong> ₹${parseFloat(this.selectedRowData.balance_due).toFixed(2)}</p>
      <p><strong>Paid At:</strong> ${this.selectedRowData.paid_at}</p>
      <p><strong>Payment Method:</strong> ${this.selectedRowData.payment_method}</p>
      <p><strong>Payment Status:</strong> ${this.selectedRowData.payment_status}</p>
      <div style="margin-top: 20px; font-size: 12px; color: #666; text-align: center;">
        <p>Thank you for your payment.</p>
        <p>This is a system-generated receipt and does not require a signature.</p>
      </div>
    `;

    document.body.appendChild(receipt);

    html2canvas(receipt).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, width, height);
      pdf.save(`payment_receipt_${this.selectedRowData.payment_id}.pdf`);
      document.body.removeChild(receipt);
    });
  }
}
