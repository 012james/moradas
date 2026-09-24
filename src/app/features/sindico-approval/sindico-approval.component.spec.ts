import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SindicoApprovalComponent } from './sindico-approval.component';

describe('SindicoApprovalComponent', () => {
  let component: SindicoApprovalComponent;
  let fixture: ComponentFixture<SindicoApprovalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SindicoApprovalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SindicoApprovalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
