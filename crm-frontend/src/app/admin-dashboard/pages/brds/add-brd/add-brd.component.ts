import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { NgForOf, NgIf } from '@angular/common';
import { QuillModule } from 'ngx-quill';

@Component({
  selector: 'app-add-brd',
  standalone: true,
  imports: [FormsModule, NgForOf, QuillModule],
  templateUrl: './add-brd.component.html',
  styleUrls: ['./add-brd.component.css']
})
export class AddBrdComponent implements OnInit {
  @Output() brdAdded = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();

  brd = {
    title: '',
    description: '',
    product_id: null
  };

  products: any[] = [];
  isSubmitting = false;
  quillEditorRef: any = null;

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ header: 1 }, { header: 2 }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean']
    ]
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchProducts();
  }

  fetchProducts(): void {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get<any[]>(`${environment.apiBaseUrl}/products`, { headers }).subscribe({
      next: (res) => {
        this.products = res;
      },
      error: (err) => {
        console.error('❌ Failed to load products:', err);
      }
    });
  }

  onEditorCreated(quill: any): void {
    this.quillEditorRef = quill;
  }

  onPdfSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.post(`${environment.apiBaseUrl}/brds/temp/attachments`, formData, { headers })
      .subscribe({
        next: (res: any) => {
          const fileUrl = res.url || `${environment.apiBaseUrl}/uploads/brd/${file.name}`;
          const editor = this.quillEditorRef;
          if (editor) {
            const range = editor.getSelection(true);
            editor.insertText(range.index, file.name, 'link', fileUrl);
          }
        },
        error: (err) => {
          console.error('❌ PDF upload failed:', err);
        }
      });
  }

  submitBrd(): void {
    if (!this.brd.title || !this.brd.description || !this.brd.product_id) {
      alert('Please fill in all required fields.');
      return;
    }

    this.isSubmitting = true;

    const formData = new FormData();
    formData.append('title', this.brd.title);
    formData.append('description', this.brd.description);
    formData.append('product_id', String(this.brd.product_id));

    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.post(`${environment.apiBaseUrl}/brds`, formData, { headers }).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.brdAdded.emit(res);
        this.close.emit();
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('❌ Failed to submit BRD:', err);
        alert('Failed to create BRD. Please try again.');
      }
    });
  }
}
