import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Ata, VoteChoice } from '../../shared/ata.model';
import { AtasService } from '../../services/assembly/assembly.service';
import { FooterComponent } from '../../shared/footer/footer.component';
import { NavComponent } from '../../shared/nav/nav.component';
import { AuthService } from '../../services/auth/auth.service';
import { take } from 'rxjs';


@Component({
  selector: 'app-ata-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FooterComponent, NavComponent],
  templateUrl: './ata-detail.component.html',
  styleUrls: ['./ata-detail.component.scss']
})
export class AtaDetailComponent implements OnInit {
  ata: Ata | null = null;
  votedOption: VoteChoice | null = null;
  isSubmitting = false;
  authService = inject(AuthService);
  voteResults: { approved: number; rejected: number; abstain: number; total: number; } | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private atasService: AtasService
  ) {}

  ngOnInit(): void {
    const ataId = this.route.snapshot.paramMap.get('id') || '1';
    this.atasService.getAtaById(ataId).subscribe((ata: Ata | null) => {
      this.ata = ata;
      this.votedOption = ata?.userVote ?? null;
    });

    this.atasService.getVoteResults(ataId).subscribe(results => {
      console.log('Vote results:', results, this.ata?.id!);
      this.voteResults = results;
    });
  }

  castVote(option: VoteChoice): void {
    this.isSubmitting = true;

    this.authService.currentUser$.pipe(take(1)).subscribe(async (user) => {
      if (user && user.uid) {
        try {
          await this.atasService.submitVote(this.ata?.id!, user.uid, option);
          this.isSubmitting = false;
          this.votedOption = option;
        } catch (error) {
          console.error('Erro ao votar:', error);
          alert('Falha ao computar o voto.');
        }
      }
    });
}

  resetVote(): void {
    this.votedOption = null;
  }

  downloadPdf(): void {
    window.open(this.ata?.pdfUrl, '_blank');
  }

  goBack(): void {
    this.router.navigate(['/atas']);
  }
}