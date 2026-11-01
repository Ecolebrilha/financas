import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import Card from '../components/Card';
import Modal from '../components/Modal';
import CardWithdrawalAdvice from '../components/CardWithdrawalAdvice';
import { NumberField, PrimaryButton } from '../components/fields';
import { IconEdit, IconPlus } from '../components/icons';
import { STATUS } from '../lib/colors';
import { formatCurrency, formatDate, formatDateShort, toInputDate } from '../lib/format';

function timeAgo(iso) {
  if (!iso) return 'ainda não informado';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'agora há pouco';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} dia${days > 1 ? 's' : ''}`;
}

function Line({ label, hint, value, color, bold, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-start justify-between gap-3 py-1.5 text-left ${onClick ? 'active:opacity-60' : ''}`}
    >
      <div className="min-w-0">
        <p className={`text-sm truncate ${bold ? 'font-semibold' : ''}`}>{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <span
        className={`text-sm tabular-nums shrink-0 ${bold ? 'font-bold' : 'font-medium'}`}
        style={color ? { color } : undefined}
      >
        {value}
        {onClick && <span className="text-muted ml-1">›</span>}
      </span>
    </Tag>
  );
}

function itemRows(items) {
  return items.map((i) => ({
    key: i.id,
    label: i.installmentTotal > 1 ? `${i.description} (${i.installmentNumber}/${i.installmentTotal})` : i.description,
    hint: [formatDate(i.date), i.paymentMethod].filter(Boolean).join(' · '),
    value: formatCurrency(i.amount),
  }));
}

