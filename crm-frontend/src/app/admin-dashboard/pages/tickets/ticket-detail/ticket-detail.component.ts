import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatSelectModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule
  ],
  templateUrl: './ticket-detail.component.html',
  styleUrls: ['./ticket-detail.component.css']
})
export class TicketDetailComponent implements OnInit, AfterViewInit {
  ticket: any = null;
  ticketId: string = '';
  userRole: string = '';
  developers: any[] = [];
  assignForm!: FormGroup;
  selectedDeveloperId: string = '';
  previewUrl: string | null = null;
  triggerTimeline = false;
  timeline: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    const user = localStorage.getItem('user');
    this.userRole = user ? JSON.parse(user).role : '';
    this.ticketId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.ticketId) return;

    this.assignForm = this.fb.group({
      assigned_to: ['']
    });

    this.fetchTicket();

    if (this.userRole === 'Support') {
      this.fetchDevelopers();
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.triggerTimeline = true;
    }, 100);
  }

  fetchTicket(): void {
    const headers = this.getAuthHeaders();
    this.http.get(`${environment.apiBaseUrl}/tickets/${this.ticketId}`, { headers }).subscribe({
      next: (res: any) => {
        this.ticket = res;
        if (this.userRole === 'Support') {
          this.assignForm.patchValue({ assigned_to: this.ticket.assigned_to });
        }

        this.buildTimeline();

        if (Array.isArray(this.ticket?.screenshots)) {
          this.ticket.screenshots = this.ticket.screenshots.map((s: any) => ({
            ...s,
            url: `${environment.apiBaseUrl.replace('/api', '')}${s.url}`
          }));
        }

        if (!this.ticket.ticket_description) {
          this.ticket.ticket_description = '-';
        }
      },
      error: (err) => {
        console.error('❌ Error fetching ticket detail:', err);
      }
    });
  }

  buildTimeline(): void {
    this.timeline = [
      { title: 'Ticket Created', time: this.ticket.created_at },
      ...(this.ticket.assigned_to_name ? [{ title: `Assigned to ${this.ticket.assigned_to_name}`, time: this.ticket.created_at }] : []),
      ...(this.ticket.status ? [{ title: `Status Updated: ${this.ticket.status}`, time: this.ticket.updated_at }] : []),
      ...(this.ticket.resolved_at ? [{ title: `Resolved`, time: this.ticket.resolved_at }] : [])
    ];
  }

  fetchDevelopers(): void {
    const headers = this.getAuthHeaders();
    this.http.get(`${environment.apiBaseUrl}/users/developers`, { headers }).subscribe({
      next: (res: any) => {
        this.developers = res;
      },
      error: (err) => {
        console.error('❌ Error loading developers:', err);
      }
    });
  }

  assignDeveloper(): void {
    if (this.userRole !== 'Support') return;

    const assigned_to = this.assignForm.value.assigned_to;
    if (!assigned_to) return;

    const headers = this.getAuthHeaders();
    this.http.put(`${environment.apiBaseUrl}/tickets/${this.ticketId}`, { assigned_to }, { headers }).subscribe({
      next: (res: any) => {
        alert('✅ Developer assigned successfully');
        this.ticket = res;
        this.buildTimeline();
      },
      error: (err) => {
        console.error('❌ Error assigning developer:', err);
      }
    });
  }

escalateTicket(): void {
  if (!this.ticket?.id || !this.selectedDeveloperId) return;

  const headers = this.getAuthHeaders();
  this.http.put(`${environment.apiBaseUrl}/tickets/${this.ticket.id}/escalate`, {
    developerId: this.selectedDeveloperId
  }, { headers }).subscribe({
    next: (res: any) => {
      alert('🚀 Ticket escalated successfully!');
      this.ticket = res.ticket;

      // ✅ Rebuild the timeline with updated data
      this.timeline = [
        { title: 'Ticket Created', time: this.ticket.created_at },
        ...(this.ticket.assigned_to_name ? [{ title: `Assigned to ${this.ticket.assigned_to_name}`, time: this.ticket.updated_at }] : []),
        { title: `Status Updated: ${this.ticket.status}`, time: this.ticket.updated_at }
      ];
    },
    error: (err) => {
      console.error('❌ Error escalating ticket:', err);
      alert('Failed to escalate ticket.');
    }
  });
}

  markAsResolved(): void {
    if (!this.ticket?.id) return;
    const headers = this.getAuthHeaders();

    this.http.patch(`${environment.apiBaseUrl}/tickets/${this.ticket.id}/resolve`, {}, { headers }).subscribe({
      next: (res: any) => {
        alert('✅ Ticket marked as resolved!');
        this.ticket.status = 'Resolved';
        this.ticket.resolved_at = res.ticket.resolved_at || new Date().toISOString();
        this.buildTimeline();
      },
      error: (err) => {
        console.error('❌ Failed to resolve ticket:', err);
        alert('Failed to resolve ticket.');
      }
    });
  }

  openPreview(url: string): void {
    if (url) {
      this.previewUrl = url;
    }
  }

  closePreview(): void {
    this.previewUrl = null;
  }

  goBack(): void {
    this.router.navigate(['/admin/tickets']);
  }

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`
    });
  }
}
