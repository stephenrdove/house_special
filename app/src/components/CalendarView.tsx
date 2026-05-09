import { useState } from 'react';
import { EditMealModal } from './EditMealModal';
import type { AppState } from '../types';

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
                <div className={`day-row-meal-name${!meal ? ' empty' : meal.leftover ? ' leftover' : ''}`}>
                  {meal ? (meal.leftover ? `↩ ${meal.name}` : meal.name) : 'Tap to add'}
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
        />
      )}
    </div>
  );
}
