import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortariaVisitantesComponent } from './portaria-visitantes.component';

describe('PortariaVisitantesComponent', () => {
  let component: PortariaVisitantesComponent;
  let fixture: ComponentFixture<PortariaVisitantesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortariaVisitantesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PortariaVisitantesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
