import { useState } from 'react';
import { api } from '../api';
import { EditMealModal } from './EditMealModal';
import type { AppState, Recipe } from '../types';

interface Props {
  state: AppState;
  mutate: (updater: (prev: AppState) => AppState) => void;
}

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
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
  return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`;
}

export function CalendarView({ state, mutate }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [recipeSheet, setRecipeSheet] = useState<Recipe | null>(null);

  async function openRecipe(recipeId: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    try {
      const all = await api.listRecipes();
      const recipe = all.find(r => r.id === recipeId);
      if (recipe) setRecipeSheet(recipe);
    } catch { /* ignore */ }
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = getWeekStart(weekOffset);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  function handleSave(key: string, meal: { name: string; notes: string; leftover: boolean } | null) {
    mutate(prev => {
      const next = { ...prev, meals: { ...prev.meals } };
      if (meal) next.meals[key] = meal;
      else delete next.meals[key];
      return next;
    });
    setEditingKey(null);
  }

  const editingMeal = editingKey ? (state.meals[editingKey] ?? null) : null;

  return (
    <div>
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

      <div className="card">
        {days.map(day => {
          const key = dateKey(day);
          const meal = state.meals[key];
          const isToday = day.getTime() === today.getTime();

          return (
            <div
              key={key}
              className={`day-row${isToday ? ' today' : ''}`}
              onClick={() => setEditingKey(key)}
            >
              <div className="day-row-date">
                <span className="day-row-weekday">{DAYS_SHORT[day.getDay()]}</span>
                <span className="day-row-num">{day.getDate()}</span>
              </div>
              <div className="day-row-meal">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className={`day-row-meal-name${!meal ? ' empty' : meal.leftover ? ' leftover' : ''}`}>
                    {meal ? (meal.leftover ? `↩ ${meal.name}` : meal.name) : 'Tap to add'}
                  </div>
                  {meal?.recipe_id && (
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
              <svg className="day-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          );
        })}
      </div>

      {editingKey && (
        <EditMealModal
          dateKey={editingKey}
          meal={editingMeal}
          onSave={meal => handleSave(editingKey, meal)}
          onClose={() => setEditingKey(null)}
          onViewRecipe={editingMeal?.recipe_id ? () => {
            setEditingKey(null);
            openRecipe(editingMeal.recipe_id!);
          } : undefined}
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
                  {recipeSheet.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                </ul>
              </div>
              {recipeSheet.steps.length > 0 && (
                <div>
                  <div className="section-label" style={{ padding: '0 0 8px' }}>Steps</div>
                  <ol className="recipe-step-list">
                    {recipeSheet.steps.map((step, i) => <li key={i}>{step}</li>)}
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
