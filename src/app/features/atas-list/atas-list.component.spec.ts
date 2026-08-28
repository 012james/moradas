import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuAtasComponent } from './atas-list.component';

describe('MenuAtasComponent', () => {
  let component: MenuAtasComponent;
  let fixture: ComponentFixture<MenuAtasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuAtasComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MenuAtasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
