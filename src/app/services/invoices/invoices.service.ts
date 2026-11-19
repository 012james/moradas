import { Injectable, inject, NgZone } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { UserProfile } from '../../shared/models/user.model';
import {
  getFirestore,
  collection,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  writeBatch,
  deleteField,
  onSnapshot
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { InvoiceExtraCharge, InvoiceItem } from '../../shared/models/invoice.model';
import { ReservationItem } from '../../shared/models/reservation.model';


@Injectable({
  providedIn: 'root'
})
export class InvoicesService {
  private db = getFirestore(inject(FirebaseApp));
  private ngZone = inject(NgZone);

  // 1. Busca reservas ainda não faturadas de uma casa específica (para prévia no lançamento individual)
  async getUnbilledReservationsByHouse(
    houseNumber: number,
    cutoffDate?: string
  ): Promise<ReservationItem[]> {
    const q = query(
      collection(this.db, 'reservations'),
      where('houseNumber', '==', Number(houseNumber))
    );
    const snap = await getDocs(q);

    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as unknown as ReservationItem))
      .filter((r) => !r.billedInInvoiceId && r.feeSnapshot > 0)
      .filter((r) => (!cutoffDate ? true : r.date <= cutoffDate))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // 2. Emissão Individual já vinculando reservas pendentes (se selecionadas)
  async createInvoice(
    data: {
      houseNumber: number;
      recipientName: string;
      referenceMonth: string;
      baseAmount: number;
      extraCharges?: InvoiceExtraCharge[];
      dueDate: string;
      barcode: string;
      pixCode?: string;
      pdfUrl?: string;
      notes?: string;
    },
    sindico: UserProfile
  ): Promise<InvoiceItem> {
    const batch = writeBatch(this.db);
    const newInvoiceRef = doc(collection(this.db, 'invoices'));

    const extras = data.extraCharges || [];
    const extrasSum = extras.reduce((acc, item) => acc + Number(item.amount), 0);
    const finalAmount = Number(data.baseAmount) + extrasSum;

    const extrasSummary = extras.map((e) => `${e.description}: R$ ${e.amount.toFixed(2)}`).join(' + ');
    const composedNotes = [data.notes?.trim(), extrasSummary ? `Adicionais: ${extrasSummary}` : '']
      .filter(Boolean)
      .join(' • ');

    const newInvoice = {
      houseNumber: Number(data.houseNumber),
      recipientName: data.recipientName.trim(),
      referenceMonth: data.referenceMonth.trim(),
      baseAmount: Number(data.baseAmount),
      extraCharges: extras,
      amount: finalAmount,
      dueDate: data.dueDate,
      barcode: data.barcode.trim(),
      pixCode: data.pixCode?.trim() || '',
      pdfUrl: data.pdfUrl?.trim() || '',
      notes: composedNotes,
      status: 'aberto' as const,
      createdAt: Date.now(),
      createdByName: sindico['name'] as string
    } as unknown as Omit<InvoiceItem, 'id'>;

    batch.set(newInvoiceRef, newInvoice);

    // Carimba cada reserva incluída como faturada neste boleto
    extras.forEach((extra) => {
      const resRef = doc(this.db, 'reservations', extra.reservationId);
      batch.update(resRef, {
        billedInInvoiceId: newInvoiceRef.id,
        billedReferenceMonth: data.referenceMonth.trim()
      });
    });

    await batch.commit();
    return { id: newInvoiceRef.id, ...newInvoice };
  }

  // 3. Emissão em Lote somando automaticamente Salão e Quiosques pendentes por Casa
  async generateBulkInvoicesForApprovedHouses(
    payload: {
      referenceMonth: string;
      amount: number;
      dueDate: string;
      pixCode: string;
      barcodePrefix?: string;
      notes?: string;
      includeUnbilledReservations?: boolean;
      reservationsCutoffDate?: string; // Ex: cobra reservas realizadas até o fim do mês anterior/atual
    },
    sindico: UserProfile
  ): Promise<{
    createdCount: number;
    skippedCount: number;
    housesWithExtrasCount: number;
    totalExtrasAmount: number;
    notifiedEmails: string[];
  }> {
    const usersSnap = await getDocs(
      query(collection(this.db, 'users'), where('status', '==', 'approved'))
    );

    const houseMap = new Map<number, { titularName: string; emails: Set<string> }>();

    usersSnap.docs.forEach((d) => {
      const u = d.data() as UserProfile;
      const houseNum = Number(u['houseNumber']);
      if (!houseNum || houseNum < 1 || houseNum > 600) return;

      if (!houseMap.has(houseNum)) {
        houseMap.set(houseNum, {
          titularName: (u['name'] || `Casa ${houseNum}`).trim(),
          emails: new Set<string>()
        });
      }
      if (u['email'] && u['email'].includes('@')) {
        houseMap.get(houseNum)!.emails.add(u['email'].trim().toLowerCase());
      }
    });

    if (houseMap.size === 0) {
      return {
        createdCount: 0,
        skippedCount: 0,
        housesWithExtrasCount: 0,
        totalExtrasAmount: 0,
        notifiedEmails: []
      };
    }

    // Evita duplicar casas que já têm boleto no mês
    const normalizedMonth = payload.referenceMonth.trim().toLowerCase();
    const existingSnap = await getDocs(collection(this.db, 'invoices'));
    const housesWithInvoice = new Set<number>();

    existingSnap.docs.forEach((d) => {
      const inv = d.data() as InvoiceItem;
      if ((inv.referenceMonth || '').trim().toLowerCase() === normalizedMonth) {
        housesWithInvoice.add(Number(inv.houseNumber));
      }
    });

    // Agrupa todas as reservas ainda não cobradas por casa
    const unbilledByHouse = new Map<number, ReservationItem[]>();
    if (payload.includeUnbilledReservations !== false) {
      const resSnap = await getDocs(collection(this.db, 'reservations'));
      resSnap.docs.forEach((d) => {
        const res = { id: d.id, ...d.data() } as unknown as ReservationItem;
        if (res.billedInInvoiceId || !res.feeSnapshot || res.feeSnapshot <= 0) return;
        if (payload.reservationsCutoffDate && res.date > payload.reservationsCutoffDate) return;

        const hNum = Number(res.houseNumber);
        const list = unbilledByHouse.get(hNum) || [];
        list.push(res);
        unbilledByHouse.set(hNum, list);
      });
    }

    const housesToCreate: Array<{
      houseNumber: number;
      titularName: string;
      emails: string[];
      reservations: ReservationItem[];
    }> = [];

    let skippedCount = 0;
    houseMap.forEach((info, houseNumber) => {
      if (housesWithInvoice.has(houseNumber)) {
        skippedCount++;
      } else {
        housesToCreate.push({
          houseNumber,
          titularName: info.titularName,
          emails: Array.from(info.emails),
          reservations: unbilledByHouse.get(houseNumber) || []
        });
      }
    });

    // Cada unidade consome 1 escrita para o boleto + N escritas para carimbar suas reservas.
    // Usamos blocos seguros de 150 casas para nunca ultrapassar 500 operações por writeBatch.
    const chunkSize = 150;
    const allEmails = new Set<string>();
    const now = Date.now();
    let housesWithExtrasCount = 0;
    let totalExtrasAmount = 0;

    for (let i = 0; i < housesToCreate.length; i += chunkSize) {
      const chunk = housesToCreate.slice(i, i + chunkSize);
      const batch = writeBatch(this.db);

      chunk.forEach((unit) => {
        const newDocRef = doc(collection(this.db, 'invoices'));
        const baseAmount = Number(payload.amount);

        const extraCharges: InvoiceExtraCharge[] = unit.reservations.map((r) => {
          const shortDate = r.date.split('-').reverse().slice(0, 2).join('/');
          return {
            reservationId: r.id,
            description: `${r.spaceName} (${shortDate})`,
            amount: Number(r.feeSnapshot)
          };
        });

        const extrasTotal = extraCharges.reduce((sum, e) => sum + e.amount, 0);
        if (extraCharges.length > 0) {
          housesWithExtrasCount++;
          totalExtrasAmount += extrasTotal;
        }

        const finalAmount = baseAmount + extrasTotal;
        const baseNotes = payload.notes?.trim() || 'Taxa condominial ordinária mensal';
        const extrasNote =
          extraCharges.length > 0
            ? `Inclui reserva(s): ${extraCharges
                .map((e) => `${e.description} R$ ${e.amount.toFixed(2)}`)
                .join(', ')}`
            : '';

        const autoBarcode = payload.barcodePrefix?.trim()
          ? `${payload.barcodePrefix.trim()} • CASA ${unit.houseNumber}`
          : `PAGAMENTO VIA PIX OU BOLETO • CASA ${unit.houseNumber}`;

        batch.set(newDocRef, {
          houseNumber: unit.houseNumber,
          recipientName: unit.titularName,
          referenceMonth: payload.referenceMonth.trim(),
          baseAmount,
          extraCharges,
          amount: finalAmount,
          dueDate: payload.dueDate,
          barcode: autoBarcode,
          pixCode: payload.pixCode.trim(),
          pdfUrl: '',
          notes: [baseNotes, extrasNote].filter(Boolean).join(' • '),
          status: 'aberto',
          createdAt: now,
          createdByName: sindico['name']
        });

        // Marca as reservas desta casa como já cobradas neste boleto
        unit.reservations.forEach((r) => {
          const resRef = doc(this.db, 'reservations', r.id);
          batch.update(resRef, {
            billedInInvoiceId: newDocRef.id,
            billedReferenceMonth: payload.referenceMonth.trim()
          });
        });

        unit.emails.forEach((e) => allEmails.add(e));
      });

      await batch.commit();
    }

    return {
      createdCount: housesToCreate.length,
      skippedCount,
      housesWithExtrasCount,
      totalExtrasAmount,
      notifiedEmails: Array.from(allEmails)
    };
  }

  getInvoicesByHouse$(houseNumber: number): Observable<InvoiceItem[]> {
    return new Observable<InvoiceItem[]>((observer) => {
      const q = query(
        collection(this.db, 'invoices'),
        where('houseNumber', '==', Number(houseNumber))
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as unknown as InvoiceItem))
            .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
          this.ngZone.run(() => observer.next(list));
        },
        (err) => this.ngZone.run(() => observer.error(err))
      );
      return () => unsub();
    });
  }

  getAllInvoices$(): Observable<InvoiceItem[]> {
    return new Observable<InvoiceItem[]>((observer) => {
      const unsub = onSnapshot(
        collection(this.db, 'invoices'),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as unknown as InvoiceItem))
            .sort((a, b) => b.createdAt - a.createdAt);
          this.ngZone.run(() => observer.next(list));
        },
        (err) => this.ngZone.run(() => observer.error(err))
      );
      return () => unsub();
    });
  }

  async markAsPaid(invoiceId: string): Promise<void> {
    await updateDoc(doc(this.db, 'invoices', invoiceId), {
      status: 'pago',
      paidAt: Date.now()
    });
  }

  // Se o síndico excluir um boleto lançado por engano, libera as reservas vinculadas para cobrança futura
  async deleteInvoice(invoice: InvoiceItem): Promise<void> {
    const batch = writeBatch(this.db);
    batch.delete(doc(this.db, 'invoices', invoice.id));

    (invoice.extraCharges || []).forEach((extra: { reservationId: string; }) => {
      const resRef = doc(this.db, 'reservations', extra.reservationId);
      batch.update(resRef, {
        billedInInvoiceId: deleteField(),
        billedReferenceMonth: deleteField()
      });
    });

    await batch.commit();
  }
}