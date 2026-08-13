/**
 * Importa o histórico da planilha "R$ FINANÇAS.xlsx" pro banco novo.
 *
 * A planilha tem dois formatos de aba:
 *  - Abas antigas (ex: "2023", "20241", "20242", "20251"): uma coluna
 *    DESPESAS/VALOR por mês, sem separação por pessoa.
 *  - Abas novas (ex: "MAIOJUNHO DE 2026"): um bloco DESPESAS/VALOR por
 *    pessoa (GASTOS FERNANDO / SOGRINHA / AMOR / CUNHADA), mais um bloco
 *    "TODOS OS CARTÕES" com totais agregados por fatura (não é importado
 *    como gasto individual, é só um resumo que já recalculamos a partir
 *    dos gastos).
 *
 * Como nem sempre dá pra saber com 100% de certeza a pessoa (abas antigas)
 * ou o cartão usado (nenhuma aba antiga ou nova traz o cartão por linha,
 * só o valor total por cartão em um bloco separado), o import usa:
 *   - pessoa "Histórico (a revisar)" pras abas antigas sem pessoa definida
 *   - cartão "A revisar (importado)" quando não dá pra identificar o
 *     método de pagamento pelo texto da descrição
 * e imprime um resumo no final com o que precisa de revisão manual.
 *
 * Uso:
 *   node scripts/import-xlsx.js ["caminho/para/planilha.xlsx"] [--force]
 *
 * --force apaga todos os gastos já existentes no banco antes de importar
 * (útil para reimportar do zero durante os testes). Sem --force, o script
 * recusa rodar se já houver gastos no banco.
 */

const path = require('path');
const XLSX = require('xlsx');
const prisma = require('../src/db');

const DEFAULT_XLSX_PATH = path.resolve(__dirname, '../../../R$ FINANÇAS.xlsx');

// Sempre comparado em versão sem acento (ver stripAccents), já que os
// rótulos das abas passam pelo mesmo tratamento antes de comparar (ex:
// "MARÇO" -> "MARCO").
const MONTHS_PT = [
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

const PERSON_BLOCK_MAP = {
  FERNANDO: 'Fernando',
  SOGRINHA: 'Sogra',
  AMOR: 'Esposa',
  CUNHADA: 'Cunhada',
};

const REVIEW_PERSON_NAME = 'Histórico (a revisar)';
// Nome definitivo (não é "pendente de revisão" — o usuário confirmou que
// não dá pra recuperar qual cartão foi usado nesses lançamentos antigos).
const REVIEW_CARD_NAME = 'Não especificado';

const CATEGORY_KEYWORDS = [
  ['Moradia', ['aluguel', 'condominio', 'taxa condominio', 'energia', 'luz', 'internet', 'agua', 'gas de', 'iptu']],
  ['Alimentação', ['feira', 'mercado', 'mercadinho', 'supermercado', 'restaurante', 'lanche', 'acai', 'pizza', 'padaria', 'almoco', 'janta', 'sorvete', 'hortifruti', 'quitanda', 'atacarejo', 'ifood', 'kfc', 'habibs', 'mc do', 'mcdonald', 'churrasco', 'agua fria', 'milk moo']],
  ['Transporte', ['uber', '99 ', 'gasolina', 'combustivel', 'autoescola', 'passagem', 'onibus', 'estacionamento']],
  ['Saúde', ['farmacia', 'remedio', 'consulta', 'dentista', 'psicologa', 'plano dentista', 'oculos', 'lentes', 'loratadina', 'hospital', 'exame']],
  ['Assinatura', ['netflix', 'youtube', 'google one', 'spotify', 'ifood club', 'amazon prime', 'hbo', 'disney']],
  ['Pet', ['racao', 'petshop', 'pet shop', 'veterinari']],
  ['Presente', ['presente', 'aniversario', 'aniv ', 'aniv(', 'dia das maes', 'dia das mulheres', 'pascoa', 'dia dos pais']],
  ['Vestuário', ['camisa', 'calca', 'tenis', 'sapato', 'havaianas', 'studio z', 'roupa', 'boutique', 'centauro', 'blusa', 'bermuda']],
  ['Beleza e Cuidados Pessoais', ['cabelo', 'boticario', 'perfume', 'salao', 'barbearia', 'manicure', 'unha', 'wepink', 'produto pro cabelo']],
  ['Lazer e Entretenimento', ['cinema', 'ingresso', 'jogo', 'show', 'viagem', 'hotel', 'passeio', 'parque']],
  ['Educação', ['curso', 'faculdade', 'escola', 'mensalidade', 'material escolar']],
  ['Empréstimo e Ajuda', ['emprestimo', 'ajuda a', 'ajuda pra', 'ajuda financeira']],
  ['Eletrônicos e Casa', ['notebook', 'celular', 'cama ', 'cadeira', 'sofa', 'geladeira', 'eletro', 'movel', 'moveis', 'colchao', 'liquidificador', 'fritadeira']],
];

const CARD_MENTION_PATTERNS = [
  [/fatura d[ao]s?\s+bradesco/i, 'Cartão Bradesco'],
  [/cart[aã]o\s+(de\s+cr[eé]dito\s+)?bradesco/i, 'Cartão Bradesco'],
  [/fatura d[ao]s?\s+riachuelo/i, 'Cartão Riachuelo'],
  [/cart[aã]o\s+(de\s+cr[eé]dito\s+)?riachuelo/i, 'Cartão Riachuelo'],
  [/fatura d[ao]s?\s+(le\s?biscuit)/i, 'Cartão Le Biscuit'],
  [/cart[aã]o\s+(de\s+cr[eé]dito\s+)?(le\s?biscuit)/i, 'Cartão Le Biscuit'],
  [/fatura d[ao]s?\s+americanas/i, 'Cartão Americanas'],
  [/cart[aã]o\s+(de\s+cr[eé]dito\s+)?americanas/i, 'Cartão Americanas'],
  [/fatura d[ao]s?\s+nubank/i, 'Cartão Nubank'],
  [/cart[aã]o\s+(de\s+cr[eé]dito\s+)?nubank/i, 'Cartão Nubank'],
  [/cart[aã]o\s+(de\s+cr[eé]dito\s+)?(c\s?&\s?a|cea)\b/i, 'Cartão C&A'],
  [/\bpix\b/i, 'Pix'],
];

function stripAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalize(str) {
  return stripAccents(String(str || '')).toLowerCase().trim();
}

function parseAmount(raw) {
  if (typeof raw === 'number') return raw;
  let str = String(raw || '').replace('R$', '').trim();
  if (!str) return NaN;
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  return parseFloat(str);
}

function guessCategory(descNorm) {
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (descNorm.includes(stripAccents(kw))) return category;
    }
  }
  return 'Outros';
}

