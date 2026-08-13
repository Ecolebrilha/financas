import { useState } from 'react';
import Modal from './Modal';
import { TextField, NumberField, SelectField, PrimaryButton } from './fields';
import { IconEdit, IconPlus, IconCheck } from './icons';
import { useToast } from '../context/ToastContext';

function FieldInput({ field, value, onChange }) {
  const props = { label: field.label, value: value ?? '', onChange: (e) => onChange(e.target.value), required: field.required };
  if (field.type === 'select') {
    return (
      <SelectField {...props}>
        <option value="" disabled>
          Selecione
        </option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectField>
    );
  }
  if (field.type === 'number') return <NumberField {...props} step="1" min={field.min} max={field.max} />;
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm text-ink2 dark:text-ink2dk">
        <input type="checkbox" className="h-4 w-4" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }
  return <TextField {...props} />;
}

function EntityForm({ fields, initial, onSubmit, onCancel, saving }) {
  const [values, setValues] = useState(() => {
    const v = {};
    for (const f of fields) v[f.key] = initial?.[f.key] ?? '';
    return v;
  });

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...values };
    for (const f of fields) {
      if (f.type === 'number') {
        payload[f.key] = payload[f.key] === '' || payload[f.key] === null ? null : Number(payload[f.key]);
      }
    }
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {fields.map((f) => (
        <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(val) => setValues((v) => ({ ...v, [f.key]: val }))} />
      ))}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-black/10 dark:border-white/15 py-3 font-medium">
          Cancelar
        </button>
        <PrimaryButton className="flex-1" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </PrimaryButton>
      </div>
    </form>
  );
}

// Gerenciador CRUD genérico pras entidades de apoio (pessoas, categorias,
// métodos de pagamento): mesma lista + form de criar/editar + inativar.
export default function EntityManager({ title, api, items, fields, describe, onChanged }) {
  const showToast = useToast();
  const [creating, setCreating] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  async function handleCreate(values) {
    setSaving(true);
    try {
      await api.create(values);
      showToast(`${title.slice(0, -1)} criado(a)!`);
      setCreating(false);
      onChanged();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(values) {
    setSaving(true);
    try {
      await api.update(editingItem.id, values);
      showToast('Atualizado!');
      setEditingItem(null);
      onChanged();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    try {
      if (item.active) await api.remove(item.id);
      else await api.update(item.id, { active: true });
      onChanged();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  const visible = items.filter((i) => showInactive || i.active);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setShowInactive((v) => !v)} className="text-xs text-muted underline">
          {showInactive ? 'ocultar inativos' : 'mostrar inativos'}
        </button>
        <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-1 text-sm font-medium text-blue-600">
          <IconPlus width={16} height={16} /> Novo
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted py-2">Nada cadastrado ainda.</p>
      ) : (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {visible.map((item) => (
            <li key={item.id} className={`py-2.5 flex items-center justify-between gap-3 ${!item.active ? 'opacity-50' : ''}`}>
              <span className="text-sm truncate">{describe ? describe(item) : item.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleActive(item)}
                  className="text-xs px-2 py-1 rounded-full border border-black/10 dark:border-white/15"
                  title={item.active ? 'Inativar' : 'Reativar'}
                >
                  {item.active ? 'Inativar' : <span className="flex items-center gap-1"><IconCheck width={12} height={12} /> Reativar</span>}
                </button>
                <button type="button" onClick={() => setEditingItem(item)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label="Editar">
                  <IconEdit width={16} height={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <Modal title={`Novo(a) ${title.slice(0, -1).toLowerCase()}`} onClose={() => setCreating(false)}>
          <EntityForm fields={fields} onSubmit={handleCreate} onCancel={() => setCreating(false)} saving={saving} />
        </Modal>
      )}

      {editingItem && (
        <Modal title={`Editar ${title.slice(0, -1).toLowerCase()}`} onClose={() => setEditingItem(null)}>
          <EntityForm fields={fields} initial={editingItem} onSubmit={handleUpdate} onCancel={() => setEditingItem(null)} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
