import { useState } from 'react';
import { EditMealModal } from './EditMealModal';
import type { AppState, Recipe } from '../types';
import { DAY_NAMES_SHORT, MONTH_NAMES_SHORT, dateKey } from '../utils/date';

interface Props {
  state: AppState;
  mutate: (updater: (prev: AppState) => AppState) => void;
  recipes: Recipe[];
}

function getWeekStart(offset: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sun = new Date(today);
  sun.setDate(today.getDate() - today.getDay() + offset * 7);
  return sun;
}

function formatWeekLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${MONTH_NAMES_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES_SHORT[end.getMonth()]} ${end.getDate()}`;
}

export function CalendarView({ state, mutate, recipes }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [recipeSheet, setRecipeSheet] = useState<Recipe | null>(null);
  const [movingKey, setMovingKey] = useState<string | null>(null);

  function openRecipe(recipeId: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe) setRecipeSheet(recipe);
  }

  function handleDayClick(key: string) {
    if (!movingKey) {
      setEditingKey(key);
      return;
    }
    if (movingKey === key) {
      setMovingKey(null);
      return;
    }
    mutate(prev => {
      const meals = { ...prev.meals };
      const a = meals[movingKey];
      const b = meals[key];
      if (b) meals[movingKey] = b; else delete meals[movingKey];
      if (a) meals[key] = a; else delete meals[key];
      return { ...prev, meals };
    });
    setMovingKey(null);
  }

const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = getWeekStart(weekOffset);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const editingMeal = editingKey ? (state.meals[editingKey] ?? null) : null;

  const movingMeal = movingKey ? state.meals[movingKey] : null;

  return (
    <div>
      {movingKey && (
        <div className="move-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
          </svg>
          <span className="move-banner-label">
            <span style={{ display: 'block' }}>Moving: {movingMeal ? movingMeal.name : 'empty day'}</span>
            <span style={{ display: 'block', fontSize: 12, opacity: 0.8, fontWeight: 400 }}>Tap a day to place it</span>
          </span>
          <button className="move-banner-cancel" onClick={() => setMovingKey(null)}>Cancel</button>
        </div>
      )}
      <div className="cal-nav">
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w - 1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button className="cal-nav-label btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>
          {weekOffset === 0 ? 'This Week' : formatWeekLabel(weekStart)}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w + 1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      <div className={`card${movingKey ? ' move-mode' : ''}`}>
        {days.map(day => {
          const key = dateKey(day);
          const meal = state.meals[key];
          const isToday = day.getTime() === today.getTime();

          const isSelected = movingKey === key;
          const isDropTarget = !!movingKey && !isSelected;
          let rowClass = 'day-row';
          if (isToday) rowClass += ' today';
          if (isSelected) rowClass += ' selected';
          else if (isDropTarget) rowClass += ' drop-target';

          return (
            <div
              key={key}
              className={rowClass}
              onClick={() => handleDayClick(key)}
            >
              <div className="day-row-date">
                <span className="day-row-weekday">{DAY_NAMES_SHORT[day.getDay()]}</span>
                <span className="day-row-num">{day.getDate()}</span>
              </div>
              <div className="day-row-meal">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className={`day-row-meal-name${!meal ? ' empty' : meal.leftover ? ' leftover' : ''}`}>
                    {meal ? (meal.leftover ? `↩ ${meal.name}` : meal.name) : (movingKey ? 'Tap to place here' : 'Tap to add')}
                  </div>
                  {!movingKey && meal?.recipe_id && (
                    <button
                      onClick={e => openRecipe(meal.recipe_id!, e)}
                      style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      title="View recipe"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                      </svg>
                    </button>
                  )}
                </div>
                {meal?.notes && <div className="day-row-meal-notes">{meal.notes}</div>}
              </div>
              {movingKey && !isSelected ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : movingKey && isSelected ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg className="day-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {editingKey && (
        <EditMealModal
          dateKey={editingKey}
          meal={editingMeal}
          recipes={recipes}
          state={state}
          mutate={mutate}
          onClose={() => setEditingKey(null)}
          onMove={() => { setMovingKey(editingKey); setEditingKey(null); }}
        />
      )}

      {recipeSheet && (
        <div className="sheet-overlay" onClick={() => setRecipeSheet(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">{recipeSheet.name}</span>
              <button className="icon-btn" onClick={() => setRecipeSheet(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="sheet-body">
              {recipeSheet.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {recipeSheet.tags.map(tag => <span key={tag} className="tag" style={{ fontSize: 11 }}>{tag}</span>)}
                </div>
              )}
              <div>
                <div className="section-label" style={{ padding: '0 0 8px' }}>Ingredients</div>
                <ul className="recipe-ingredient-list">
                  {recipeSheet.ingredients.map(ing => <li key={ing.name}>{ing.name}</li>)}
                </ul>
              </div>
              {recipeSheet.steps.length > 0 && (
                <div>
                  <div className="section-label" style={{ padding: '0 0 8px' }}>Steps</div>
                  <ol className="recipe-step-list">
                    {recipeSheet.steps.map((step, i) => <li key={`step-${i}`}>{step}</li>)}
                  </ol>
                </div>
              )}
              {recipeSheet.notes && (
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{recipeSheet.notes}</p>
              )}
            </div>
            <div className="sheet-footer">
              <button className="btn btn-primary btn-full" onClick={() => setRecipeSheet(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
