import {
  Directive,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  inject
} from '@angular/core';
import { UserProfile } from '../../shared/models/user.model';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';


@Directive({
  selector: '[appHasRole]',
  standalone: true
})
export class HasRoleDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private sub?: Subscription;

  private allowedRoles: UserProfile['role'][] = [];
  private hasView = false;

  @Input() set appHasRole(roles: UserProfile['role'][]) {
    this.allowedRoles = roles;
  }

  ngOnInit(): void {
    this.sub = this.authService.currentUser$.subscribe((user) => {
      const canView =
        !!user &&
        user.status === 'approved' &&
        this.allowedRoles.includes(user.role);

      if (canView && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!canView && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}