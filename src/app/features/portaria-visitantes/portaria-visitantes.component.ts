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
import { Subscription, firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { VisitorsService } from '../../services/visitors/visitors.service';
import { VisitorAuthorization, VisitorLog } from '../../shared/models/visitor.model';

@Component({
  selector: 'app-portaria-visitantes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './portaria-visitantes.component.html',
  styleUrls: ['./portaria-visitantes.component.scss']
})
export class PortariaVisitantesComponent implements OnInit, OnDestroy {
  private visitorsService = inject(VisitorsService);
  private authService = inject(AuthService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private subs = new Subscription();

  allVisitors: VisitorAuthorization[] = [];
  allLogs: VisitorLog[] = [];

  houseFilter: number | null = null;
  searchTerm = '';
  filterMode: 'todos_hoje' | 'unico' | 'permanente' | 'historico' = 'todos_hoje';
  historyDatePreset: 'todos' | 'hoje' | 'ontem' | 'data' = 'todos';
  customHistoryDate = '';

  processingId: string | null = null;
  toastMsg = '';

  get todayStr(): string {
    return this.getLocalDateStr(new Date());
  }

  get yesterdayStr(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return this.getLocalDateStr(d);
  }

  ngOnInit(): void {
    this.subs.add(
      this.visitorsService.getGatehouseVisitors$().subscribe((list) => {
        this.ngZone.run(() => {
          this.allVisitors = list;
          this.cdr.detectChanges();
        });
      })
    );

    this.subs.add(
      this.visitorsService.getVisitorLogs$(300).subscribe((logs) => {
        this.ngZone.run(() => {
          this.allLogs = logs;
          this.cdr.detectChanges();
        });
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get validTodayCount(): number {
    const today = this.todayStr;
    return this.allVisitors.filter(
      (v) =>
        v.active === true &&
        this.matchesHouse(v.houseNumber) &&
        (v.accessType === 'permanente' ||
          (v.accessType === 'unico' && this.normalizeDateStr(v.validDate) === today))
    ).length;
  }

  get singleTodayCount(): number {
    const today = this.todayStr;
    return this.allVisitors.filter(
      (v) =>
        v.active === true &&
        this.matchesHouse(v.houseNumber) &&
        v.accessType === 'unico' &&
        this.normalizeDateStr(v.validDate) === today
    ).length;
  }

  get permanentCount(): number {
    return this.allVisitors.filter(
      (v) =>
        v.active === true &&
        this.matchesHouse(v.houseNumber) &&
        v.accessType === 'permanente'
    ).length;
  }

  get filteredList(): VisitorAuthorization[] {
    const term = this.searchTerm.trim().toLowerCase();
    const today = this.todayStr;

    return this.allVisitors
      .filter((v) => {
        if (!v.active) return false;
        if (!this.matchesHouse(v.houseNumber)) return false;

        const validDate = this.normalizeDateStr(v.validDate);

        if (this.filterMode === 'unico') {
          return v.accessType === 'unico' && validDate === today;
        }
        if (this.filterMode === 'permanente') {
          return v.accessType === 'permanente';
        }
        return (
          v.accessType === 'permanente' ||
          (v.accessType === 'unico' && validDate === today)
        );
      })
      .filter((v) => {
        if (!term) return true;
        return (
          String(v.houseNumber) === term ||
          (v.visitorName || '').toLowerCase().includes(term) ||
          (v.vehiclePlate || '').toLowerCase().includes(term) ||
          (v.visitorDoc || '').toLowerCase().includes(term)
        );
      });
  }

  get filteredLogs(): VisitorLog[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.allLogs
      .filter((log) => {
        if (!this.matchesHouse(log.houseNumber)) return false;

        const logDate = this.getLocalDateStr(new Date(Number(log.enteredAt)));

        if (this.historyDatePreset === 'hoje') {
          return logDate === this.todayStr;
        }
        if (this.historyDatePreset === 'ontem') {
          return logDate === this.yesterdayStr;
        }
        if (this.historyDatePreset === 'data' && this.customHistoryDate) {
          return logDate === this.customHistoryDate;
        }
        return true;
      })
      .filter((log) => {
        if (!term) return true;
        return (
          String(log.houseNumber) === term ||
          (log.visitorName || '').toLowerCase().includes(term) ||
          (log.vehiclePlate || '').toLowerCase().includes(term) ||
          (log.visitorDoc || '').toLowerCase().includes(term) ||
          (log.checkedInByName || '').toLowerCase().includes(term)
        );
      });
  }

  selectDatePreset(preset: 'todos' | 'hoje' | 'ontem'): void {
    this.historyDatePreset = preset;
    this.customHistoryDate = '';
  }

  onCustomDateChange(value: string): void {
    this.customHistoryDate = value;
    this.historyDatePreset = value ? 'data' : 'todos';
  }

  async confirmEntry(visitor: VisitorAuthorization): Promise<void> {
    this.processingId = visitor.id;
    try {
      const operator = await firstValueFrom(this.authService.currentUser$);
      if (!operator) return;

      await this.visitorsService.registerGateEntry(visitor, operator);
      this.ngZone.run(() => {
        this.toastMsg = `Entrada registrada: ${visitor.visitorName || 'Visitante'} → Casa ${visitor.houseNumber}!`;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.toastMsg = '';
          this.cdr.detectChanges();
        }, 3500);
      });
    } finally {
      this.ngZone.run(() => {
        this.processingId = null;
        this.cdr.detectChanges();
      });
    }
  }

  private matchesHouse(houseNumber?: number | string): boolean {
    if (this.houseFilter === null || this.houseFilter === undefined || String(this.houseFilter) === '') {
      return true;
    }
    return Number(houseNumber) === Number(this.houseFilter);
  }

  private getLocalDateStr(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizeDateStr(raw: any): string {
    if (!raw) return '';
    if (typeof raw?.toDate === 'function') {
      return this.getLocalDateStr(raw.toDate());
    }
    if (raw instanceof Date) {
      return this.getLocalDateStr(raw);
    }
    return String(raw).trim().slice(0, 10);
  }
}