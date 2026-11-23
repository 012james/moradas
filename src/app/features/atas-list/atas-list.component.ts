import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FirebaseApp } from '@angular/fire/app';
import { getFirestore, collection, onSnapshot } from '@angular/fire/firestore';
import { Subscription, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth.service';
import { NotificationService } from '../../services/notification/notification.service';
import { PackagesService } from '../../services/packages/packages.service';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';

export interface AssemblyItem {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  location?: string;
  pdfUrl?: string;
  status: 'open' | 'closed';
  outcome?: 'aprovada' | 'reprovada' | 'approved' | 'rejected' | 'insufficient_votes';
  expiresAt: Date;
  date: string;
  votesCount: number;
  favorCount: number;
  contraCount: number;
  absterCount: number;
  createdAt: number;
  createdByName?: string;
}

@Component({
  selector: 'app-atas-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HasRoleDirective],
  templateUrl: './atas-list.component.html',
  styleUrls: ['./atas-list.component.scss']
})
export class AtasListComponent implements OnInit, OnDestroy {
  private db = getFirestore(inject(FirebaseApp));
  private ngZone = inject(NgZone);
  public authService = inject(AuthService);
  private packagesService = inject(PackagesService);
  private notificationService = inject(NotificationService);

  private authSub?: Subscription;
  private unsub?: () => void;

  user$ = this.authService.currentUser$;

  pendingPackagesCount$ = this.authService.currentUser$.pipe(
    switchMap((user) =>
      user?.status === 'approved' && user.houseNumber
        ? this.packagesService.getPackagesByHouse$(user.houseNumber)
        : of([])
    ),
    map((pkgs) => pkgs.filter((p) => p.status === 'aguardando').length)
  );

  private allOpenAtas: AssemblyItem[] = [];
  private allClosedAtas: AssemblyItem[] = [];
  searchTerm = '';
  isLoading = true;

  sendingEmailAtaId: string | null = null;
  emailFeedback = '';

  // Libera visualização apenas para morador aprovado ou equipe (síndico, secretaria, porteiro)
  canViewAssemblies$ = this.authService.currentUser$.pipe(
    map((user) => {
      if (!user) return false;
      const isStaff = ['sindico', 'secretaria', 'porteiro'].includes(user.role);
      return isStaff || user.status === 'approved';
    })
  );

  get openAtas(): AssemblyItem[] {
    return this.filterBySearch(this.allOpenAtas);
  }

  get closedAtas(): AssemblyItem[] {
    return this.filterBySearch(this.allClosedAtas);
  }

  ngOnInit(): void {
    this.authSub = this.canViewAssemblies$.subscribe((canView) => {
      if (!canView) {
        if (this.unsub) {
          this.unsub();
          this.unsub = undefined;
        }
        this.ngZone.run(() => {
          this.allOpenAtas = [];
          this.allClosedAtas = [];
          this.isLoading = false;
        });
        return;
      }

      if (this.unsub) return;

      this.isLoading = true;
      const assembliesRef = collection(this.db, 'assemblies');

      this.unsub = onSnapshot(
        assembliesRef,
        (snapshot) => {
          const now = Date.now();
          const open: AssemblyItem[] = [];
          const closed: AssemblyItem[] = [];

          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const parsedExpiration = this.parseFirestoreDate(data['expiresAt']);
            const favorCount = Number(data['favorCount'] ?? data['approvedCount'] ?? 0);
            const contraCount = Number(data['contraCount'] ?? data['rejectedCount'] ?? 0);
            const absterCount = Number(data['absterCount'] ?? data['abstainCount'] ?? 0);

            const computedOutcome =
              data['outcome'] || (favorCount > contraCount ? 'aprovada' : 'reprovada');

            const item: AssemblyItem = {
              id: docSnap.id,
              title: data['title'] || 'Assembleia Geral',
              subtitle: data['subtitle'] || '',
              description: data['description'] || '',
              location: data['location'] || 'Virtual (App)',
              pdfUrl: data['pdfUrl'] || '',
              status: data['status'] || 'open',
              outcome: computedOutcome,
              expiresAt: parsedExpiration,
              date: parsedExpiration.toISOString(),
              votesCount: Number(data['votesCount']) || favorCount + contraCount + absterCount,
              favorCount,
              contraCount,
              absterCount,
              createdAt: Number(data['createdAt']) || 0,
              createdByName: data['createdByName'] || 'Administração'
            };

            const isExpired = parsedExpiration.getTime() <= now;
            if (item.status === 'open' && !isExpired) {
              open.push(item);
            } else {
              closed.push(item);
            }
          });

          open.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
          closed.sort((a, b) => b.createdAt - a.createdAt);

          this.ngZone.run(() => {
            this.allOpenAtas = open;
            this.allClosedAtas = closed;
            this.isLoading = false;
          });
        },
        () => {
          this.ngZone.run(() => {
            this.isLoading = false;
          });
        }
      );
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    if (this.unsub) {
      this.unsub();
    }
  }

  getFirstName(fullName?: string): string {
    if (!fullName) return 'Morador';
    return fullName.trim().split(' ')[0];
  }

  getQuorumPercent(votesCount = 0): number {
    return Math.min(100, Math.round((votesCount / 606) * 100));
  }

  convocarNoWhatsApp(ata: AssemblyItem): void {
    this.notificationService.shareAssemblyOnWhatsApp(ata);
  }

  async convocarPorEmail(ata: AssemblyItem): Promise<void> {
    this.sendingEmailAtaId = ata.id;
    try {
      const res = await this.notificationService.sendAssemblyEmailToResidents(ata, true);
      this.emailFeedback =
        res.totalRecipients > 0
          ? `Disparo preparado para ${res.totalRecipients} moradores aprovados!`
          : 'Nenhum morador aprovado com e-mail encontrado.';
      setTimeout(() => (this.emailFeedback = ''), 4000);
    } finally {
      this.sendingEmailAtaId = null;
    }
  }

  private filterBySearch(list: AssemblyItem[]): AssemblyItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (a) =>
        a.title.toLowerCase().includes(term) ||
        a.description.toLowerCase().includes(term)
    );
  }

  private parseFirestoreDate(raw: any): Date {
    if (!raw) return new Date(Date.now() + 86400000);
    if (typeof raw?.toDate === 'function') return raw.toDate();
    if (raw instanceof Date) return raw;
    return new Date(raw);
  }
}