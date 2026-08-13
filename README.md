# Finanças — controle financeiro pessoal/familiar

Sistema web para substituir a planilha do Google Sheets/Excel de controle de
gastos. Uso estritamente pessoal (você, sogra, esposa, cunhada), sem
autenticação multiusuário — as "pessoas" são só uma categoria de quem gastou.

## Stack

- **Backend**: Node.js + Express + Prisma ORM + SQLite (padrão local, sem
  precisar instalar nada além do Node). Dá pra trocar pra Postgres depois
  (ver seção própria abaixo).
- **Frontend**: React + Vite + Tailwind CSS + Recharts, responsivo e
  pensado pra uso rápido no celular (bottom nav, formulário de lançamento
  como tela inicial).

## Estrutura do projeto

```
finanças/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # modelagem do banco
│   │   ├── seed.js            # pessoas/categorias/cartões padrão
│   │   └── migrations/
│   ├── scripts/
│   │   └── import-xlsx.js     # importador da planilha antiga
│   └── src/
│       ├── app.js             # Express app + rotas
│       ├── server.js          # entrypoint
│       ├── db.js              # cliente Prisma
│       ├── constants.js
│       ├── routes/            # people, categories, payment-methods,
│       │                        expenses, incomes, recurring, summary
│       └── utils/             # datas/faturas, agregações, parcelamento,
│                                 recorrência, CRUD genérico
└── frontend/
    └── src/
        ├── api/client.js      # cliente HTTP da API
        ├── context/           # dados compartilhados (pessoas/categorias/
        │                        cartões) + toast de notificação
        ├── components/        # peças de UI reutilizáveis
        ├── pages/             # Lançar, Painel, Gastos, Histórico, Mais
        └── lib/                # formatação, paleta de cores, constantes
```

## Como rodar localmente

Pré-requisito: Node.js 18+ instalado.

### 1. Backend

```bash
cd backend
npm install
copy .env.example .env        # (no Windows; no Mac/Linux: cp .env.example .env)
npm run prisma:migrate        # cria o banco SQLite (dev.db) e as tabelas
npm run seed                  # cadastra as 4 pessoas, categorias e cartões padrão
npm run dev                   # sobe a API em http://localhost:3001
```

### 2. Importar o histórico da planilha (opcional, uma vez)

Com o backend já migrado e "seedado" (passo acima), rode a partir da pasta
`backend`:

```bash
npm run import:xlsx -- "C:\caminho\para\R$ FINANÇAS.xlsx"
```

Se omitir o caminho, o script tenta achar `R$ FINANÇAS.xlsx` na pasta
`Downloads` (um nível acima da pasta do projeto). Para reimportar do zero
(apaga todos os gastos antes de reimportar):

```bash
npm run import:xlsx -- --force
```

**Importante sobre a importação**: a planilha antiga nem sempre tem pessoa
ou cartão específicos por lançamento (só valores totais por cartão numa
seção separada). Pra não inventar dado que a planilha não tem, o
importador marca esses casos com:
- pessoa **"Histórico (a revisar)"** quando a aba não separava por pessoa
  (abas de 2023 a meados de 2025);
- cartão **"A revisar (importado)"** quando não deu pra identificar o
  método de pagamento pelo texto da descrição;
- observação **"data aproximada"** quando só se sabia o mês, não o dia
  exato.

No final o script imprime quantos lançamentos caem em cada caso. Vale a
pena revisar esses lançamentos pela tela de **Gastos** (filtrando por
pessoa "Histórico (a revisar)" ou cartão "A revisar (importado)") e
corrigir manualmente — o histórico fica menos preciso, mas nada é
perdido.

### 3. Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev                   # abre em http://localhost:5173
```

O Vite já está configurado pra redirecionar `/api` pro backend
(`http://localhost:3001`), então basta abrir `http://localhost:5173` no
navegador (ou no celular, pela rede local — o terminal do Vite mostra um
endereço tipo `http://192.168.x.x:5173`, desde que celular e computador
estejam na mesma rede Wi-Fi).

## Trocar SQLite por Postgres (opcional)

1. Em `backend/prisma/schema.prisma`, troque `provider = "sqlite"` por
   `provider = "postgresql"`.
2. Em `backend/.env`, aponte `DATABASE_URL` pro seu Postgres, ex:
   `postgresql://usuario:senha@localhost:5432/financas?schema=public`.
3. Rode `npm run prisma:migrate` de novo pra recriar as tabelas nesse banco
   (e `npm run seed` / `npm run import:xlsx` se quiser repopular os dados).

