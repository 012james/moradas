import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Ata } from '../../shared/ata.model';
import { AtasService } from '../../services/assembly/assembly.service';


@Component({
  selector: 'app-atas-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './atas-list.component.html',
  styleUrls: ['./atas-list.component.scss']
})
export class AtasListComponent implements OnInit {
  activeAta: Ata | null = null;
  pastAtas: Ata[] = [];
  filteredPastAtas: Ata[] = [];
  searchQuery: string = '';
  filterStatus: 'all' | 'approved' | 'rejected' = 'all';
  currentTab: 'atas' | 'avisos' | 'perfil' = 'atas';
  private atasService = inject(AtasService);
  private router = inject(Router);

  ngOnInit(): void {
    this.loadAtas();
  }

  loadAtas(): void {
    console.log('load atas');
    this.atasService.getActiveAta().subscribe(ata => {
      console.log('atas ativas', ata);
      this.activeAta = ata;
    });

    this.atasService.getPastAtas().subscribe(atas => {
      console.log('atas passadas', atas);
      this.pastAtas = atas;
      this.filteredPastAtas = atas;
    });
  }

  filterAtas(): void {
    let result = [...this.pastAtas];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(a => 
        a.title.toLowerCase().includes(q) || 
        a.description?.toLowerCase().includes(q)
      );
    }

    if (this.filterStatus !== 'all') {
      result = result.filter(a => a.status === this.filterStatus);
    }

    this.filteredPastAtas = result;
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterAtas();
  }

  toggleFilter(): void {
    if (this.filterStatus === 'all') this.filterStatus = 'approved';
    else if (this.filterStatus === 'approved') this.filterStatus = 'rejected';
    else this.filterStatus = 'all';
    this.filterAtas();
  }

  openAta(id: string): void {
    this.router.navigate(['/atas', id]);
  }

  openProfile(): void {
    this.router.navigate(['/user']);
  }

  selectTab(tab: 'atas' | 'avisos' | 'perfil'): void {
    this.currentTab = tab;
  }

  showAllAtas(): void {
    this.searchQuery = '';
    this.filterStatus = 'all';
    this.filteredPastAtas = this.pastAtas;
  }
}