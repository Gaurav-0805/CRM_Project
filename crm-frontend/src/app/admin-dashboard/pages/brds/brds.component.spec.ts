import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrdsComponent } from './brds.component';

describe('BrdsComponent', () => {
  let component: BrdsComponent;
  let fixture: ComponentFixture<BrdsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrdsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BrdsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