function guessCard(descRaw) {
  for (const [pattern, cardName] of CARD_MENTION_PATTERNS) {
    if (pattern.test(descRaw)) return cardName;
  }
  return null;
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// Extrai, da descrição, data explícita e/ou informação de parcela,
// devolvendo a descrição já limpa dessas marcações.
function extractMeta(descRaw, fallback) {
  let desc = descRaw.trim();
  let explicitDate = null;

  // "(dd/mm)" ou "(dd/mm/aaaa)"
  let m = desc.match(/\((\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\)/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = m[3] ? Number(m[3]) : fallback.year;
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      explicitDate = { day, month, year };
      desc = desc.replace(m[0], '').trim();
    }
  }

  // "(dd)" no final = dia do mês (mês já conhecido pelo bloco/aba)
  if (!explicitDate) {
    m = desc.match(/\((\d{1,2})\)\s*$/);
    if (m) {
      const day = Number(m[1]);
      if (day >= 1 && day <= 31) {
        explicitDate = { day, month: fallback.month, year: fallback.year };
        desc = desc.replace(m[0], '').trim();
      }
    }
  }

  // "dia dd/mm"
  if (!explicitDate) {
    m = desc.match(/\bdia\s+(\d{1,2})\/(\d{1,2})\b/i);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      if (day <= 31 && month <= 12) {
        explicitDate = { day, month, year: fallback.year };
      }
    }
  }

  // "n/m" no final: parcela (n<=m<=60) ou data dd/mm caso contrário
  let installmentNumber = null;
  let installmentTotal = null;
  m = desc.match(/(\d{1,2})\/(\d{1,2})\s*$/);
  if (m) {
    const n = Number(m[1]);
    const t = Number(m[2]);
    if (n >= 1 && n <= t && t <= 60 && t >= 2) {
      installmentNumber = n;
      installmentTotal = t;
      desc = desc.slice(0, m.index).trim();
    } else if (!explicitDate && n <= 31 && t <= 12 && t >= 1) {
      explicitDate = { day: n, month: t, year: fallback.year };
      desc = desc.slice(0, m.index).trim();
    }
  }

  desc = desc.replace(/\s{2,}/g, ' ').trim();

  const day = explicitDate ? Math.min(explicitDate.day, daysInMonth(explicitDate.year, explicitDate.month - 1)) : fallback.day;
  const month = explicitDate ? explicitDate.month : fallback.month;
  const year = explicitDate ? explicitDate.year : fallback.year;
  const date = new Date(Date.UTC(year, month - 1, day));

  return {
    description: desc || descRaw.trim(),
    date,
    dateWasGuessed: !explicitDate,
    installmentNumber,
    installmentTotal,
  };
}

