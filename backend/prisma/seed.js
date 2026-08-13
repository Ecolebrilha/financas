const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PEOPLE = ['Fernando', 'Sogra', 'Esposa', 'Cunhada'];

const CATEGORIES = [
  'Moradia',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Assinatura',
  'Pet',
  'Presente',
  'Vestuário',
  'Beleza e Cuidados Pessoais',
  'Lazer e Entretenimento',
  'Educação',
  'Empréstimo e Ajuda',
  'Eletrônicos e Casa',
  'Outros',
];

// dueDay: dia de vencimento da fatura. null = não se aplica (Pix, Flash).
const PAYMENT_METHODS = [
  { name: 'Pix', type: 'PIX', dueDay: null },
  { name: 'Cartão Bradesco', type: 'CREDIT_CARD', dueDay: 10 },
  { name: 'Cartão C&A', type: 'CREDIT_CARD', dueDay: 10 },
  { name: 'Cartão Riachuelo', type: 'CREDIT_CARD', dueDay: 10 },
  { name: 'Cartão Le Biscuit', type: 'CREDIT_CARD', dueDay: 10 },
  { name: 'Cartão Americanas', type: 'CREDIT_CARD', dueDay: 10 },
  { name: 'Cartão Nubank', type: 'CREDIT_CARD', dueDay: 10 },
  { name: 'Flash (VA/VR)', type: 'VOUCHER', dueDay: null },
  { name: 'Cartão do Tio (externo)', type: 'CREDIT_CARD', dueDay: 2 },
];

async function main() {
  for (let i = 0; i < PEOPLE.length; i++) {
    const name = PEOPLE[i];
    const existing = await prisma.person.findFirst({ where: { name } });
    if (!existing) {
      // O primeiro da lista (você) é marcado como "isSelf" pro Painel
      // calcular saldo pessoal separado do gasto da família toda.
      await prisma.person.create({ data: { name, sortOrder: i, isSelf: i === 0 } });
    }
  }

  for (let i = 0; i < CATEGORIES.length; i++) {
    const name = CATEGORIES[i];
    const existing = await prisma.category.findFirst({ where: { name } });
    if (!existing) {
      await prisma.category.create({ data: { name, sortOrder: i } });
    }
  }

  for (let i = 0; i < PAYMENT_METHODS.length; i++) {
    const pm = PAYMENT_METHODS[i];
    const existing = await prisma.paymentMethod.findFirst({
      where: { name: pm.name },
    });
    if (!existing) {
      await prisma.paymentMethod.create({
        data: { ...pm, sortOrder: i },
      });
    }
  }

  console.log('Seed concluído: pessoas, categorias e métodos de pagamento.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