## Lógica de fatura/vencimento de cartão

Todos os cartões têm um **dia de vencimento** cadastrável (padrão: dia 10
para os seus cartões; dia 2 para o cartão do seu tio). Como a planilha não
tinha o dia de fechamento de cada fatura, o sistema assume que a fatura
fecha no próprio dia do vencimento: uma compra feita até o dia do
vencimento (inclusive) entra na fatura deste mês; depois disso, entra na
fatura do mês seguinte. Isso é usado tanto pra:
- calcular o **próximo vencimento** de cada cartão (painel mensal), e
- somar quanto já está **lançado na fatura em aberto** de cada cartão.

Se algum cartão tiver um fechamento bem diferente do vencimento, dá pra
ajustar a lógica depois — por ora ela cobre bem o caso descrito (a maioria
vence dia 10, exceção do cartão do tio no dia 2).

O **Painel mensal** também navega por esse período de fatura (dia 11 de
um mês até dia 10 do seguinte), em vez de mês civil — assim os totais de
gasto/receita/saldo do painel refletem o ciclo real de pagamento, não o
calendário. As outras telas (Gastos, Histórico, Receitas) continuam
usando mês civil, com filtro de período customizado disponível quando
precisar de outro recorte.

Todo gasto tem um campo opcional **"Fatura prevista para"**: quando a
cobrança de uma compra vai cair num período bem diferente da data em que
ela foi feita (ex: comprou hoje mas a fatura só vem em dezembro), esse
campo sobrepõe a data da compra só pra fins de cálculo de período/fatura
— a data original continua registrada como "data da compra" pro
histórico. Fica em branco por padrão (usa a data da compra normalmente).

Ao navegar pra um período **futuro**, o saldo vira uma **simulação**: soma
o saldo (ou dívida) acumulado de cada período entre hoje e o período
visto — considerando despesas fixas e parcelas já lançadas nesse
meio-tempo — com a receita/gastos previstos do próprio período. Gastos
avulsos que você ainda não lançou não entram na conta, claro.

## Cobranças: quem deve quanto em cada fatura

No Painel, a seção "Vencimento dos cartões" tem um seletor de pessoa no
topo (começa em você). Tocando num cartão, a lista expande e mostra as
compras **individuais** daquela pessoa na fatura em aberto — cada uma com
uma caixinha de marcar. Marcar uma compra como quitada é por item, não
por fatura inteira: ela fica riscada e some do valor pendente daquela
pessoa naquele cartão; o total pendente (somando todo mundo) aparece
destacado no topo da seção. Serve tanto pra "fulano me pagou essa compra"
quanto pro caso inverso do cartão do seu tio (aí a caixinha marca que
**você** já pagou aquela compra pra ele).

## Funcionalidades

- **Lançar** (tela inicial): formulário rápido de gasto, com opção de
  parcelamento (lança automaticamente as parcelas futuras, mês a mês) ou
  gasto fixo/recorrente (cria um "molde" que gera o lançamento todo mês
  automaticamente).
- **Painel**: totais do mês por pessoa/cartão/categoria, saldo
  (receitas − gastos, incluindo saldo do mês anterior como um tipo de
  receita), parcelas em aberto, gastos fixos do mês e vencimento dos
  cartões.
- **Gastos**: lista com filtros (mês ou período customizado, pessoa,
  cartão, categoria, busca por texto), edição e exclusão. Excluir uma
  parcela pergunta se é só aquela ou ela + as futuras do mesmo
  parcelamento.
- **Histórico**: evolução de gastos x receitas mês a mês, e gasto por
  categoria (top 6) ao longo do tempo.
- **Mais**: receitas avulsas (salário, VA/VR, saldo anterior, rendimento de
  poupança, outras), **receitas fixas** (ex: salário todo dia 1, Flash todo
  último dia útil do mês — geradas automaticamente todo mês, igual os
  gastos fixos), gastos fixos/recorrentes, e cadastro de
  pessoas/categorias/cartões (todos editáveis — nada é fixo no código).

## Observações técnicas

- O pacote `xlsx` (usado só no script de importação, que roda localmente
  sobre o seu próprio arquivo) tem vulnerabilidades conhecidas sem
  correção disponível — como ele nunca roda no servidor nem processa
  arquivo de terceiros, o risco é baixo, mas vale saber.
- Todas as exclusões de pessoa/categoria/cartão são "soft delete"
  (marcadas como inativas) pra não quebrar o histórico de gastos já
  lançados — elas somem dos formulários de novos lançamentos mas
  continuam aparecendo nos gastos antigos.
