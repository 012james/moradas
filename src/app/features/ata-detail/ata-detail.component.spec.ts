import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalheAtaComponent } from './ata-detail.component';

describe('DetalheAtaComponent', () => {
  let component: DetalheAtaComponent;
  let fixture: ComponentFixture<DetalheAtaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalheAtaComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DetalheAtaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
