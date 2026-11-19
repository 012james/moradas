import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const serviceAccount = JSON.parse(
  readFileSync(new URL('./serviceAccountKey.json', import.meta.url), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Helpers de data dinâmicos baseados no dia em que você rodar o script
const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

function formatDateOffset(daysOffset = 0) {
  const d = new Date(now + daysOffset * dayMs);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function seedDatabase() {
  console.log('🚀 Iniciando carga de dados de teste no Condomínio Moradas...\n');

  // =========================================================================
  // 1. CONFIGURAÇÕES GERAIS (Contatos da Portaria/Secretaria e Regimento)
  // =========================================================================
  await db.collection('condo_settings').doc('contacts').set({
    portariaPhone: '(34) 3821-4400',
    portariaWhatsapp: '5534999994400',
    secretariaPhone: '(34) 3821-4410',
    secretariaWhatsapp: '5534999994410',
    officeHours: 'Segunda a Sexta, das 08h00 às 17h30'
  });

  await db.collection('condo_settings').doc('rules').set({
    items: [
      'Velocidade máxima nas vias internas do condomínio: 20 km/h.',
      'Lei do Silêncio: das 22h00 às 07h00 (domingos e feriados até as 09h00).',
      'Obras e reformas permitidas apenas de seg. a sex. (08h às 17h) e sábados (08h às 12h).',
      'Cães devem circular nas áreas comuns sempre na guia e acompanhados por responsável.',
      'Visitantes e prestadores devem ser liberados previamente na aba Visitas do app.'
    ]
  });
  console.log('✔ Configurações (contatos e regras) criadas.');

  // =========================================================================
  // 2. MORADORES FICTÍCIOS (Para testar a tela de Aprovação do Síndico)
  // =========================================================================
  const sampleUsers = [
    {
      id: 'seed_morador_102',
      data: {
        uid: 'seed_morador_102',
        name: 'Carlos Eduardo Lima',
        nome: 'Carlos Eduardo Lima',
        email: 'carlos.lima102@teste.com',
        role: 'morador',
        status: 'pending',
        houseNumber: 102,
        street: 'Rua 2',
        rua: 'Rua 2',
        casaSolicitada: 'Rua 2 - 102',
        phone: '34991234567',
        createdAt: now - 3600 * 1000
      }
    },
    {
      id: 'seed_porteiro_turno1',
      data: {
        uid: 'seed_porteiro_turno1',
        name: 'Marcos Vinícius (Guarita)',
        nome: 'Marcos Vinícius (Guarita)',
        email: 'portaria.turno1@teste.com',
        role: 'morador',
        status: 'pending',
        houseNumber: 600,
        street: 'Alameda 1',
        rua: 'Alameda 1',
        casaSolicitada: 'Alameda 1 - 600',
        phone: '34998765432',
        createdAt: now - 7200 * 1000
      }
    },
    {
      id: 'seed_morador_402',
      data: {
        uid: 'seed_morador_402',
        name: 'Mariana Souza',
        nome: 'Mariana Souza',
        email: 'mariana.402@teste.com',
        role: 'morador',
        status: 'approved',
        houseNumber: 402,
        street: 'Alameda 3',
        rua: 'Alameda 3',
        casaSolicitada: 'Alameda 3 - 402',
        phone: '34992223344',
        createdAt: now - 10 * dayMs
      }
    }
  ];

  for (const u of sampleUsers) {
    await db.collection('users').doc(u.id).set(u.data);
  }
  console.log('✔ Usuários de teste (pendentes e aprovados) criados.');

  // =========================================================================
  // 3. ASSEMBLEIAS / ATAS (2 Abertas para votação + 1 Encerrada com histórico)
  // =========================================================================
  const ataAberta1 = await db.collection('assemblies').add({
    title: 'Instalação de Energia Solar nas Áreas Comuns',
    subtitle: 'Aprovação de orçamento para usina fotovoltaica da portaria e salão',
    description:
      'Pauta extraordinária para deliberar sobre a contratação da usina solar fotovoltaica destinada a zerar o custo de energia elétrica da portaria 24h, iluminação das vias e salão de festas, com retorno estimado em 26 meses.',
    location: 'Virtual (App)',
    minimumQuorum: 150,
    pdfUrl: '',
    status: 'open',
    expiresAt: Timestamp.fromDate(new Date(now + 5 * dayMs)),
    votesCount: 3,
    favorCount: 2,
    contraCount: 1,
    absterCount: 0,
    approvedCount: 2,
    rejectedCount: 1,
    abstainCount: 0,
    createdAt: now - 2 * dayMs,
    createdByName: 'Administração Moradas'
  });

  // Votos auditados na ata aberta 1 (Casa 529 ainda não votou para você testar!)
  await ataAberta1.collection('votes').doc('102').set({
    houseNumber: 102,
    choice: 'favor',
    voterUid: 'seed_morador_102',
    voterName: 'Carlos Eduardo Lima',
    votedAt: now - dayMs
  });
  await ataAberta1.collection('votes').doc('402').set({
    houseNumber: 402,
    choice: 'favor',
    voterUid: 'seed_morador_402',
    voterName: 'Mariana Souza',
    votedAt: now - 12 * 3600 * 1000
  });
  await ataAberta1.collection('votes').doc('215').set({
    houseNumber: 215,
    choice: 'contra',
    voterUid: 'seed_morador_215',
    voterName: 'Roberto Alves',
    votedAt: now - 6 * 3600 * 1000
  });

  await db.collection('assemblies').add({
    title: 'Novo Horário de Funcionamento dos Quiosques',
    subtitle: 'Extensão do uso das churrasqueiras aos domingos até as 21h',
    description:
      'Proposta para alterar o horário limite de utilização dos quiosques 1 e 2 aos domingos de 19h00 para 21h00, mantendo a regra de som ambiente após as 20h.',
    location: 'Virtual (App)',
    minimumQuorum: 100,
    pdfUrl: '',
    status: 'open',
    expiresAt: Timestamp.fromDate(new Date(now + 3 * dayMs)),
    votesCount: 1,
    favorCount: 1,
    contraCount: 0,
    absterCount: 0,
    approvedCount: 1,
    rejectedCount: 0,
    abstainCount: 0,
    createdAt: now - dayMs,
    createdByName: 'Administração Moradas'
  });

  await db.collection('assemblies').add({
    title: 'Reforma e Pintura da Guarita Principal',
    subtitle: 'Prestação de contas e aprovação do cronograma de obras',
    description:
      'Deliberação encerrada referente à revitalização da fachada da portaria, troca das cancelas eletrônicas e instalação de novas câmeras LPR.',
    location: 'Salão de Festas (Híbrida)',
    minimumQuorum: 150,
    pdfUrl: '',
    status: 'closed',
    outcome: 'aprovada',
    expiresAt: Timestamp.fromDate(new Date(now - 4 * dayMs)),
    votesCount: 184,
    favorCount: 162,
    contraCount: 14,
    absterCount: 8,
    approvedCount: 162,
    rejectedCount: 14,
    abstainCount: 8,
    createdAt: now - 12 * dayMs,
    createdByName: 'Administração Moradas'
  });
  console.log('✔ Assembleias (abertas e encerrada) e votos criados.');

  // =========================================================================
  // 4. ENCOMENDAS / PACOTES DA PORTARIA (Com PIN de 4 dígitos)
  // =========================================================================
  const packages = [
    {
      houseNumber: 529,
      recipientName: 'Jamesson',
      carrier: 'Mercado Livre',
      description: 'Pacote Médio - Mercado Livre Full',
      pin: '4829',
      status: 'aguardando',
      createdAt: now - 2 * 3600 * 1000,
      arrivedAt: now - 2 * 3600 * 1000,
      registeredBy: 'Porteiro João'
    },
    {
      houseNumber: 529,
      recipientName: 'Jamesson',
      carrier: 'Amazon',
      description: 'Caixa Pequena - Amazon Prime',
      pin: '7391',
      status: 'aguardando',
      createdAt: now - 5 * 3600 * 1000,
      arrivedAt: now - 5 * 3600 * 1000,
      registeredBy: 'Porteiro João'
    },
    {
      houseNumber: 529,
      recipientName: 'Jamesson',
      carrier: 'Shopee',
      description: 'Envelope Plástico - Shopee',
      pin: '1904',
      status: 'entregue',
      createdAt: now - 3 * dayMs,
      arrivedAt: now - 3 * dayMs,
      deliveredAt: now - 2 * dayMs,
      deliveredTo: 'Jamesson',
      registeredBy: 'Porteiro Marcos'
    },
    {
      houseNumber: 402,
      recipientName: 'Mariana Souza',
      carrier: 'Correios (SEDEX)',
      description: 'Caixa Grande - Correios',
      pin: '6510',
      status: 'aguardando',
      createdAt: now - 3600 * 1000,
      arrivedAt: now - 3600 * 1000,
      registeredBy: 'Porteiro João'
    }
  ];

  for (const pkg of packages) {
    await db.collection('packages').add(pkg);
  }
  console.log('✔ Encomendas criadas (2 aguardando retirada na Casa 529).');

  // =========================================================================
  // 5. VISITANTES E ACESSOS DA GUARITA (Liberados Hoje + Lista Permanente)
  // =========================================================================
  const todayStr = formatDateOffset(0);
  const visitors = [
    {
      houseNumber: 529,
      visitorName: 'Lucas Andrade (Técnico Fibra)',
      visitorDoc: '12.345.678-9',
      vehiclePlate: 'RTA-4E19',
      category: 'Prestador de Serviço',
      accessType: 'unico',
      validDate: todayStr,
      notes: 'Manutenção internet fibra óptica',
      active: true,
      authorizedByUid: 'seed_529',
      authorizedByName: 'Jamesson',
      createdAt: now - 1800 * 1000,
      entryCount: 0
    },
    {
      houseNumber: 529,
      visitorName: 'Dona Helena (Familiar)',
      visitorDoc: '',
      vehiclePlate: 'GHY-8B22',
      category: 'Convidado / Familiar',
      accessType: 'permanente',
      validDate: '',
      notes: 'Acesso livre qualquer horário',
      active: true,
      authorizedByUid: 'seed_529',
      authorizedByName: 'Jamesson',
      createdAt: now - 15 * dayMs,
      entryCount: 6,
      lastEntryAt: now - 2 * dayMs,
      lastCheckedInBy: 'Porteiro João'
    },
    {
      houseNumber: 402,
      visitorName: 'João Mendes',
      visitorDoc: '',
      vehiclePlate: 'ABC-1D23',
      category: 'Convidado / Familiar',
      accessType: 'unico',
      validDate: todayStr,
      notes: 'Visita social',
      active: true,
      authorizedByUid: 'seed_morador_402',
      authorizedByName: 'Mariana Souza',
      createdAt: now - 3600 * 1000,
      entryCount: 0
    },
    {
      houseNumber: 118,
      visitorName: 'Ana Paula Ferreira',
      visitorDoc: '44.987.321-0',
      vehiclePlate: '',
      category: 'Diarista / Fixo',
      accessType: 'permanente',
      validDate: '',
      notes: 'Segundas, Quartas e Sextas',
      active: true,
      authorizedByUid: 'seed_118',
      authorizedByName: 'Fernanda Costa',
      createdAt: now - 30 * dayMs,
      entryCount: 18
    }
  ];

  for (const vis of visitors) {
    await db.collection('visitors').add(vis);
  }
  console.log('✔ Visitantes do dia e lista permanente criados.');

  // =========================================================================
  // 6. RESERVAS DO SALÃO DE FESTAS E QUIOSQUES
  // =========================================================================
  const nextSaturday = formatDateOffset(4);
  const nextWeek = formatDateOffset(10);

  await db.collection('reservations').doc(`quiosque_1_${nextSaturday}`).set({
    spaceId: 'quiosque_1',
    spaceName: 'Quiosque Churrasqueira 01',
    date: nextSaturday,
    houseNumber: 529,
    residentName: 'Jamesson',
    acceptedRules: true,
    feeAmount: 80,
    status: 'confirmada',
    createdAt: now - dayMs
  });

  await db.collection('reservations').doc(`salao_festas_${nextWeek}`).set({
    spaceId: 'salao_festas',
    spaceName: 'Salão de Festas Principal',
    date: nextWeek,
    houseNumber: 402,
    residentName: 'Mariana Souza',
    acceptedRules: true,
    feeAmount: 250,
    status: 'confirmada',
    createdAt: now - 2 * dayMs
  });
  console.log('✔ Reservas de espaços comuns criadas.');

  // =========================================================================
  // 7. BOLETOS / MENSALIDADES (Aberto com taxa extra + Pago anterior)
  // =========================================================================
  await db.collection('invoices').add({
    houseNumber: 529,
    recipientName: 'Jamesson',
    referenceMonth: '11/2026',
    baseAmount: 420.0,
    extraCharges: [
      {
        reservationId: `quiosque_1_${nextSaturday}`,
        description: `Reserva Quiosque Churrasqueira 01 (${nextSaturday})`,
        amount: 80.0
      }
    ],
    amount: 500.0,
    dueDate: formatDateOffset(8),
    barcode: '34191.79001 01043.510047 91020.150008 8 99120000050000',
    pixCode: '00020126580014BR.GOV.BCB.PIX0136condominio-moradas-pix-5295204000053039865406500.005802BR5918CONDOMINIO MORADAS6014PATOS DE MINAS62070503***6304A1B2',
    status: 'aberto',
    notes: 'Taxa condominial + reserva Quiosque 01',
    createdAt: now - dayMs,
    createdByName: 'Administração Moradas'
  });

  await db.collection('invoices').add({
    houseNumber: 529,
    recipientName: 'Jamesson',
    referenceMonth: '10/2026',
    baseAmount: 420.0,
    extraCharges: [],
    amount: 420.0,
    dueDate: formatDateOffset(-22),
    barcode: '34191.79001 01043.510047 91020.150008 4 98820000042000',
    status: 'pago',
    paidAt: now - 23 * dayMs,
    createdAt: now - 35 * dayMs,
    createdByName: 'Administração Moradas'
  });
  console.log('✔ Boletos da Casa 529 criados.');

  // =========================================================================
  // 8. MURAL DE AVISOS E COMUNICADOS
  // =========================================================================
  const notices = [
    {
      title: 'Limpeza Programada dos Reservatórios de Água',
      category: 'Manutenção',
      body: 'Informamos que nesta sexta-feira, das 08h00 às 13h00, será realizada a higienização semestral das caixas d’água centrais. Recomendamos economia durante o período.',
      authorName: 'Administração Moradas',
      createdAt: now - 3 * 3600 * 1000
    },
    {
      title: 'Atualização no Controle de Visitantes pelo App',
      category: 'Comunicado Geral',
      body: 'Moradores já podem cadastrar convidados do dia e prestadores fixos diretamente na aba Visitas. Ao chegar na portaria, basta o visitante informar o nome e o número da casa.',
      authorName: 'Administração Moradas',
      createdAt: now - dayMs
    },
    {
      title: 'Manutenção no Portão Social da Alameda 2',
      category: 'Urgente',
      body: 'A equipe técnica está realizando a troca da fechadura eletromagnética do acesso de pedestres da Alameda 2. Utilize temporariamente o acesso principal da guarita.',
      authorName: 'Portaria 24h',
      createdAt: now - 30 * 60 * 1000
    }
  ];

  for (const notice of notices) {
    await db.collection('notices').add(notice);
  }
  console.log('✔ Avisos e comunicados publicados.');

  console.log('\n✅ Banco populado com sucesso! Recarregue o app no navegador.');
  process.exit(0);
}

seedDatabase().catch((err) => {
  console.error('❌ Erro ao popular o Firestore:', err);
  process.exit(1);
});