function findMonthSplit(token) {
  for (const first of MONTHS_PT) {
    if (token.startsWith(first)) {
      const rest = token.slice(first.length);
      if (MONTHS_PT.includes(rest)) return [first, rest];
    }
  }
  return null;
}

function parseSheetName(sheetName) {
  const upper = stripAccents(sheetName).toUpperCase();

  const yearMatch = upper.match(/(\d{4})/);
  if (upper.includes(' DE ') || /[A-Z]DE\d{4}/.test(upper.replace(/\s/g, ''))) {
    const token = upper.split(/\s+DE\s+/)[0].trim();
    const split = findMonthSplit(token);
    if (split && yearMatch) {
      const year = Number(yearMatch[1]);
      const firstMonthIndex = MONTHS_PT.indexOf(split[0]);
      return {
        kind: 'new',
        year,
        fallback: { day: 1, month: firstMonthIndex + 1, year },
      };
    }
  }

  // Abas antigas: nome é só o ano ("2023") ou ano+semestre ("20241").
  if (/^\d{4}$/.test(sheetName)) {
    return { kind: 'old', year: Number(sheetName) };
  }
  if (/^\d{5}$/.test(sheetName)) {
    const year = Number(sheetName.slice(0, 4));
    const half = Number(sheetName.slice(4));
    return { kind: 'old', year, half };
  }
  return null;
}

