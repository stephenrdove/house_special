import { useState } from 'react';
import { buildPlanningPrompt } from '../utils/planningPrompt';
import type { AppState, GroceryItem } from '../types';

interface Props {
  state: AppState;
  mutate: (updater: (prev: AppState) => AppState) => void;
  onImportSuccess: () => void;
}

export function ImportView({ state, mutate, onImportSuccess }: Props) {
  const [json, setJson] = useState('');
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy Planning Prompt');

  async function copyPrompt() {
    await navigator.clipboard.writeText(buildPlanningPrompt(state));
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy Planning Prompt'), 2500);
  }

  function importJSON() {
    try {
      const data = JSON.parse(json);
      let meals = 0, groceries = 0;

      mutate(prev => {
        const next = { ...prev, meals: { ...prev.meals }, grocery: [...prev.grocery] };

        if (Array.isArray(data.weeks)) {
          for (const week of data.weeks) {
            for (const day of week.days ?? []) {
              if (day.date && day.meal) {
                next.meals[day.date] = { name: day.meal, notes: day.notes ?? '', leftover: !!day.leftover };
                meals++;
              }
            }
          }
        }

        if (Array.isArray(data.grocery)) {
          for (const item of data.grocery) {
            if (item.name && item.category) {
              const gi: GroceryItem = {
                id: `g_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                name: item.name,
                category: item.category,
                checked: false,
                warn: !!item.warn,
              };
              next.grocery.push(gi);
              groceries++;
            }
          }
        }

        return next;
      });

      setStatus({ type: 'ok', msg: `Imported ${meals} meals and ${groceries} grocery items` });
      setJson('');
      if (meals > 0) setTimeout(onImportSuccess, 1200);
    } catch (e) {
      setStatus({ type: 'err', msg: `Invalid JSON — ${(e as Error).message}` });
    }
  }

  return (
    <div>
      <h2 className="page-title">Import</h2>
      <div className="stack">
        <button className="btn btn-ghost btn-full" onClick={copyPrompt}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {copyLabel}
        </button>

        <div className="card">
          <div style={{ padding: 16 }}>
            <label className="field-label">Paste Claude JSON</label>
            <textarea
              className="input"
              value={json}
              onChange={e => { setJson(e.target.value); setStatus(null); }}
              placeholder={'{\n  "weeks": [...],\n  "grocery": [...]\n}'}
              rows={10}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
            {status && (
              <div className={`import-status ${status.type}`} style={{ marginTop: 10 }}>
                {status.type === 'ok' ? '✓ ' : '✕ '}{status.msg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setJson(''); setStatus(null); }}>
                Clear
              </button>
              <button className="btn btn-primary btn-sm" onClick={importJSON} disabled={!json.trim()}>
                Import Plan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
