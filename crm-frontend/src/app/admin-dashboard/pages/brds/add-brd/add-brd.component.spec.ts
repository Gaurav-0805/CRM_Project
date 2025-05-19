import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddBrdComponent } from './add-brd.component';

describe('AddBrdComponent', () => {
  let component: AddBrdComponent;
  let fixture: ComponentFixture<AddBrdComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddBrdComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddBrdComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
