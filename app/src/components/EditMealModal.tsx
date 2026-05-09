import { useEffect, useRef, useState } from 'react';
import type { Meal } from '../types';

interface Props {
  dateKey: string;
  meal: Meal | null;
  onSave: (meal: Meal | null) => void;
  onClose: () => void;
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(key: string): string {
  const d = new Date(key + 'T12:00:00');
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function EditMealModal({ dateKey, meal, onSave, onClose }: Props) {
  const [name, setName] = useState(meal?.name ?? '');
  const [notes, setNotes] = useState(meal?.notes ?? '');
  const [leftover, setLeftover] = useState(meal?.leftover ?? false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  function handleSave() {
    if (name.trim()) {
      onSave({ name: name.trim(), notes: notes.trim(), leftover });
    } else {
      onSave(null);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
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
              ref={inputRef}
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Chicken tacos with corn tortillas"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
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
            <button className="btn btn-ghost btn-sm" onClick={() => onSave(null)}>
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
