import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminBoletosComponent } from './admin-boletos.component';

describe('AdminBoletosComponent', () => {
  let component: AdminBoletosComponent;
  let fixture: ComponentFixture<AdminBoletosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminBoletosComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdminBoletosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
