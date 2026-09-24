# Test Harness & Ambiente: Condomínio Moradas

## 1. Configuração e Execução do Ambiente Local
Este projeto utiliza Angular 17+ e Firebase. Para rodar e testar localmente:

### Comandos Básicos
- Instalar dependências: `npm install`
- Rodar servidor de desenvolvimento: `ng serve` (disponível em `http://localhost:4200`)
- Limpar cache de compilação (em caso de travamento do esbuild): `ng serve --disable-host-check --poll=2000`

## 2. Cenários de Validação (Testes Funcionais)

Abaixo estão os cenários exatos que devem ser validados (manualmente ou via E2E) após qualquer alteração no fluxo de Atas ou Usuários:

### Cenário A: Trava de Votação para Usuário Pendente
1. Faça login na aplicação com uma nova conta Google.
2. Navegue até a URL de uma ata aberta (`/atas/:id`).
3. **Resultado Esperado:** Os botões "A Favor / Contra / Abster" NÃO devem ser renderizados. A interface deve exibir a div `.pending-notice` informando que o perfil aguarda aprovação.

### Cenário B: Fluxo de Aprovação do Síndico
1. Faça login com a conta de administrador (role: `sindico`).
2. Acesse `/admin/aprovacoes`.
3. Localize o usuário recém-criado na lista de pendentes e clique em "Aprovar".
4. **Resultado Esperado:** O usuário deve sumir da lista de pendentes e o documento dele no Firestore deve ser atualizado para `status: 'approved'`.

### Cenário C: Votação e Unicidade
1. Faça login com a conta do morador recém-aprovado no Cenário B.
2. Acesse `/atas/:id` e clique em "A Favor".
3. **Resultado Esperado:** O voto deve ser computado. O painel `.vote-scoreboard` deve atualizar instantaneamente (+1 A Favor).
4. Clique em "Contra" na mesma ata.
5. **Resultado Esperado:** O total de votos NÃO deve aumentar. O voto "A Favor" deve ser substituído pelo "Contra" no placar (sobrescrita por ID do usuário).

### Cenário D: Auto-Encerramento de Ata (Trigger de Leitura)
1. No Firestore Console, altere a `date` de uma ata para o dia anterior ("YYYY-MM-DD").
2. Recarregue a página inicial ou a lista de atas na aplicação.
3. **Resultado Esperado:** A ata deve sumir da lista de "Atas Abertas", e o documento no Firestore deve ser atualizado automaticamente para `status: 'closed'` com o `outcome` calculado.

## 3. Testes Automatizados (Angular)
- Rodar suíte de testes unitários: `ng test`
- Os testes dos serviços (ex: `atas.service.spec.ts`) devem usar o `Firebase Emulator` ou mocks do RxJS para não sujar o banco de produção durante a validação CI/CD.