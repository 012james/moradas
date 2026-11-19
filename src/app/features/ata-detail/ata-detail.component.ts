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

  startChangeVote(): void {
    this.isChangingVote = true;
  }

  cancelChangeVote(): void {
    this.isChangingVote = false;
  }

  vote(option: 'favor' | 'contra' | 'abster'): void {
    if (!this.ata?.id || this.isSubmitting) return;

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
        alert('Falha ao computar o voto. Verifique se sua unidade está aprovada.');
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
}