import { useRef, useState } from 'react';
import type { AppState, GroceryItem, Meal, Recipe } from '../types';
import { categorizeGroceryItem } from '../utils/categorize';
import { mergeIntoGrocery, removeLinkedGroceryItems } from '../utils/grocery';

interface Props {
  dateKey: string;
  meal: Meal | null;
  recipes: Recipe[];
  state: AppState;
  mutate: (updater: (prev: AppState) => AppState) => void;
  onClose: () => void;
}

interface LocalGrocery {
  id: string;
  name: string;
  isNew?: true;
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(key: string): string {
  const d = new Date(key + 'T12:00:00');
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

type Sheet = 'main' | 'recipe-picker' | 'add-groceries';

export function EditMealModal({ dateKey, meal, recipes, state, mutate, onClose }: Props) {
  const [name, setName] = useState(meal?.name ?? '');
  const [notes, setNotes] = useState(meal?.notes ?? '');
  const [leftover, setLeftover] = useState(meal?.leftover ?? false);
  const [linkedRecipeId, setLinkedRecipeId] = useState<string | null>(meal?.recipe_id ?? null);
  const [sheet, setSheet] = useState<Sheet>('main');
  const [pendingMealId, setPendingMealId] = useState<string | null>(null);

  const initialGroceries = meal?.id
    ? state.grocery.filter(g => g.source_meal_ids.includes(meal.id))
    : [];
  const [localGroceries, setLocalGroceries] = useState<LocalGrocery[]>(
    () => initialGroceries.map(g => ({ id: g.id, name: g.name }))
  );
  const originalIds = useRef<Set<string>>(new Set(initialGroceries.map(g => g.id)));

  const linkedRecipe = recipes.find(r => r.id === linkedRecipeId) ?? null;

  function applyGroceryEdits(grocery: GroceryItem[], mealId: string): GroceryItem[] {
    let result = [...grocery];
    const localIds = new Set(localGroceries.filter(g => !g.isNew).map(g => g.id));

    // Remove deleted items
    for (const origId of originalIds.current) {
      if (!localIds.has(origId)) {
        result = result.map(g => {
          if (g.id !== origId) return g;
          const remaining = g.source_meal_ids.filter(id => id !== mealId);
          return remaining.length === 0 ? null : { ...g, source_meal_ids: remaining };
        }).filter((g): g is GroceryItem => g !== null);
      }
    }

    // Rename existing items
    for (const local of localGroceries.filter(g => !g.isNew)) {
      const trimmed = local.name.trim();
      if (!trimmed) continue;
      const idx = result.findIndex(g => g.id === local.id);
      if (idx >= 0 && result[idx].name !== trimmed) {
        result[idx] = { ...result[idx], name: trimmed };
      }
    }

    // Add new items — auto-categorize using existing list then dictionary
    for (const local of localGroceries.filter(g => g.isNew && g.name.trim())) {
      result.push({
        id: local.id,
        name: local.name.trim(),
        category: categorizeGroceryItem(local.name.trim(), result),
        checked: false,
        warn: false,
        source_meal_ids: [mealId],
      });
    }

    return result;
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { handleClear(); return; }

    const mealId = meal?.id || crypto.randomUUID();
    const wasLinked = meal?.recipe_id ?? null;
    const newlyLinked = linkedRecipeId && linkedRecipeId !== wasLinked;

    mutate(prev => ({
      ...prev,
      meals: {
        ...prev.meals,
        [dateKey]: { id: mealId, name: trimmed, notes: notes.trim(), leftover, recipe_id: linkedRecipeId ?? undefined },
      },
      grocery: applyGroceryEdits(prev.grocery, mealId),
    }));

    if (newlyLinked && linkedRecipe && linkedRecipe.ingredients.length > 0) {
      setPendingMealId(mealId);
      setSheet('add-groceries');
    } else {
      onClose();
    }
  }

  function handleClear() {
    const mealId = meal?.id;
    mutate(prev => {
      const nextMeals = { ...prev.meals };
      delete nextMeals[dateKey];
      const nextGrocery = mealId ? removeLinkedGroceryItems(prev.grocery, mealId) : prev.grocery;
      return { ...prev, meals: nextMeals, grocery: nextGrocery };
    });
    onClose();
  }

  function handleAddGroceries() {
    if (!pendingMealId || !linkedRecipe) { onClose(); return; }
    mutate(prev => ({
      ...prev,
      grocery: mergeIntoGrocery(prev.grocery, linkedRecipe.ingredients, pendingMealId),
    }));
    onClose();
  }

  function addLocalGrocery() {
    setLocalGroceries(prev => [...prev, {
      id: `g_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: '',
      isNew: true,
    }]);
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  if (sheet === 'recipe-picker') {
    return (
      <div className="sheet-overlay" onClick={() => setSheet('main')}>
        <div className="sheet" onClick={e => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div className="sheet-header">
            <span className="sheet-title">Link Recipe</span>
            <button className="icon-btn" onClick={() => setSheet('main')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="sheet-body">
            {recipes.length === 0 && (
              <p style={{ color: 'var(--text2)', fontSize: 14 }}>No recipes saved yet.</p>
            )}
            {linkedRecipeId && (
              <button
                className="btn btn-ghost btn-full btn-sm"
                style={{ marginBottom: 8, color: 'var(--red)' }}
                onClick={() => { setLinkedRecipeId(null); setSheet('main'); }}
              >
                Unlink recipe
              </button>
            )}
            <div className="stack">
              {recipes.map(r => (
                <div
                  key={r.id}
                  className="card"
                  style={{ padding: '12px 16px', cursor: 'pointer', outline: r.id === linkedRecipeId ? '2px solid var(--accent)' : 'none' }}
                  onClick={() => {
                    setLinkedRecipeId(r.id);
                    if (!name.trim()) setName(r.name);
                    setSheet('main');
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sheet === 'add-groceries') {
    return (
      <div className="sheet-overlay">
        <div className="sheet">
          <div className="sheet-handle" />
          <div className="sheet-header">
            <span className="sheet-title">Add Groceries?</span>
          </div>
          <div className="sheet-body">
            <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>
              Add {linkedRecipe?.ingredients.length} ingredient{linkedRecipe?.ingredients.length !== 1 ? 's' : ''} from <strong>{linkedRecipe?.name}</strong> to your grocery list?
            </p>
            <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>
              Items already on your list will be skipped — check quantities manually if needed.
            </p>
          </div>
          <div className="sheet-footer">
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Skip</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddGroceries}>Add to list</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet-overlay" onClick={handleOverlayClick}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className="sheet-title">{formatDate(dateKey)}</span>
          <button className="icon-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="sheet-body">
          <div>
            <label className="field-label">Meal</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Chicken tacos with corn tortillas"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea
              className="input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Double batch — leftovers Thursday"
              rows={2}
            />
          </div>

          <button
            className="btn btn-ghost btn-full btn-sm"
            style={{ justifyContent: 'flex-start', gap: 8 }}
            onClick={() => setSheet('recipe-picker')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            {linkedRecipe ? linkedRecipe.name : 'Link recipe'}
          </button>

          <div>
            <label className="field-label">Groceries</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {localGroceries.map((g, i) => (
                <div key={g.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    className="input"
                    style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                    value={g.name}
                    placeholder="Item name"
                    onChange={e => setLocalGroceries(prev =>
                      prev.map((item, idx) => idx === i ? { ...item, name: e.target.value } : item)
                    )}
                  />
                  <button
                    className="icon-btn"
                    onClick={() => setLocalGroceries(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ flexShrink: 0 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}
              <button
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={addLocalGrocery}
              >
                + Add ingredient
              </button>
            </div>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={leftover}
              onChange={e => setLeftover(e.target.checked)}
            />
            Leftover / simple night
          </label>
        </div>
        <div className="sheet-footer">
          {meal && (
            <button className="btn btn-ghost btn-sm" onClick={handleClear}>
              Clear
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginLeft: meal ? 0 : 'auto' }}>
            Cancel
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} style={{ marginLeft: 'auto' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
