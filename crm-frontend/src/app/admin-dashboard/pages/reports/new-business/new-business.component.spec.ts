import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewBusinessComponent } from './new-business.component';

describe('NewBusinessComponent', () => {
  let component: NewBusinessComponent;
  let fixture: ComponentFixture<NewBusinessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewBusinessComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewBusinessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
