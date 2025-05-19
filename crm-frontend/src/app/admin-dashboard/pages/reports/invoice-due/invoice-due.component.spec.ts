import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvoiceDueComponent } from './invoice-due.component';

describe('InvoiceDueComponent', () => {
  let component: InvoiceDueComponent;
  let fixture: ComponentFixture<InvoiceDueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoiceDueComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InvoiceDueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
