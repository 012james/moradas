import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeusVisitantesComponent } from './meus-visitantes.component';

describe('MeusVisitantesComponent', () => {
  let component: MeusVisitantesComponent;
  let fixture: ComponentFixture<MeusVisitantesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeusVisitantesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MeusVisitantesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
