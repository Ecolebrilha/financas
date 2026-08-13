function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sum(items, field) {
  return items.reduce((s, i) => s + i[field], 0);
}

// Agrupa por uma entidade relacionada (person/category/paymentMethod),
// preservando id/nome/cor para exibição direta no frontend.
function groupSumByEntity(items, entityFn, valueFn) {
  const map = new Map();
  for (const item of items) {
    const entity = entityFn(item);
    if (!entity) continue;
    if (!map.has(entity.id)) {
      map.set(entity.id, {
        id: entity.id,
        name: entity.name,
        color: entity.color || null,
        type: entity.type || null,
        total: 0,
        count: 0,
      });
    }
    const entry = map.get(entity.id);
    entry.total += valueFn(item);
    entry.count += 1;
  }
  return Array.from(map.values())
    .map((e) => ({ ...e, total: round2(e.total) }))
    .sort((a, b) => b.total - a.total);
}

function groupSumByKey(items, keyFn, valueFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, { key, total: 0, count: 0 });
    const entry = map.get(key);
    entry.total += valueFn(item);
    entry.count += 1;
  }
  return Array.from(map.values()).map((e) => ({ ...e, total: round2(e.total) }));
}

module.exports = { round2, sum, groupSumByEntity, groupSumByKey };
