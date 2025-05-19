import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { ColDef } from 'ag-grid-community';
import { AgGridModule } from 'ag-grid-angular';
import { ClientSideRowModelModule, Module } from 'ag-grid-community';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';

@Component({
  selector: 'app-brd-detail',
  standalone: true,
  imports: [CommonModule, AgGridModule, FormsModule, QuillModule],
  templateUrl: './brd-detail.component.html',
  styleUrls: ['./brd-detail.component.css']
})
export class BrdDetailComponent implements OnInit {
  brd: any = null;
  brdId: string = '';
  userRole: string = '';
  activeTab: 'tasks' | 'descriptions' = 'tasks';
  brdTasks: any[] = [];
  isEditModalOpen: boolean = false;
  editForm: any = {};
  developers: any[] = [];
  selectedDeveloperId: number | null = null;
  quillEditorRef: any = null;

  taskColumnDefs: ColDef[] = [
    { headerName: 'Task ID', field: 'id', flex: 1 },
    { headerName: 'Status', field: 'status_name', flex: 1 },
    { headerName: 'Category', field: 'category_name', flex: 1 },
    { headerName: 'Assigned To', field: 'assigned_to_name', flex: 1 },
    { headerName: 'Created At', field: 'created_at', flex: 1 }
  ];

  public modules: Module[] = [ClientSideRowModelModule];

  quillModules = {
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ header: 1 }, { header: 2 }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ script: 'sub' }, { script: 'super' }],
        [{ indent: '-1' }, { indent: '+1' }],
        [{ direction: 'rtl' }],
        [{ size: ['small', false, 'large', 'huge'] }],
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        [{ color: [] }, { background: [] }],
        [{ font: [] }],
        [{ align: [] }],
        ['link', 'image'],
        ['clean']
      ]
    }
  };

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.brdId = this.route.snapshot.params['id'];
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    const user = localStorage.getItem('user');
    this.userRole = user ? JSON.parse(user).role : '';

    this.http.get(`${environment.apiBaseUrl}/brds/${this.brdId}`, { headers }).subscribe({
      next: (res) => {
        this.brd = res;
        if (this.activeTab === 'tasks') this.loadTasks();
        if (this.userRole === 'Support') this.fetchDevelopers();
      },
      error: (err) => {
        console.error('❌ Error fetching BRD detail:', err);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/brds']);
  }

  onTabChange(tab: 'tasks' | 'descriptions'): void {
    this.activeTab = tab;
    if (tab === 'tasks') this.loadTasks();
  }

  loadTasks(): void {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get(`${environment.apiBaseUrl}/brds/${this.brd.id}/tasks`, { headers }).subscribe({
      next: (res: any) => {
        this.brdTasks = res;
      },
      error: (err) => {
        console.error('❌ Failed to fetch tasks:', err);
      }
    });
  }

  openEditModal(): void {
    this.editForm = { ...this.brd };
    this.isEditModalOpen = true;
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
  }

  saveChanges(): void {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.patch(`${environment.apiBaseUrl}/brds/${this.brd.id}`, this.editForm, { headers }).subscribe({
      next: () => {
        this.http.get(`${environment.apiBaseUrl}/brds/${this.brd.id}`, { headers }).subscribe({
          next: (updatedBrd: any) => {
            this.brd = updatedBrd;
            this.closeEditModal();
          },
          error: (err) => {
            console.error('❌ Failed to fetch updated BRD:', err);
          }
        });
      },
      error: (err) => {
        console.error('❌ Failed to update BRD:', err);
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

  this.http.post(`${environment.apiBaseUrl}/brds/${this.brd.id}/attachments`, formData, { headers })
    .subscribe({
      next: (res: any) => {
        const fileUrl = res.url || res.fileUrl || `${environment.apiBaseUrl}/uploads/${file.name}`;
        const editor = this.quillEditorRef;

        if (editor) {
          const range = editor.getSelection(true);
          const linkHtml = `<a href="${fileUrl}" target="_blank" download>${file.name}</a>`;
          editor.clipboard.dangerouslyPasteHTML(range.index, linkHtml);
        }
      },
      error: (err) => {
        console.error('❌ PDF upload failed:', err);
      }
    });
}


  fetchDevelopers(): void {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get<any[]>(`${environment.apiBaseUrl}/users/developers`, { headers }).subscribe({
      next: (res) => {
        this.developers = res;
      },
      error: (err) => {
        console.error('❌ Failed to fetch developers:', err);
      }
    });
  }

  assignToDeveloper(): void {
    if (!this.selectedDeveloperId) return;

    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.patch(`${environment.apiBaseUrl}/brds/${this.brd.id}/assign`, {
      assigned_to: this.selectedDeveloperId
    }, { headers }).subscribe({
      next: () => {
        this.brd.assigned_to_name = this.developers.find(d => d.id === this.selectedDeveloperId)?.name || '';
      },
      error: (err) => {
        console.error('❌ Assignment failed:', err);
      }
    });
  }
}