// Janela de detalhe: cada seção é uma lista de linhas (descrição, data, valor)
// pra conferir de onde vem cada soma.
function DetailModal({ detail, onClose }) {
  return (
    <Modal title={detail.title} onClose={onClose}>
      {detail.note && <p className="text-xs text-muted mb-2">{detail.note}</p>}
      {detail.sections.map((sec, idx) => (
        <div key={idx} className="mb-2">
          {sec.title && (
            <div className="flex items-baseline justify-between mt-2">
              <SubTitle>{sec.title}</SubTitle>
              {sec.total !== undefined && <span className="text-xs font-semibold tabular-nums">{sec.total}</span>}
            </div>
          )}
          {sec.rows.length === 0 && <p className="text-sm text-muted py-1">Nada por aqui.</p>}
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {sec.rows.map((r) => (
              <li key={r.key} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.label}</p>
                  {r.hint && <p className="text-xs text-muted">{r.hint}</p>}
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">{r.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {detail.total && (
        <div className="border-t border-black/5 dark:border-white/10 mt-2 pt-2 flex justify-between font-bold text-sm">
          <span>Total</span>
          <span className="tabular-nums">{detail.total}</span>
        </div>
      )}
    </Modal>
  );
}

function SubTitle({ children }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-muted mt-2 mb-0.5">{children}</p>;
}

// Lista os últimos gastos seus em Pix/Débito pra marcar qual deles você
// ainda vai pagar (o dinheiro precisa ficar separado até lá).
function SeparatePicker({ selfId, onClose, onPicked }) {
  const showToast = useToast();
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!selfId) return;
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 45);
    const to = new Date();
    to.setUTCDate(to.getUTCDate() + 30);
    api.expenses
      .list({ personId: selfId, from: toInputDate(from), to: toInputDate(to) })
      .then((rows) =>
        setItems(rows.filter((e) => !e.unpaid && ['PIX', 'DEBIT_CARD'].includes(e.paymentMethod?.type)).slice(0, 40)),
      )
      .catch((e) => showToast(e.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfId]);

  async function pick(expense) {
    try {
      await api.expenses.update(expense.id, { unpaid: true });
      showToast(`Separado: ${expense.description}`);
      onPicked();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  return (
    <Modal title="Qual gasto você ainda vai pagar?" onClose={onClose}>
      <p className="text-xs text-muted mb-2">
        Seus Pix e débitos recentes. Toque no que ainda não saiu da sua conta pra deixar o dinheiro separado.
      </p>
      {!selfId && <p className="text-sm text-muted">Marque qual pessoa é você em Mais → Pessoas.</p>}
      {selfId && !items && <p className="text-sm text-muted py-4 text-center">Carregando…</p>}
      {items && items.length === 0 && <p className="text-sm text-muted py-2">Nenhum Pix/débito recente pra separar.</p>}
      {items && items.length > 0 && (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {items.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => pick(e)} className="w-full py-2.5 flex items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.description}</p>
                  <p className="text-xs text-muted">
                    {formatDate(e.date)} · {e.paymentMethod?.name}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(e.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function Cash() {
  const { people } = useAppData();
  const showToast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [detail, setDetail] = useState(null);

  function load() {
    api.cash
      .get()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-muted text-center py-10">Carregando…</p>;

  const { account, flash, separate, incoming, outgoing, result, withdrawal, period } = data;
  const selfId = people.find((p) => p.isSelf)?.id;
  const final = result.finalWithOthers;
  const missing = final < 0;
  const finalColor = missing ? STATUS.critical : STATUS.good;

  function openBalance() {
    setBalanceInput(String(account.balance));
    setEditingBalance(true);
  }

  async function saveBalance(e) {
    e.preventDefault();
    if (balanceInput === '' || !Number.isFinite(Number(balanceInput))) return;
    setSaving(true);
    try {
      await api.cash.setBalance(Number(balanceInput));
      showToast('Saldo em conta atualizado!');
      setEditingBalance(false);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const incomesRows = incoming.incomes.map((i) => ({
    key: i.id,
    label: i.description,
    hint: `cai em ${formatDate(i.date)}`,
    value: formatCurrency(i.amount),
  }));
  const personSection = (p) => ({ title: `${p.icon || '👤'} ${p.name}`, total: formatCurrency(p.owed), rows: itemRows(p.items) });
  const cardSection = (c) => ({ title: `${c.name} · vence ${formatDateShort(c.dueDate)}`, total: formatCurrency(c.own), rows: itemRows(c.items) });
  const openPerson = (p) =>
    setDetail({
      title: `${p.name} te deve`,
      note: 'Só Pix e Flash entram aqui — o que está no cartão dela é dela e não passa pela sua conta.',
      sections: [{ rows: itemRows(p.items) }],
      total: formatCurrency(p.owed),
    });
  const openCard = (c) =>
    setDetail({
      title: c.name,
      note: `Sua parte da fatura (vence ${formatDateShort(c.dueDate)}). Fatura inteira: ${formatCurrency(c.invoiceTotal)}.`,
      sections: [{ rows: itemRows(c.items) }],
      total: formatCurrency(c.own),
    });
  const openOtherOutgoing = () =>
    setDetail({
      title: 'Sem cartão definido',
      note: 'Gastos seus que contam como cartão mas não estão na fatura de nenhum cartão cadastrado.',
      sections: [{ rows: itemRows(outgoing.otherItems) }],
      total: formatCurrency(outgoing.other),
    });
  const openIncomes = () =>
    setDetail({ title: 'Receitas suas que vão cair', sections: [{ rows: incomesRows }], total: formatCurrency(incoming.incomesTotal) });
  const openSeparate = () =>
    setDetail({
      title: 'Separar por fora',
      sections: [{ rows: itemRows(separate.items.map((i) => ({ ...i, paymentMethod: i.paymentMethod.name }))) }],
      total: formatCurrency(separate.total),
    });
  const openAllOthers = () =>
    setDetail({
      title: 'Entra dos outros',
      note: 'Pix e Flash que cada pessoa ainda vai te mandar neste período.',
      sections: incoming.others.people.filter((p) => p.items.length).map(personSection),
      total: formatCurrency(incoming.others.pending),
    });
  const openAllCards = () =>
    setDetail({
      title: 'Sai nos cartões',
      note: 'Só a sua parte de cada fatura.',
      sections: [
        ...outgoing.cards.filter((c) => c.items.length).map(cardSection),
        ...(outgoing.otherItems.length
          ? [{ title: 'Sem cartão definido', total: formatCurrency(outgoing.other), rows: itemRows(outgoing.otherItems) }]
          : []),
      ],
      total: formatCurrency(outgoing.total),
    });
  const openFlash = (c) =>
    setDetail({
      title: `${c.cardName} pra sacar`,
      note: 'O Flash só vira dinheiro sacando pelo Mercado Pago, que cobra uma taxa.',
      sections: [
        {
          rows: [
            { key: 'l', label: 'Saldo depositado no mês', value: formatCurrency(c.limit) },
            { key: 'u', label: 'Já gasto no Flash', value: `− ${formatCurrency(c.used)}` },
            { key: 'a', label: 'Saldo disponível', value: formatCurrency(c.available) },
            {
              key: 'f',
              label: `Taxa de saque 1x (${(c.feeRate * 100).toFixed(2).replace('.', ',')}%)`,
              value: `− ${formatCurrency(c.available - c.netWithdrawable)}`,
            },
          ],
        },
      ],
      total: formatCurrency(c.netWithdrawable),
    });
  const openAllIncoming = () =>
    setDetail({
      title: 'Tudo que vai entrar',
      sections: [
        { title: 'Seu', total: formatCurrency(incoming.incomesTotal), rows: incomesRows },
        ...incoming.others.people.filter((p) => p.items.length).map(personSection),
      ],
      total: formatCurrency(incoming.incomesTotal + incoming.others.pending),
    });

  async function markPaid(item) {
    try {
      await api.expenses.update(item.id, { unpaid: false });
      showToast(`Marcado como pago: ${item.description}`);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Caixa</h1>
        <p className="text-xs text-muted">
          Dinheiro de verdade até {formatDate(period.end)}. O Painel mostra o saldo do mês; aqui é o que você tem e vai ter na mão.
        </p>
      </div>

      <Card>
        <p className="text-sm text-muted">{missing ? 'Vai faltar até o fim do período' : 'Vai sobrar até o fim do período'}</p>
        <p className="text-4xl font-bold tabular-nums" style={{ color: finalColor }}>
          {formatCurrency(Math.abs(final))}
        </p>
        <p className="text-xs text-muted mt-1">
          Se os outros não te mandarem nada, ficaria {result.finalWithoutOthers < 0 ? 'faltando' : 'sobrando'}{' '}
          {formatCurrency(Math.abs(result.finalWithoutOthers))}.
        </p>
        <CardWithdrawalAdvice data={withdrawal} />
      </Card>

      <Card
        title="Dinheiro agora"
        action={
          <button type="button" onClick={openBalance} className="flex items-center gap-1 text-xs font-medium text-blue-600">
            <IconEdit width={14} height={14} /> Atualizar conta
          </button>
        }
      >
        <Line label="Em conta" hint={`informado ${timeAgo(account.updatedAt)}`} value={formatCurrency(account.balance)} onClick={openBalance} />
        {flash.cards.map((c) => (
          <Line
            key={c.cardId}
            label={`${c.cardName} pra sacar`}
            hint={`saldo de ${formatCurrency(c.available)} menos taxa de ${(c.feeRate * 100).toFixed(2).replace('.', ',')}% (saque em 1x)`}
            value={formatCurrency(c.netWithdrawable)}
            onClick={() => openFlash(c)}
          />
        ))}
        <div className="border-t border-black/5 dark:border-white/10 mt-1 pt-1">
          <Line label="Pronto pra usar" value={formatCurrency(result.readyNow)} bold />
        </div>
      </Card>

      <Card
        title="Separar pra pagar por fora"
        action={
          <button type="button" onClick={() => setPicking(true)} className="flex items-center gap-1 text-xs font-medium text-blue-600">
            <IconPlus width={14} height={14} /> Separar
          </button>
        }
      >
        {separate.items.length === 0 ? (
          <p className="text-sm text-muted py-1">
            Nada separado. Toque em “Separar” pra marcar um Pix que você ainda vai pagar pessoalmente.
          </p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {separate.items.map((item) => (
              <li key={item.id} className="py-2 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.description}</p>
                  <p className="text-xs text-muted">
                    {formatDate(item.date)} · {item.paymentMethod.name}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(item.amount)}</span>
                <button
                  type="button"
                  onClick={() => markPaid(item)}
                  className="text-xs px-2.5 py-1 rounded-full border border-black/10 dark:border-white/15 shrink-0"
                >
                  Paguei
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-black/5 dark:border-white/10 mt-1 pt-1">
          <Line label="Total a separar" value={`− ${formatCurrency(separate.total)}`} color={separate.total > 0 ? STATUS.critical : undefined} />
          <Line
            label="Livre depois de separar"
            value={formatCurrency(result.freeAfterSeparating)}
            color={result.freeAfterSeparating < 0 ? STATUS.critical : STATUS.good}
            bold
          />
        </div>
      </Card>

      <Card title="Vai entrar">
        <SubTitle>Seu</SubTitle>
        {incoming.incomes.length === 0 ? (
          <p className="text-sm text-muted py-1">Nenhuma receita sua pendente até o fim do período.</p>
        ) : (
          incoming.incomes.map((i) => (
            <Line key={i.id} label={i.description} hint={`cai em ${formatDate(i.date)}`} value={`+ ${formatCurrency(i.amount)}`} color={STATUS.good} onClick={openIncomes} />
          ))
        )}

        <SubTitle>Dos outros (Pix/Flash)</SubTitle>
        {incoming.others.people.length === 0 ? (
          <p className="text-sm text-muted py-1">Ninguém te deve Pix/Flash neste período.</p>
        ) : (
          incoming.others.people.map((p) => (
            <Line
              key={p.id}
              label={`${p.icon || '👤'} ${p.name}`}
              hint="Pix/Flash ainda a receber"
              value={p.pending > 0 ? `+ ${formatCurrency(p.pending)}` : formatCurrency(0)}
              color={p.pending > 0 ? STATUS.good : undefined}
              onClick={() => openPerson(p)}
            />
          ))
        )}
        <div className="border-t border-black/5 dark:border-white/10 mt-1 pt-1">
          <Line
            label="Total que vai entrar"
            hint={`dos outros: ${formatCurrency(incoming.others.pending)}`}
            value={`+ ${formatCurrency(incoming.incomesTotal + incoming.others.pending)}`}
            color={STATUS.good}
            bold
            onClick={openAllIncoming}
          />
        </div>
      </Card>

      <Card title="Vai sair (cartões)">
        <p className="text-xs text-muted -mt-2 mb-1">Só a sua parte de cada fatura — o que é de outras pessoas no cartão não entra na sua conta.</p>
        {outgoing.cards.map((c) => (
          <Line
            key={c.id}
            label={c.name}
            hint={`vence ${formatDateShort(c.dueDate)} · fatura inteira ${formatCurrency(c.invoiceTotal)}${c.own === 0 ? ' (só de outras pessoas)' : ''}`}
            value={c.own > 0 ? `− ${formatCurrency(c.own)}` : formatCurrency(0)}
            color={c.own > 0 ? STATUS.critical : undefined}
            onClick={() => openCard(c)}
          />
        ))}
        {outgoing.other > 0 && (
          <Line label="Sem cartão definido" hint="gastos seus sem fatura de cartão" value={`− ${formatCurrency(outgoing.other)}`} color={STATUS.critical} onClick={openOtherOutgoing} />
        )}
        <div className="border-t border-black/5 dark:border-white/10 mt-1 pt-1">
          <Line label="Total que vai sair" value={`− ${formatCurrency(outgoing.total)}`} color={STATUS.critical} bold onClick={openAllCards} />
        </div>
      </Card>

      <Card title="Como chegamos nesse número">
        <Line label="Pronto pra usar" hint="em conta + Flash sacável" value={formatCurrency(result.readyNow)} />
        <Line label="Separar por fora" value={`− ${formatCurrency(separate.total)}`} color={separate.total > 0 ? STATUS.critical : undefined} onClick={openSeparate} />
        <Line label="Entra (seu)" value={`+ ${formatCurrency(incoming.incomesTotal)}`} color={STATUS.good} onClick={openIncomes} />
        <Line label="Entra (dos outros)" value={`+ ${formatCurrency(incoming.others.pending)}`} color={STATUS.good} onClick={openAllOthers} />
        <Line label="Sai (cartões)" value={`− ${formatCurrency(outgoing.total)}`} color={STATUS.critical} onClick={openAllCards} />
        <div className="border-t border-black/5 dark:border-white/10 mt-1 pt-1">
          <Line label={missing ? 'Falta' : 'Sobra'} value={formatCurrency(final)} color={finalColor} bold />
        </div>
      </Card>

      {editingBalance && (
        <Modal title="Quanto tem na conta agora?" onClose={() => setEditingBalance(false)}>
          <form onSubmit={saveBalance} className="space-y-3">
            <NumberField label="Saldo em conta (R$)" value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)} autoFocus required />
            <p className="text-xs text-muted">Esse é o ponto de partida da conta. Atualize sempre que conferir o saldo no banco.</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingBalance(false)}
                className="flex-1 rounded-xl border border-black/10 dark:border-white/15 py-3 font-medium"
              >
                Cancelar
              </button>
              <PrimaryButton className="flex-1" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} />}

      {picking && (
        <SeparatePicker
          selfId={selfId}
          onClose={() => setPicking(false)}
          onPicked={() => {
            setPicking(false);
            load();
          }}
        />
      )}
    </div>
  );
}