async function ensureEntity(model, name, extraData = {}) {
  const existing = await prisma[model].findFirst({ where: { name } });
  if (existing) return existing;
  const count = await prisma[model].count();
  return prisma[model].create({ data: { name, sortOrder: count, ...extraData } });
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const sheetArg = args.find((a) => a.startsWith('--sheet='));
  const onlySheets = sheetArg
    ? sheetArg
        .slice('--sheet='.length)
        .split(',')
        .map((s) => s.trim())
    : null;
  const filePathArg = args.find((a) => !a.startsWith('--'));
  const filePath = filePathArg ? path.resolve(filePathArg) : DEFAULT_XLSX_PATH;

  console.log(`Lendo planilha: ${filePath}`);
  if (onlySheets) console.log(`Importando só a(s) aba(s): ${onlySheets.join(', ')}`);
  const workbook = XLSX.readFile(filePath);

  const existingCount = await prisma.expense.count();
  if (existingCount > 0 && !force) {
    console.error(
      `Já existem ${existingCount} gastos no banco. Rode novamente com --force pra apagar e reimportar, ou zere o banco antes.`,
    );
    process.exit(1);
  }
  if (force && existingCount > 0) {
    console.log(`Apagando ${existingCount} gastos existentes (--force)...`);
    await prisma.expense.deleteMany({});
  }

  const people = await prisma.person.findMany();
  const peopleByName = new Map(people.map((p) => [p.name, p]));
  const reviewPerson = peopleByName.get(REVIEW_PERSON_NAME) || (await ensureEntity('person', REVIEW_PERSON_NAME));
  peopleByName.set(REVIEW_PERSON_NAME, reviewPerson);

  const categories = await prisma.category.findMany();
  const categoriesByName = new Map(categories.map((c) => [c.name, c]));

  const paymentMethods = await prisma.paymentMethod.findMany();
  const cardsByName = new Map(paymentMethods.map((c) => [c.name, c]));
  const reviewCard =
    cardsByName.get(REVIEW_CARD_NAME) ||
    (await ensureEntity('paymentMethod', REVIEW_CARD_NAME, { type: 'OTHER' }));
  cardsByName.set(REVIEW_CARD_NAME, reviewCard);

  const stats = {
    imported: 0,
    reviewPerson: 0,
    reviewCard: 0,
    guessedDate: 0,
    installments: 0,
    skippedSheets: [],
    bySheet: {},
  };

  // groupId por combinação de descrição normalizada + pessoa + total de
  // parcelas, pra ligar parcelas da mesma compra espalhadas em abas/meses
  // diferentes.
  const installmentGroupIds = new Map();

  for (const sheetName of workbook.SheetNames) {
    if (onlySheets && !onlySheets.includes(sheetName)) continue;
    const meta = parseSheetName(sheetName);
    if (!meta) {
      stats.skippedSheets.push(sheetName);
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    if (rows.length < 3) continue;

    const headerRow = rows[0];
    const rowsToCreate = [];

    for (let col = 0; col < headerRow.length; col += 1) {
      const label = String(headerRow[col] || '').trim();
      if (!label) continue;
      const labelUpper = stripAccents(label).toUpperCase();

      let personName = null;
      let fallback;

      if (meta.kind === 'new') {
        if (labelUpper.includes('TODOS OS CART')) continue; // bloco resumo, não é gasto individual
        const key = Object.keys(PERSON_BLOCK_MAP).find((k) => labelUpper.includes(k));
        if (!key) continue;
        personName = PERSON_BLOCK_MAP[key];
        fallback = meta.fallback;
      } else {
        const monthIndex = MONTHS_PT.indexOf(labelUpper);
        if (monthIndex === -1) continue;
        personName = REVIEW_PERSON_NAME;
        fallback = { day: 1, month: monthIndex + 1, year: meta.year };
      }

      const person = peopleByName.get(personName);
      if (!person) continue;

      for (let r = 3; r < rows.length; r += 1) {
        const descRaw = String(rows[r][col] || '').trim();
        const valRaw = rows[r][col + 1];
        if (!descRaw && (valRaw === '' || valRaw === undefined)) break;
        if (!descRaw) continue;
        if (stripAccents(descRaw).toUpperCase() === 'TOTAL') break;

        const amount = parseAmount(valRaw);
        if (!Number.isFinite(amount) || amount <= 0) continue;

        const extracted = extractMeta(descRaw, fallback);
        const descNorm = normalize(extracted.description);
        const categoryName = guessCategory(descNorm);
        const category = categoriesByName.get(categoryName) || categoriesByName.get('Outros');

        let card = null;
        const cardName = guessCard(descRaw);
        if (cardName) card = cardsByName.get(cardName);
        if (!card) card = reviewCard;

        let installmentGroupId = null;
        if (extracted.installmentTotal) {
          const groupKey = `${descNorm}|${person.id}|${extracted.installmentTotal}`;
          if (!installmentGroupIds.has(groupKey)) {
            installmentGroupIds.set(groupKey, require('crypto').randomUUID());
          }
          installmentGroupId = installmentGroupIds.get(groupKey);
          stats.installments += 1;
        }

        if (person.name === REVIEW_PERSON_NAME) stats.reviewPerson += 1;
        if (card.name === REVIEW_CARD_NAME) stats.reviewCard += 1;
        if (extracted.dateWasGuessed) stats.guessedDate += 1;

        rowsToCreate.push({
          description: extracted.description,
          amount,
          date: extracted.date,
          personId: person.id,
          paymentMethodId: card.id,
          categoryId: category.id,
          notes: extracted.dateWasGuessed ? 'Importado da planilha; data aproximada.' : 'Importado da planilha.',
          installmentGroupId,
          installmentNumber: extracted.installmentNumber,
          installmentTotal: extracted.installmentTotal,
        });
      }
    }

    if (rowsToCreate.length) {
      await prisma.expense.createMany({ data: rowsToCreate });
      stats.imported += rowsToCreate.length;
      stats.bySheet[sheetName] = rowsToCreate.length;
    }
  }

  console.log('\nImportação concluída.');
  console.log(`Total de gastos importados: ${stats.imported}`);
  console.log('Por aba:', stats.bySheet);
  if (stats.skippedSheets.length) console.log('Abas ignoradas (formato não reconhecido):', stats.skippedSheets);
  console.log(`\nPrecisam de revisão manual no app:`);
  console.log(`  - Pessoa "${REVIEW_PERSON_NAME}" (sem pessoa identificada na planilha antiga): ${stats.reviewPerson}`);
  console.log(`  - Cartão "${REVIEW_CARD_NAME}" (método de pagamento não identificado no texto): ${stats.reviewCard}`);
  console.log(`  - Data aproximada (dia 1 do mês, sem data exata na planilha): ${stats.guessedDate}`);
  console.log(`  - Parcelas detectadas e agrupadas: ${stats.installments}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
