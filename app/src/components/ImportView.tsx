import { useEffect, useState } from 'react';
import { api } from '../api';
import { buildPlanningPrompt, getNextSunday } from '../utils/planningPrompt';
import type { AppState, FamilyConstraints, GroceryItem } from '../types';

interface Props {
  state: AppState;
  mutate: (updater: (prev: AppState) => AppState) => void;
  onImportSuccess: () => void;
}

export function ImportView({ state, mutate, onImportSuccess }: Props) {
  const [json, setJson] = useState('');
  const [pasteStatus, setPasteStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy prompt');
  const [constraints, setConstraints] = useState<FamilyConstraints | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [startDate, setStartDate] = useState(getNextSunday);
  const [overwriteCount, setOverwriteCount] = useState(0);

  useEffect(() => {
    api.getFamily()
      .then(data => setConstraints(data.constraints))
      .catch(() => {});
  }, []);

  function getExistingMealCount(): number {
    const start = new Date(startDate + 'T00:00:00');
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      if (state.meals[key]?.name) count++;
    }
    return count;
  }

  function handleGenerateClick() {
    const existing = getExistingMealCount();
    if (existing > 0) {
      setOverwriteCount(existing);
    } else {
      runGenerate();
    }
  }

  async function runGenerate() {
    setOverwriteCount(0);
    setGenerating(true);
    setGenerateError('');
    try {
      const data = await api.generatePlan(startDate);
      importData(data);
    } catch {
      setGenerateError('Generation failed. Check your connection and try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(buildPlanningPrompt(state, constraints, startDate));
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy prompt'), 2500);
  }

  function importData(data: { weeks: { week: number; days: { date: string; meal: string; notes?: string; leftover: boolean; recipe_id?: string }[] }[]; grocery: { name: string; category: string; warn: boolean }[] }) {
    let meals = 0, groceries = 0;

    mutate(prev => {
      const next = { ...prev, meals: { ...prev.meals }, grocery: [...prev.grocery] };

      if (Array.isArray(data.weeks)) {
        for (const week of data.weeks) {
          for (const day of week.days ?? []) {
            if (day.date && day.meal) {
              next.meals[day.date] = { name: day.meal, notes: day.notes ?? '', leftover: !!day.leftover, recipe_id: day.recipe_id };
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

    if (meals > 0) setTimeout(onImportSuccess, 1200);
    return { meals, groceries };
  }

  function importJSON() {
    try {
      const data = JSON.parse(json);
      const { meals, groceries } = importData(data);
      setPasteStatus({ type: 'ok', msg: `Imported ${meals} meals and ${groceries} grocery items` });
      setJson('');
    } catch (e) {
      setPasteStatus({ type: 'err', msg: `Invalid JSON — ${(e as Error).message}` });
    }
  }

  return (
    <div>
      <h2 className="page-title">Generate Plan</h2>
      <div className="stack">

        {/* Primary: auto-generate */}
        <div className="card">
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Generate with AI</div>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                Builds a 7-day meal plan and grocery list using your saved family preferences. Takes about 20–30 seconds.
              </p>
            </div>
            <div>
              <label className="field-label">Week starting</label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary btn-full"
              onClick={handleGenerateClick}
              disabled={generating}
            >
              {generating ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Generate Plan
                </>
              )}
            </button>
            {generateError && (
              <p style={{ fontSize: 13, color: 'var(--red)' }}>{generateError}</p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="divider" style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>or paste manually</span>
          <div className="divider" style={{ flex: 1 }} />
        </div>

        {/* Fallback: copy prompt + paste JSON */}
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
              onChange={e => { setJson(e.target.value); setPasteStatus(null); }}
              placeholder={'{\n  "weeks": [...],\n  "grocery": [...]\n}'}
              rows={10}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
            {pasteStatus && (
              <div className={`import-status ${pasteStatus.type}`} style={{ marginTop: 10 }}>
                {pasteStatus.type === 'ok' ? '✓ ' : '✕ '}{pasteStatus.msg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setJson(''); setPasteStatus(null); }}>
                Clear
              </button>
              <button className="btn btn-primary btn-sm" onClick={importJSON} disabled={!json.trim()}>
                Import Plan
              </button>
            </div>
          </div>
        </div>

      </div>

      {overwriteCount > 0 && (
        <div className="sheet-overlay" onClick={() => setOverwriteCount(0)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Overwrite existing meals?</span>
            </div>
            <div className="sheet-body">
              <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>
                {overwriteCount} meal{overwriteCount !== 1 ? 's' : ''} already planned for this week will be replaced.
              </p>
            </div>
            <div className="sheet-footer">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setOverwriteCount(0)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={runGenerate}>Generate anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
