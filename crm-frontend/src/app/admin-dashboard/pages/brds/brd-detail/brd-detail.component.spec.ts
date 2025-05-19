import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrdDetailComponent } from './brd-detail.component';

describe('BrdDetailComponent', () => {
  let component: BrdDetailComponent;
  let fixture: ComponentFixture<BrdDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrdDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BrdDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
