import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, take } from 'rxjs';
import { Ata, VoteChoice } from '../../shared/models/ata.model';
import { AuthService } from '../../services/auth/auth.service';
import { AssemblyService } from '../../services/assembly/assembly.service';

@Component({
  selector: 'app-ata-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ata-detail.component.html',
  styleUrls: ['./ata-detail.component.scss']
})
export class AtaDetailComponent implements OnInit, OnDestroy {
  ata: Ata | null = null;
  currentVote: 'favor' | 'contra' | 'abster' | null = null;
  isChangingVote = false;
  isSubmitting = false;

  totalVotes = 0;
  favorCount = 0;
  contraCount = 0;
  absterCount = 0;

  authService = inject(AuthService);
  private ataSub?: Subscription;
  private resultsSub?: Subscription;
  private closeRequested = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private atasService: AssemblyService
  ) {}

  ngOnInit(): void {
    const ataId = this.route.snapshot.paramMap.get('id') || '1';

    this.ataSub = this.atasService.getAtaById(ataId).subscribe((ata: Ata | null) => {
      this.ata = ata;
      if (!this.isChangingVote) {
        this.currentVote = this.normalizeVote(ata?.userVote);
      }

      // Se no Firebase ainda consta como 'open', mas o horário já passou, atualiza para 'closed'
      if (ata?.id && ata.status === 'open' && !this.isPollOpen(ata) && !this.closeRequested) {
        this.closeRequested = true;
        this.atasService.closeExpiredAta(ata.id);
      }
    });

    this.resultsSub = this.atasService.getVoteResults(ataId).subscribe((results) => {
      this.favorCount = results.approved;
      this.contraCount = results.rejected;
      this.absterCount = results.abstain;
      this.totalVotes = results.total;
    });
  }

  ngOnDestroy(): void {
    this.ataSub?.unsubscribe();
    this.resultsSub?.unsubscribe();
  }

  get isRejected(): boolean {
    if (!this.ata) return true;
    if (this.ata.outcome === 'reprovada' || this.ata.outcome === 'rejected') return true;
    if (this.ata.outcome === 'aprovada' || this.ata.outcome === 'approved') return false;

    // Mesmo critério da tela inicial: só aprova se "A Favor" superar "Contra"
    return this.favorCount <= this.contraCount;
  }

  startChangeVote(): void {
    if (!this.isPollOpen(this.ata)) return;
    this.isChangingVote = true;
  }

  cancelChangeVote(): void {
    this.isChangingVote = false;
  }

  vote(option: 'favor' | 'contra' | 'abster'): void {
    if (!this.ata?.id || this.isSubmitting || !this.isPollOpen(this.ata)) return;

    // Se o morador abriu para mudar e clicou na mesma opção já registrada, apenas fecha o modo de edição
    if (this.currentVote === option && this.isChangingVote) {
      this.isChangingVote = false;
      return;
    }

    this.isSubmitting = true;

    this.authService.currentUser$.pipe(take(1)).subscribe(async (user) => {
      try {
        const uid = user?.id || (user as any)?.uid;
        if (!uid) return;

        await this.atasService.submitVote(this.ata!.id, uid, option);
        this.currentVote = option;
        this.isChangingVote = false;
      } catch (error) {
        console.error('Erro ao votar:', error);
        alert('Falha ao computar o voto. Verifique se a votação ainda está aberta ou se sua unidade está aprovada.');
      } finally {
        this.isSubmitting = false;
      }
    });
  }

  downloadPdf(): void {
    if (this.ata?.pdfUrl) {
      window.open(this.ata.pdfUrl, '_blank');
    }
  }

  goBack(): void {
    this.router.navigate(['/atas']);
  }

  private normalizeVote(raw?: VoteChoice | null): 'favor' | 'contra' | 'abster' | null {
    if (!raw) return null;
    if (raw === 'favor' || raw === 'approved') return 'favor';
    if (raw === 'contra' || raw === 'rejected') return 'contra';
    return 'abster';
  }

  isPollOpen(poll: any): boolean {
    if (!poll || poll.status !== 'open') return false;
    if (!poll.expiresAt) return true;

    const expiresMs = typeof poll.expiresAt.toDate === 'function'
      ? poll.expiresAt.toDate().getTime()
      : new Date(poll.expiresAt).getTime();

    return Date.now() < expiresMs;
  }
}