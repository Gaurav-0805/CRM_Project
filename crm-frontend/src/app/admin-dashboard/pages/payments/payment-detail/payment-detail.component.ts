// payment-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../../environments/environment';
import { AgGridModule } from 'ag-grid-angular';
import { FormsModule } from '@angular/forms';  // Import FormsModule to support ngModel

interface PaymentSummary {
  latestBillAmount: number;
  advanceAmount: number;
  outstanding: number;
  paymentAmount: number;
}

@Component({
  selector: 'app-payment-detail',
  standalone: true,
  imports: [CommonModule, AgGridModule, FormsModule],  // Add FormsModule here
  templateUrl: './payment-detail.component.html',
  styleUrls: ['./payment-detail.component.css']
})
export class PaymentDetailComponent implements OnInit {
  paymentId: string = '';
  paymentData: any = null;
  companyName: string = ''; // <-- New property for company name
  invoiceData: any[] = [];
  transactionData: any[] = [];
  showPayNowUI: boolean = false;
  showScanner: boolean = false;
  enteredAmount: number | null = null;
  showPaymentModalUI: boolean = false;  // Flag to control modal visibility

  paymentSummary!: PaymentSummary;

  invoiceColumnDefs = [
    { headerName: 'Invoice Number', field: 'invoice_number', flex: 1 },
    { headerName: 'Due Date', field: 'due_date', flex: 1 },
    { headerName: 'Amount (₹)', field: 'amount', flex: 1, valueFormatter: this.currencyFormatter }
  ];

  transactionColumnDefs = [
    { headerName: 'Transaction ID', field: 'transaction_id', flex: 1 },
    { headerName: 'Date', field: 'transaction_date', flex: 1 },
    { headerName: 'Amount (₹)', field: 'amount', flex: 1, valueFormatter: this.currencyFormatter },
    { headerName: 'Status', field: 'status', flex: 1 },
    { headerName: 'Remarks', field: 'remarks', flex: 2 }
  ];

  defaultColDef = {
    resizable: true,
    sortable: true,
    filter: true
  };

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.paymentId = this.route.snapshot.paramMap.get('id') || '';
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get<any>(`${environment.apiBaseUrl}/payments/${this.paymentId}`, { headers }).subscribe({
      next: (res) => {
        this.paymentData = res;
        this.companyName = res.company_name || ''; // <-- Set company name here
        this.invoiceData = res.invoices || [];
        this.transactionData = res.transactions || [];  // <-- Directly assign transactions here

        const latestBillAmount = res.invoices?.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0) || 0;
        const paymentAmount = res.amount_paid || 0;
        const advanceAmount = 0;

        this.paymentSummary = {
          latestBillAmount,
          advanceAmount,
          outstanding: latestBillAmount - paymentAmount,
          paymentAmount
        };

        // Removed this.fetchTransactions() call here
      },
      error: (err) => {
        console.error('❌ Failed to load payment details:', err);
      }
    });
  }

  // Removed fetchTransactions() method completely

  currencyFormatter(params: any): string {
    return params.value ? `₹${(+params.value).toFixed(2)}` : '₹0.00';
  }

  goBack(): void {
    this.router.navigate(['/admin/payments']);
  }

  togglePayNow(): void {
    this.showPayNowUI = !this.showPayNowUI;
    this.showScanner = false;
    this.enteredAmount = null;
  }

  showScannerSection(): void {
    this.showScanner = true;
    this.enteredAmount = null;
  }

  submitPayment(): void {
    console.log('Submitting ₹' + this.enteredAmount);
    // TODO: Handle actual payment logic here
    window.location.reload(); // page reload after simulated payment
  }

  // Show Payment Modal
  showPaymentModal(): void {
    this.showPaymentModalUI = true;
  }

  // Close Payment Modal
  closePaymentModal(): void {
    this.showPaymentModalUI = false;
  }
}
