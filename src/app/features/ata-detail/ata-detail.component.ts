import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Ata, VoteChoice } from '../../shared/ata.model';
import { AtasService } from '../../services/assembly/assembly.service';


@Component({
  selector: 'app-ata-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ata-detail.component.html',
  styleUrls: ['./ata-detail.component.scss']
})
export class AtaDetailComponent implements OnInit {
  ata: Ata | null = null;
  votedOption: VoteChoice | null = null;
  isSubmitting = false;

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
  }

  castVote(option: VoteChoice): void {
    this.isSubmitting = true;
    const ataId = this.ata?.id || '1';

    this.atasService.submitVote(ataId, option).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.votedOption = option;
      },
      error: (err: any) => {
        this.isSubmitting = false;
        console.error('Erro ao registrar voto:', err);
      }
    });
  }

  resetVote(): void {
    this.votedOption = null;
  }

  downloadPdf(): void {
    window.open('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '_blank');
  }

  goBack(): void {
    this.router.navigate(['/atas']);
  }
}