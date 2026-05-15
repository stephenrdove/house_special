import { useEffect, useState } from 'react';
import { api } from '../api';
import { GROCERY_CATEGORIES } from '../types';
import type { AppState, GroceryCategory } from '../types';

const ALLERGY_BADGE: Record<string, string> = {
  gluten: 'GF', wheat: 'GF',
  peanut: 'Peanut', peanuts: 'Peanut',
  'tree nut': 'Nuts', 'tree nuts': 'Nuts', nuts: 'Nuts',
  dairy: 'Dairy', milk: 'Dairy', lactose: 'Dairy',
  egg: 'Egg', eggs: 'Egg',
  soy: 'Soy', soya: 'Soy',
  shellfish: 'Shellfish',
  fish: 'Fish',
  sesame: 'Sesame',
  corn: 'Corn',
  sulfite: 'Sulfite', sulfites: 'Sulfite', sulphite: 'Sulfite', sulphites: 'Sulfite',
  mustard: 'Mustard',
  lupin: 'Lupin',
  celery: 'Celery',
};

const ALLERGY_LABEL: Record<string, string> = {
  gluten: 'gluten-free', wheat: 'gluten-free',
  peanut: 'peanut-free', peanuts: 'peanut-free',
  'tree nut': 'nut-free', 'tree nuts': 'nut-free', nuts: 'nut-free',
  dairy: 'dairy-free', milk: 'dairy-free', lactose: 'lactose-free',
  egg: 'egg-free', eggs: 'egg-free',
  soy: 'soy-free', soya: 'soy-free',
  shellfish: 'shellfish-free',
  fish: 'fish-free',
  sesame: 'sesame-free',
  corn: 'corn-free',
  sulfite: 'sulfite-free', sulfites: 'sulfite-free', sulphite: 'sulfite-free', sulphites: 'sulfite-free',
  mustard: 'mustard-free',
  lupin: 'lupin-free',
  celery: 'celery-free',
};

function allergyBadge(a: string): string {
  return ALLERGY_BADGE[a.toLowerCase()] ?? a.slice(0, 5);
}

function allergyLabel(a: string): string {
  return ALLERGY_LABEL[a.toLowerCase()] ?? `${a}-free`;
}

interface Props {
  state: AppState;
  mutate: (updater: (prev: AppState) => AppState) => void;
}

export function GroceryView({ state, mutate }: Props) {
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState<GroceryCategory>('Produce');
  const [newWarn, setNewWarn] = useState(false);
  const [allergies, setAllergies] = useState<string[]>([]);

  useEffect(() => {
    api.getFamily()
      .then(d => setAllergies(d.constraints?.allergies ?? []))
      .catch(() => {});
  }, []);

  const grouped = GROCERY_CATEGORIES.reduce<Record<string, typeof state.grocery>>(
    (acc, cat) => { acc[cat] = []; return acc; }, {}
  );
  for (const item of state.grocery) {
    const cat = grouped[item.category] ? item.category : 'Other';
    grouped[cat].push(item);
  }

  function toggle(id: string) {
    mutate(prev => ({
      ...prev,
      grocery: prev.grocery.map(g => g.id === id ? { ...g, checked: !g.checked } : g),
    }));
  }

  function remove(id: string) {
    mutate(prev => ({ ...prev, grocery: prev.grocery.filter(g => g.id !== id) }));
  }

  function addItem() {
    if (!newName.trim()) return;
    const item = {
      id: `g_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: newName.trim(),
      category: newCat,
      checked: false,
      warn: newWarn,
    };
    mutate(prev => ({ ...prev, grocery: [...prev.grocery, item] }));
    setNewName('');
    setNewWarn(false);
  }

  function clearChecked() {
    mutate(prev => ({ ...prev, grocery: prev.grocery.filter(g => !g.checked) }));
  }

  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const hasChecked = state.grocery.some(g => g.checked);
  const hasItems = state.grocery.length > 0;

  function clearAll() {
    mutate(prev => ({ ...prev, grocery: [] }));
    setConfirmClearAll(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Groceries</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasChecked && (
            <button className="btn btn-ghost btn-sm" onClick={clearChecked}>Clear checked</button>
          )}
          {hasItems && !confirmClearAll && (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmClearAll(true)}>Clear all</button>
          )}
          {confirmClearAll && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmClearAll(false)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={clearAll}>Confirm</button>
            </>
          )}
        </div>
      </div>

      {!hasItems ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛒</div>
          No items yet. Add below or import a meal plan.
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          {GROCERY_CATEGORIES.map(cat => {
            const items = grouped[cat];
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="grocery-cat-label">{cat}</div>
                {items.map(item => (
                  <div key={item.id} className={`grocery-item${item.checked ? ' checked' : ''}`}>
                    <div
                      className={`grocery-checkbox${item.checked ? ' checked' : ''}`}
                      onClick={() => toggle(item.id)}
                    >
                      <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6l3 3 5-5"/>
                      </svg>
                    </div>
                    <span className="grocery-item-label" onClick={() => toggle(item.id)}>
                      {item.name}
                    </span>
                    {item.warn && allergies.length > 0 && (
                      <span className="gf-badge">⚠ {allergies.map(allergyBadge).join('/')}</span>
                    )}
                    <button className="del-btn" onClick={() => remove(item.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="add-item-form">
          <div className="add-item-row">
            <select
              className="input"
              value={newCat}
              onChange={e => setNewCat(e.target.value as GroceryCategory)}
              style={{ flex: '0 0 auto', width: 'auto' }}
            >
              {GROCERY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="add-item-row" style={{ gap: 8 }}>
            <input
              className="input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Add item…"
              onKeyDown={e => e.key === 'Enter' && addItem()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={addItem}>Add</button>
          </div>
          {allergies.length > 0 && (
            <label className="checkbox-row">
              <input type="checkbox" checked={newWarn} onChange={e => setNewWarn(e.target.checked)} />
              {allergies.length === 1
                ? `Must buy certified ${allergyLabel(allergies[0])} version`
                : `Must buy allergen-safe version (${allergies.map(allergyLabel).join(', ')})`}
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
