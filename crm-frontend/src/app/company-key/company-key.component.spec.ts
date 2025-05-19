import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanyKeyComponent } from './company-key.component';

describe('CompanyKeyComponent', () => {
  let component: CompanyKeyComponent;
  let fixture: ComponentFixture<CompanyKeyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyKeyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompanyKeyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
