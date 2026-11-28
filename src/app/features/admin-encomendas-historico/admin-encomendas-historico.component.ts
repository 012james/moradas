import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  NgZone,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { PackagesService } from '../../services/packages/packages.service';
import { PackageItem } from '../../shared/models/package.model';

@Component({
  selector: 'app-admin-encomendas-historico',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-encomendas-historico.component.html',
  styleUrls: ['./admin-encomendas-historico.component.scss']
})
export class AdminEncomendasHistoricoComponent implements OnInit, OnDestroy {
  private packagesService = inject(PackagesService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private historySub?: Subscription;

  packages: any[] = [];
  isLoading = true;

  datePreset: 'hoje' | '7dias' | 'data' | 'ultimas100' = 'hoje';
  customDate = '';
  searchTerm = '';

  ngOnInit(): void {
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.historySub?.unsubscribe();
  }

  selectPreset(preset: 'hoje' | '7dias' | 'ultimas100'): void {
    this.datePreset = preset;
    this.customDate = '';
    this.loadHistory();
  }

  onCustomDateChange(value: string): void {
    this.customDate = value;
    this.datePreset = value ? 'data' : 'hoje';
    this.loadHistory();
  }

  loadHistory(): void {
    this.historySub?.unsubscribe();
    this.isLoading = true;

    const { startMs, endMs, maxLimit } = this.getRangeBounds();

    this.historySub = this.packagesService
      .getDeliveredHistory$(startMs, endMs, maxLimit)
      .subscribe({
        next: (list) => {
          this.ngZone.run(() => {
            this.packages = list;
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        }
      });
  }

  get filteredPackages(): any[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.packages;

    return this.packages.filter((p) => {
      const house = String(p.houseNumber || '');
      const recipient = String(p.recipientName || '').toLowerCase();
      const carrier = String(p.carrier || '').toLowerCase();
      const receivedBy = String(p.receivedByName || '').toLowerCase();
      const releasedBy = String(p.releasedByName || '').toLowerCase();
      const pickedUpBy = String(p.pickedUpByName || '').toLowerCase();
      const pin = String(p.pickupPin || '').toLowerCase();

      return (
        house === term ||
        recipient.includes(term) ||
        carrier.includes(term) ||
        receivedBy.includes(term) ||
        releasedBy.includes(term) ||
        pickedUpBy.includes(term) ||
        pin.includes(term)
      );
    });
  }

  toDateObj(raw: any): Date | null {
    if (!raw) return null;
    if (typeof raw?.toDate === 'function') return raw.toDate();
    if (raw instanceof Date) return raw;
    const d = new Date(Number(raw) || raw);
    return isNaN(d.getTime()) ? null : d;
  }

  exportCsv(): void {
    if (!this.filteredPackages.length) return;

    const header =
      'Casa;Destinatario;Transportadora/Loja;Recebido em;Recebido por;Retirado em;Retirado por;Baixa por';
    const rows = this.filteredPackages.map((p) => {
      const received =
        this.toDateObj(p.receivedAt)?.toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short'
        }) || '';
      const pickedUp =
        this.toDateObj(p.pickedUpAt)?.toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short'
        }) || '';

      const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;

      return [
        p.houseNumber || '',
        escape(p.recipientName),
        escape(p.carrier),
        received,
        escape(p.receivedByName),
        pickedUp,
        escape(p.pickedUpByName),
        escape(p.releasedByName)
      ].join(';');
    });

    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-encomendas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private getRangeBounds(): { startMs?: number; endMs?: number; maxLimit: number } {
    if (this.datePreset === 'hoje') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { startMs: start.getTime(), maxLimit: 200 };
    }

    if (this.datePreset === '7dias') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { startMs: start.getTime(), maxLimit: 250 };
    }

    if (this.datePreset === 'data' && this.customDate) {
      const [y, m, d] = this.customDate.split('-').map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0, 0);
      const end = new Date(y, m - 1, d, 23, 59, 59, 999);
      return { startMs: start.getTime(), endMs: end.getTime(), maxLimit: 200 };
    }

    return { maxLimit: 100 };
  }
}