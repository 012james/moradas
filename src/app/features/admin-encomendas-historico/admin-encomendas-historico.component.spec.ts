import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminEncomendasHistoricoComponent } from './admin-encomendas-historico.component';

describe('AdminEncomendasHistoricoComponent', () => {
  let component: AdminEncomendasHistoricoComponent;
  let fixture: ComponentFixture<AdminEncomendasHistoricoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminEncomendasHistoricoComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdminEncomendasHistoricoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
