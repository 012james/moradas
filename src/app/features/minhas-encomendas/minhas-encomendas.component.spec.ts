import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MinhasEncomendasComponent } from './minhas-encomendas.component';

describe('MinhasEncomendasComponent', () => {
  let component: MinhasEncomendasComponent;
  let fixture: ComponentFixture<MinhasEncomendasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinhasEncomendasComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MinhasEncomendasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
