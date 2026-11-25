import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, take } from 'rxjs';
import { Ata, VoteAuditItem, VoteChoice } from '../../shared/models/ata.model';
import { AuthService } from '../../services/auth/auth.service';
import { AssemblyService } from '../../services/assembly/assembly.service';

@Component({
  selector: 'app-ata-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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

  // Relatório do Síndico
  canViewReport = false;
  auditVotes: VoteAuditItem[] = [];
  reportFilter: 'all' | 'favor' | 'contra' | 'abster' = 'all';
  reportSearch = '';

  authService = inject(AuthService);
  private ataSub?: Subscription;
  private resultsSub?: Subscription;
  private userSub?: Subscription;
  private auditSub?: Subscription;
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

    // Libera e carrega o relatório apenas para Síndico / Admin
    this.userSub = this.authService.currentUser$.subscribe((user: any) => {
      const role = String(user?.role || '').toLowerCase();
      this.canViewReport =
        role === 'admin' || role === 'sindico' || role === 'síndico' || user?.isAdmin === true;

      if (this.canViewReport && !this.auditSub) {
        this.auditSub = this.atasService.getVotesAudit$(ataId).subscribe((items) => {
          this.auditVotes = items;
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.ataSub?.unsubscribe();
    this.resultsSub?.unsubscribe();
    this.userSub?.unsubscribe();
    this.auditSub?.unsubscribe();
  }

  get filteredAuditVotes(): VoteAuditItem[] {
    const term = this.reportSearch.trim().toLowerCase();
    return this.auditVotes.filter((item) => {
      const matchesChoice = this.reportFilter === 'all' || item.choice === this.reportFilter;
      const matchesSearch =
        !term ||
        String(item.houseNumber).includes(term) ||
        item.voterName.toLowerCase().includes(term);
      return matchesChoice && matchesSearch;
    });
  }

  getChoiceLabel(choice: 'favor' | 'contra' | 'abster'): string {
    if (choice === 'favor') return 'A Favor';
    if (choice === 'contra') return 'Contra';
    return 'Abstenção';
  }

  exportVotesCsv(): void {
    if (!this.auditVotes.length) return;

    const header = 'Casa;Morador;Opcao Votada;Data e Hora';
    const rows = this.auditVotes.map((v) => {
      const dateStr = v.votedAt
        ? v.votedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        : '';
      const safeName = `"${v.voterName.replace(/"/g, '""')}"`;
      return `${v.houseNumber};${safeName};${this.getChoiceLabel(v.choice)};${dateStr}`;
    });

    // BOM UTF-8 (\uFEFF) garante acentuação correta ao abrir no Excel
    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    const slug = (this.ata?.title || 'assembleia')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    link.href = url;
    link.download = `relatorio-votos-${slug}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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