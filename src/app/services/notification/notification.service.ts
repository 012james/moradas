import { Injectable, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { UserProfile } from '../../shared/models/user.model';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from '@angular/fire/firestore';
import { PackageItem } from '../../shared/models/package.model';
import { InvoiceItem } from '../../shared/models/invoice.model';

export interface AssemblySharePayload {
  id?: string;
  title: string;
  subtitle?: string;
  description: string;
  date: string;
  location?: string;
  votesCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private db = getFirestore(inject(FirebaseApp));

  // Opcional: Preencha se quiser usar a API gratuita do EmailJS (https://www.emailjs.com)
  private readonly emailJsConfig = {
    enabled: false,
    serviceId: 'SEU_SERVICE_ID',
    templateId: 'SEU_TEMPLATE_ID',
    publicKey: 'SUA_PUBLIC_KEY'
  };

  // --- NOTIFICAÇÕES DE ENCOMENDAS (E-MAIL E WHATSAPP POR CASA) ---

  // 1. Busca todos os moradores aprovados vinculados àquela casa específica (1 a 606)
  async getApprovedResidentsByHouse(houseNumber: number): Promise<UserProfile[]> {
    const usersRef = collection(this.db, 'users');
    const q = query(
      usersRef,
      where('houseNumber', '==', Number(houseNumber)),
      where('status', '==', 'approved')
    );

    const snap = await getDocs(q);
    return snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as unknown as UserProfile)
    );
  }

  // 2. Envia E-mail com o PIN de 4 dígitos para os moradores aprovados da Casa
  async sendPackageArrivalEmail(
    pkg: PackageItem,
    openMailClientFallback = false
  ): Promise<{ totalRecipients: number; emails: string[] }> {
    const residents = await this.getApprovedResidentsByHouse(pkg.houseNumber);
    const emails = Array.from(
      new Set(
        residents
          .map((r) => (r.email || '').trim().toLowerCase())
          .filter((e) => e.includes('@'))
      )
    );

    if (emails.length === 0) {
      return { totalRecipients: 0, emails: [] };
    }

    const appUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/encomendas` : '';

    const subject = `📦 [Condomínio Moradas] Encomenda na Portaria — Casa ${pkg.houseNumber} (PIN: ${pkg.pickupPin})`;

    const plainBody = [
      `Olá! Uma encomenda acabou de chegar na portaria para a Casa ${pkg.houseNumber}.`,
      ``,
      `📦 ORIGEM: ${pkg.carrier}`,
      `👤 DESTINATÁRIO NA ETIQUETA: ${pkg.recipientName}`,
      pkg.storageLocation ? `📍 LOCAL NA PORTARIA: ${pkg.storageLocation}` : null,
      `🔐 PIN PARA RETIRADA: ${pkg.pickupPin}`,
      ``,
      `Apresente este código de 4 dígitos ao porteiro para retirar seu pacote com segurança.`,
      `Consulte todas as encomendas da sua unidade em:`,
      `${appUrl}`,
      ``,
      `Portaria 24h — Condomínio Moradas`
    ]
      .filter(Boolean)
      .join('\n');

    const htmlBody = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f4f7fb; padding: 24px; border-radius: 16px;">
        <div style="background: #ffffff; padding: 28px; border-radius: 14px; border-top: 5px solid #0056b3;">
          <span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 700;">
            📦 ${pkg.carrier} • Casa ${pkg.houseNumber}
          </span>
          <h2 style="color: #0f172a; margin: 14px 0 6px 0;">Sua encomenda chegou na portaria!</h2>
          <p style="color: #475569; margin: 0 0 16px 0; font-size: 14px;">
            Destinatário: <strong>${pkg.recipientName}</strong>
            ${pkg.storageLocation ? `<br>Localização: <strong>${pkg.storageLocation}</strong>` : ''}
          </p>
          <div style="background: #eff6ff; border: 2px dashed #0056b3; border-radius: 12px; padding: 16px; text-align: center; margin: 18px 0;">
            <span style="display: block; font-size: 12px; color: #475569; margin-bottom: 6px;">
              Informe este PIN de 4 dígitos no balcão da portaria:
            </span>
            <strong style="font-size: 32px; letter-spacing: 10px; color: #0056b3;">
              ${pkg.pickupPin}
            </strong>
          </div>
          <a href="${appUrl}" style="display: inline-block; background: #0056b3; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; font-size: 14px;">
            Ver Ticket Digital no App
          </a>
        </div>
      </div>
    `;

    // Grava na fila 'mail' do Firestore
    await addDoc(collection(this.db, 'mail'), {
      to: emails,
      createdAt: serverTimestamp(),
      type: 'package_arrival',
      houseNumber: pkg.houseNumber,
      packageId: pkg.id,
      message: {
        subject,
        text: plainBody,
        html: htmlBody
      }
    });

    // Dispara via EmailJS caso configurado
    if (this.emailJsConfig.enabled) {
      await this.sendViaEmailJs(emails.join(','), subject, plainBody);
    }

    // Caso o porteiro clique em abrir o cliente de e-mail manualmente
    if (openMailClientFallback && typeof window !== 'undefined') {
      const mailtoLink = `mailto:${encodeURIComponent(
        emails.join(',')
      )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
      window.location.href = mailtoLink;
    }

    return { totalRecipients: emails.length, emails };
  }

  // 3. Dispara mensagem no WhatsApp do morador com o PIN de 4 dígitos
  async sharePackageOnWhatsApp(pkg: PackageItem, explicitPhone?: string): Promise<void> {
    let targetPhone = explicitPhone || '';

    if (!targetPhone) {
      const residents = await this.getApprovedResidentsByHouse(pkg.houseNumber);
      const residentWithPhone = residents.find((r) => r.phone && r.phone.trim().length >= 8);
      if (residentWithPhone?.phone) {
        targetPhone = residentWithPhone.phone;
      }
    }

    const cleanDigits = targetPhone.replace(/\D/g, '');
    const formattedPhone =
      cleanDigits.length >= 10 && !cleanDigits.startsWith('55')
        ? `55${cleanDigits}`
        : cleanDigits;

    const appUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/encomendas` : '';

    const text = [
      `📦 *ENCOMENDA NA PORTARIA — Condomínio Moradas*`,
      ``,
      `Olá! Chegou uma encomenda para a *Casa ${pkg.houseNumber}*:`,
      `• *Destinatário:* ${pkg.recipientName}`,
      `• *Origem:* ${pkg.carrier}`,
      pkg.storageLocation ? `• *Local na portaria:* ${pkg.storageLocation}` : null,
      ``,
      `🔐 *PIN para retirada:* *${pkg.pickupPin}*`,
      ``,
      `_Informe este código de 4 dígitos ao porteiro no momento da retirada._`,
      `📲 Consulte no app: ${appUrl}`
    ]
      .filter(Boolean)
      .join('\n');

    const whatsappUrl = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  // 1. Busca todos os e-mails únicos de moradores aprovados no banco
  async getApprovedResidentEmails(): Promise<string[]> {
    const usersRef = collection(this.db, 'users');
    const q = query(usersRef, where('status', '==', 'approved'));
    const snap = await getDocs(q);

    const emails = snap.docs
      .map((docSnap) => (docSnap.data()['email'] as string || '').trim().toLowerCase())
      .filter((email) => email.includes('@'));

    return Array.from(new Set(emails));
  }

  // 2. Dispara Convocação de Assembleia no WhatsApp
  shareAssemblyOnWhatsApp(ata: AssemblySharePayload): void {
    const appUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/atas/${ata.id || ''}`
        : '';

    const formattedDate = ata.date
      ? new Date(ata.date).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Consulte no app';

    const text = [
      `🗳️ *CONVOCAÇÃO DE ASSEMBLEIA — Condomínio Moradas*`,
      ``,
      `*${ata.subtitle || ata.title}*`,
      `${ata.description}`,
      ``,
      `📅 *Prazo limite:* ${formattedDate}`,
      `📍 *Modalidade:* ${ata.location || 'Virtual pelo Aplicativo'}`,
      `📊 *Participação atual:* ${ata.votesCount || 0} de 606 casas já votaram`,
      ``,
      `👉 *Registre o voto da sua unidade agora pelo link:*`,
      appUrl
    ].join('\n');

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // 3. Dispara Convocação de Assembleia por E-mail (Fila Automática + Cliente de E-mail em CCO)
  async sendAssemblyEmailToResidents(
    ata: AssemblySharePayload,
    openMailClientFallback = true
  ): Promise<{ totalRecipients: number }> {
    const emails = await this.getApprovedResidentEmails();
    if (emails.length === 0) {
      return { totalRecipients: 0 };
    }

    const appUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/atas/${ata.id || ''}`
        : '';

    const subject = `[Condomínio Moradas] Votação Aberta: ${ata.subtitle || ata.title}`;
    const plainBody = [
      `Olá, morador(a) do Condomínio Moradas!`,
      ``,
      `Uma pauta oficial está aberta para votação da sua unidade:`,
      `PAUTA: ${ata.subtitle || ata.title}`,
      ``,
      `RESUMO:`,
      `${ata.description}`,
      ``,
      `MODALIDADE: ${ata.location || 'Virtual (App)'}`,
      `PARTICIPAÇÃO ATUAL: ${ata.votesCount || 0} de 606 unidades`,
      ``,
      `Lembramos que cada residência (casas 1 a 606) possui direito a 1 voto auditado.`,
      `Acesse o aplicativo para consultar os anexos em PDF e registrar seu voto:`,
      `${appUrl}`,
      ``,
      `Atenciosamente,`,
      `Administração — Condomínio Moradas`
    ].join('\n');

    // A) Grava na coleção 'mail' (Disparo automático se a extensão Firebase Trigger Email estiver ativa)
    await addDoc(collection(this.db, 'mail'), {
      bcc: emails,
      createdAt: serverTimestamp(),
      type: 'assembly_convocation',
      message: {
        subject,
        text: plainBody,
        html: this.buildHtmlTemplate(
          'Votação em Aberto',
          ata.subtitle || ata.title,
          ata.description,
          'Acessar Pauta e Votar Agora',
          appUrl
        )
      }
    });

    // B) Se EmailJS estiver configurado, envia via REST API gratuita sem precisar de servidor
    if (this.emailJsConfig.enabled) {
      await this.sendViaEmailJs(emails.join(','), subject, plainBody);
    }

    // C) Abre o e-mail do Síndico com todos os moradores em Cópia Oculta (BCC) para envio imediato
    if (openMailClientFallback && typeof window !== 'undefined') {
      const bccList = emails.join(',');
      const mailtoLink = `mailto:?bcc=${encodeURIComponent(bccList)}&subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(plainBody)}`;
      window.location.href = mailtoLink;
    }

    return { totalRecipients: emails.length };
  }

  // 4. Dispara Aviso do Mural por E-mail para todos os moradores aprovados
  async sendNoticeEmailToResidents(
    notice: { title: string; content: string; priority: string },
    openMailClientFallback = true
  ): Promise<{ totalRecipients: number }> {
    const emails = await this.getApprovedResidentEmails();
    if (emails.length === 0) {
      return { totalRecipients: 0 };
    }

    const appUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/avisos` : '';

    const prefix =
      notice.priority === 'urgente'
        ? '[URGENTE • Condomínio Moradas]'
        : '[Comunicado • Condomínio Moradas]';

    const subject = `${prefix} ${notice.title}`;
    const plainBody = [
      `Comunicado Oficial — Condomínio Moradas`,
      ``,
      `${notice.title.toUpperCase()}`,
      `${notice.content}`,
      ``,
      `Acesse a Central do Condomínio pelo link abaixo:`,
      `${appUrl}`
    ].join('\n');

    await addDoc(collection(this.db, 'mail'), {
      bcc: emails,
      createdAt: serverTimestamp(),
      type: 'condo_notice',
      message: {
        subject,
        text: plainBody,
        html: this.buildHtmlTemplate(
          notice.priority === 'urgente' ? 'Comunicado Urgente' : 'Mural de Avisos',
          notice.title,
          notice.content,
          'Abrir Central do Condomínio',
          appUrl
        )
      }
    });

    if (this.emailJsConfig.enabled) {
      await this.sendViaEmailJs(emails.join(','), subject, plainBody);
    }

    if (openMailClientFallback && typeof window !== 'undefined') {
      const mailtoLink = `mailto:?bcc=${encodeURIComponent(
        emails.join(',')
      )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
      window.location.href = mailtoLink;
    }

    return { totalRecipients: emails.length };
  }

  private async sendViaEmailJs(bcc: string, subject: string, message: string): Promise<void> {
    try {
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: this.emailJsConfig.serviceId,
          template_id: this.emailJsConfig.templateId,
          user_id: this.emailJsConfig.publicKey,
          template_params: { bcc_emails: bcc, subject, message }
        })
      });
    } catch {
      // Silencia erro externo para não interromper o fluxo principal
    }
  }

  private buildHtmlTemplate(
    badge: string,
    title: string,
    description: string,
    ctaLabel: string,
    ctaUrl: string
  ): string {
    return `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f4f7fb; padding: 24px; border-radius: 16px;">
        <div style="background: #ffffff; padding: 28px; border-radius: 14px; border-top: 5px solid #0056b3;">
          <span style="background: #dbeafe; color: #0056b3; padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 700;">
            ${badge} • Condomínio Moradas
          </span>
          <h2 style="color: #0f172a; margin: 16px 0 8px 0;">${title}</h2>
          <p style="color: #475569; line-height: 1.6; white-space: pre-line;">${description}</p>
          <a href="${ctaUrl}" style="display: inline-block; margin-top: 18px; background: #0056b3; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 700;">
            ${ctaLabel}
          </a>
        </div>
      </div>
    `;
  }

  async sendInvoiceEmail(
    inv: InvoiceItem,
    openMailClientFallback = false
  ): Promise<{ totalRecipients: number }> {
    const residents = await this.getApprovedResidentsByHouse(inv.houseNumber);
    const emails = Array.from(
      new Set(
        residents
          .map((r) => (r.email || '').trim().toLowerCase())
          .filter((e) => e.includes('@'))
      )
    );

    if (emails.length === 0) {
      return { totalRecipients: 0 };
    }

    const appUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/boletos` : '';
    const formattedValue = inv.amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    const formattedDue = inv.dueDate.split('-').reverse().join('/');

    const subject = `📄 [Condomínio Moradas] Boleto ${inv.referenceMonth} — Casa ${inv.houseNumber} (Venc: ${formattedDue})`;

    const plainBody = [
      `Olá, ${inv.recipientName}!`,
      `O boleto da mensalidade do Condomínio Moradas já está disponível para a Casa ${inv.houseNumber}.`,
      ``,
      `📅 REFERÊNCIA: ${inv.referenceMonth}`,
      `💰 VALOR: ${formattedValue}`,
      `⏰ VENCIMENTO: ${formattedDue}`,
      ``,
      `🔢 LINHA DIGITÁVEL (CÓDIGO DE BARRAS):`,
      `${inv.barcode}`,
      inv.pixCode ? `\n⚡ PIX COPIA E COLA:\n${inv.pixCode}` : null,
      inv.pdfUrl ? `\n📎 BAIXAR PDF DO BOLETO:\n${inv.pdfUrl}` : null,
      ``,
      `Você também pode copiar o código com 1 toque diretamente no aplicativo:`,
      `${appUrl}`,
      ``,
      `Administração — Condomínio Moradas`
    ]
      .filter(Boolean)
      .join('\n');

    const htmlBody = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #f4f7fb; padding: 24px; border-radius: 16px;">
        <div style="background: #ffffff; padding: 28px; border-radius: 14px; border-top: 5px solid #0056b3;">
          <span style="background: #dbeafe; color: #0056b3; padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 700;">
            Taxa Condominial • Casa ${inv.houseNumber}
          </span>
          <h2 style="color: #0f172a; margin: 14px 0 4px 0;">${inv.referenceMonth}</h2>
          <p style="color: #64748b; margin: 0 0 16px 0; font-size: 14px;">
            Vencimento: <strong>${formattedDue}</strong> • Valor: <strong style="color: #0f172a;">${formattedValue}</strong>
          </p>

          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
            <small style="display: block; color: #64748b; font-weight: 700; margin-bottom: 4px;">LINHA DIGITÁVEL:</small>
            <code style="font-size: 13px; color: #0f172a; word-break: break-all;">${inv.barcode}</code>
          </div>

          ${
            inv.pixCode
              ? `<div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
                  <small style="display: block; color: #15803d; font-weight: 700; margin-bottom: 4px;">PIX COPIA E COLA:</small>
                  <code style="font-size: 12px; color: #166534; word-break: break-all;">${inv.pixCode}</code>
                </div>`
              : ''
          }

          <a href="${inv.pdfUrl || appUrl}" style="display: inline-block; background: #0056b3; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 14px;">
            Abrir Boleto no Aplicativo
          </a>
        </div>
      </div>
    `;

    await addDoc(collection(this.db, 'mail'), {
      to: emails,
      createdAt: serverTimestamp(),
      type: 'condo_invoice',
      houseNumber: inv.houseNumber,
      invoiceId: inv.id,
      message: { subject, text: plainBody, html: htmlBody }
    });

    if (openMailClientFallback && typeof window !== 'undefined') {
      const mailtoLink = `mailto:${encodeURIComponent(
        emails.join(',')
      )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
      window.location.href = mailtoLink;
    }

    return { totalRecipients: emails.length };
  }

  async shareInvoiceOnWhatsApp(inv: InvoiceItem): Promise<void> {
    const residents = await this.getApprovedResidentsByHouse(inv.houseNumber);
    const residentWithPhone = residents.find((r) => r.phone && r.phone.trim().length >= 8);
    const cleanDigits = (residentWithPhone?.phone || '').replace(/\D/g, '');
    const formattedPhone =
      cleanDigits.length >= 10 && !cleanDigits.startsWith('55')
        ? `55${cleanDigits}`
        : cleanDigits;

    const formattedValue = inv.amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    const formattedDue = inv.dueDate.split('-').reverse().join('/');
    const appUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/boletos` : '';

    const text = [
      `📄 *BOLETO DO CONDOMÍNIO — Condomínio Moradas*`,
      ``,
      `Olá, *${inv.recipientName}* (Casa ${inv.houseNumber})!`,
      `Segue a mensalidade referente a *${inv.referenceMonth}*:`,
      ``,
      `💰 *Valor:* ${formattedValue}`,
      `📅 *Vencimento:* ${formattedDue}`,
      ``,
      `🔢 *Linha Digitável:*`,
      `${inv.barcode}`,
      inv.pixCode ? `\n⚡ *Pix Copia e Cola:*\n${inv.pixCode}` : null,
      inv.pdfUrl ? `\n📎 *PDF do Boleto:* ${inv.pdfUrl}` : null,
      ``,
      `📲 _Acesse também pelo aplicativo:_ ${appUrl}`
    ]
      .filter(Boolean)
      .join('\n');

    const whatsappUrl = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  // Dispara aviso de lote mensal por E-mail (Cópia Oculta para todas as unidades geradas)
  async sendBulkInvoiceBatchEmail(
    emails: string[],
    payload: {
      referenceMonth: string;
      amount: number;
      dueDate: string;
      pixCode: string;
      notes?: string;
    },
    openMailClientFallback = false
  ): Promise<void> {
    if (!emails || emails.length === 0) return;

    const appUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/boletos` : '';
    const formattedValue = Number(payload.amount).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    const formattedDue = payload.dueDate.split('-').reverse().join('/');

    const subject = `📄 [Condomínio Moradas] Mensalidade Disponível: ${payload.referenceMonth} (Venc: ${formattedDue})`;

    const plainBody = [
      `Olá, morador(a) do Condomínio Moradas!`,
      ``,
      `A taxa condominial referente a ${payload.referenceMonth} já foi gerada e está disponível no aplicativo para a sua unidade.`,
      ``,
      `💰 VALOR PADRÃO: ${formattedValue}`,
      `📅 VENCIMENTO: ${formattedDue}`,
      payload.notes ? `📌 OBSERVAÇÕES: ${payload.notes}` : null,
      payload.pixCode ? `\n⚡ PIX COPIA E COLA / CHAVE DO CONDOMÍNIO:\n${payload.pixCode}` : null,
      ``,
      `Acesse a aba "Boletos" no aplicativo para copiar o código de pagamento com 1 toque:`,
      `${appUrl}`,
      ``,
      `Administração — Condomínio Moradas`
    ]
      .filter(Boolean)
      .join('\n');

    await addDoc(collection(this.db, 'mail'), {
      bcc: emails,
      createdAt: serverTimestamp(),
      type: 'bulk_condo_invoice',
      referenceMonth: payload.referenceMonth,
      message: {
        subject,
        text: plainBody,
        html: this.buildHtmlTemplate(
          'Mensalidade Disponível',
          `Taxa Condominial — ${payload.referenceMonth}`,
          `Vencimento: ${formattedDue} • Valor: ${formattedValue}\n${payload.notes || ''}`,
          'Acessar Meus Boletos no App',
          appUrl
        )
      }
    });

    if (openMailClientFallback && typeof window !== 'undefined') {
      const mailtoLink = `mailto:?bcc=${encodeURIComponent(
        emails.join(',')
      )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
      window.location.href = mailtoLink;
    }
  }
}