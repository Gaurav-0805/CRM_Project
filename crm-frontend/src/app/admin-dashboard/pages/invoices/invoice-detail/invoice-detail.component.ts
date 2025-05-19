import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { FormsModule } from '@angular/forms';  // Import FormsModule here

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, AgGridModule, FormsModule],  // Add FormsModule to imports
  templateUrl: './invoice-detail.component.html',
  styleUrls: ['./invoice-detail.component.css']
})
export class InvoiceDetailComponent implements OnInit {
  invoiceId: string = '';
  invoiceHeader: any = null;
  invoiceProducts: any[] = [];
  totalAmount: number = 0;

  // Modal form data
  isModalOpen: boolean = false;
  showEditModal: boolean = false;  // Define the missing property
  editableProducts: any[] = [];    // Define the missing property
  invoiceForm = {
    productDescription: '',
    quantity: null,
    price: null,
  };

  columnDefs = [
    { headerName: 'Product', field: 'product_name', flex: 1 },
    { headerName: 'Description', field: 'description', flex: 2 },
    { headerName: 'Quantity', field: 'quantity', width: 120 },
    {
      headerName: 'Price (₹)',
      field: 'price',
      width: 130,
      valueFormatter: this.currencyFormatter
    },
    {
      headerName: 'Sub Total (₹)',
      field: 'line_total',
      width: 140,
      valueFormatter: this.currencyFormatter
    }
  ];

  defaultColDef = {
    resizable: true,
    sortable: true
  };

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.invoiceId = this.route.snapshot.params['id'];
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get<any[]>(`${environment.apiBaseUrl}/invoices/${this.invoiceId}`, { headers })
      .subscribe(
        (res) => {
          if (!res || res.length === 0) {
            console.error('❌ No invoice data returned');
            return;
          }

          const first = res[0];

          this.invoiceHeader = {
            invoice_number: first.invoice_number,
            amount: parseFloat(first.amount),
            due_date: first.due_date,
            paid_at: first.paid_at,
            status: first.status,
            salesperson_name: first.salesperson_name,
            company_name: first.company_name,
            address: first.address,
            gstin: first.gstin || ''
          };

          this.invoiceProducts = res.map(row => ({
            product_name: row.product_name,
            description: row.product_description,
            price: row.price,
            quantity: row.quantity,
            line_total: row.line_total
          }));

          this.totalAmount = this.invoiceProducts.reduce(
            (acc, p) => acc + (+p.line_total || 0), 0
          );
        },
        (err) => {
          console.error('❌ Error fetching invoice:', err);
        }
      );
  }

  printInvoice(): void {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get(`${environment.apiBaseUrl}/invoices/${this.invoiceId}/pdf`, {
      headers,
      responseType: 'blob'
    }).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice_${this.invoiceId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    }, error => {
      console.error('❌ Failed to generate invoice PDF:', error);
    });
  }

  currencyFormatter(params: any): string {
    return params.value ? `₹${(+params.value).toFixed(2)}` : '₹0.00';
  }

  goBack(): void {
    this.router.navigate(['/admin/invoices']);
  }

  // Open the edit modal and prefill data for the selected product
  openEditModal(product: any): void {
    this.showEditModal = true; // Corrected property name to match HTML template
    this.editableProducts = [product];  // Preload the selected product data
    this.invoiceForm.productDescription = product.description;
    this.invoiceForm.quantity = product.quantity;
    this.invoiceForm.price = product.price;
  }

  // Close the edit modal
  closeEditModal(): void {
    this.showEditModal = false;
  }

  // Save the updated product data from the modal form
  saveChanges(): void {
    const updatedProduct = this.invoiceProducts.find(product => product.description === this.invoiceForm.productDescription);
    if (updatedProduct) {
      updatedProduct.description = this.invoiceForm.productDescription;
      updatedProduct.quantity = this.invoiceForm.quantity;
      updatedProduct.price = this.invoiceForm.price;
      updatedProduct.line_total = updatedProduct.quantity * updatedProduct.price;  // Recalculate line total
    }

    // Close the modal
    this.closeEditModal();
  }
}
