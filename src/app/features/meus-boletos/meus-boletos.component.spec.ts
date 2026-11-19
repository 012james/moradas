import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeusBoletosComponent } from './meus-boletos.component';

describe('MeusBoletosComponent', () => {
  let component: MeusBoletosComponent;
  let fixture: ComponentFixture<MeusBoletosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeusBoletosComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MeusBoletosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
