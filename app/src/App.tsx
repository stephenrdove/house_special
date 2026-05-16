import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { AuthGate } from './components/AuthGate';
import { CalendarView } from './components/CalendarView';
import { GroceryView } from './components/GroceryView';
import { ImportView } from './components/ImportView';
import { RecipesView } from './components/RecipesView';
import { SettingsView } from './components/SettingsView';
import { SyncIndicator } from './components/SyncIndicator';
import { useAuth } from './hooks/useAuth';
import { useAppState } from './hooks/useAppState';
import type { Recipe, View } from './types';
import './styles.css';

function CalIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      {active && <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" strokeWidth="2.5"/>}
    </svg>
  );
}
function GrocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>
    </svg>
  );
}
function ImportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}
function RecipeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

const VIEW_LABELS: Record<View, string> = {
  calendar: 'Calendar',
  grocery: 'Groceries',
  import: 'Generate',
  recipes: 'Recipes',
  settings: 'Settings',
};

export default function App() {
  const { auth, login, logout } = useAuth();
  const { state, mutate, sync } = useAppState(auth.status === 'authed');
  const [view, setView] = useState<View>('calendar');
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    if (auth.status !== 'authed') return;
    api.listRecipes().then(setRecipes).catch(() => {});
  }, [auth.status]);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('hs_theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [familyConflict, setFamilyConflict] = useState<string | null>(null);

  // Invite token — read from URL on load, persist through auth redirect
  const urlToken = new URLSearchParams(window.location.search).get('join');
  if (urlToken) sessionStorage.setItem('hs_invite', urlToken);
  const inviteToken = useRef<string | null>(sessionStorage.getItem('hs_invite'));

  // After signing in, consume pending invite token
  useEffect(() => {
    if (auth.status !== 'authed') return;
    const token = sessionStorage.getItem('hs_invite');
    if (!token) return;
    sessionStorage.removeItem('hs_invite');
    inviteToken.current = null;
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    api.joinFamily(token).then(result => {
      if (result.conflict) setFamilyConflict(token);
    }).catch(() => {});
  }, [auth.status]);

  async function handleForceJoin() {
    if (!familyConflict) return;
    const token = familyConflict;
    setFamilyConflict(null);
    await api.joinFamily(token, true).catch(() => {});
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('hs_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <AuthGate status={auth.status} hasInvite={!!inviteToken.current} onLogin={login}>
      {familyConflict && (
        <div className="sheet-overlay" onClick={() => setFamilyConflict(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Switch Families?</span>
            </div>
            <div className="sheet-body">
              <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>
                You're already a member of a family plan. Joining this family will remove you from your current one.
              </p>
            </div>
            <div className="sheet-footer">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setFamilyConflict(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleForceJoin}>Join New Family</button>
            </div>
          </div>
        </div>
      )}
      <div className="app-shell">
        <header className="app-header">
          <span className="app-header-title">
            House Special
            <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text2)', marginLeft: 8 }}>
              {VIEW_LABELS[view]}
            </span>
          </span>
          <div className="app-header-actions">
            <button className="icon-btn" onClick={() => setDarkMode(d => !d)} title="Toggle theme">
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <main className="main-content">
          {view === 'calendar' && <CalendarView state={state} mutate={mutate} recipes={recipes} />}
          {view === 'grocery' && <GroceryView state={state} mutate={mutate} />}
          {view === 'recipes' && <RecipesView recipes={recipes} setRecipes={setRecipes} />}
          {view === 'import' && (
            <ImportView
              state={state}
              mutate={mutate}
              onImportSuccess={() => setView('calendar')}
            />
          )}
          {view === 'settings' && auth.status === 'authed' && (
            <SettingsView
              user={auth.user}
              onLogout={logout}
              darkMode={darkMode}
              onToggleDark={() => setDarkMode(d => !d)}
              onLeaveFamily={() => window.location.reload()}
            />
          )}
        </main>

        <SyncIndicator status={sync} />

        <nav className="bottom-nav">
          {([
            { id: 'calendar', label: 'Calendar', icon: <CalIcon active={view === 'calendar'} /> },
            { id: 'grocery',  label: 'Groceries', icon: <GrocIcon /> },
            { id: 'import',   label: 'Import',    icon: <ImportIcon /> },
            { id: 'recipes',  label: 'Recipes',   icon: <RecipeIcon /> },
            { id: 'settings', label: 'Settings',  icon: <SettingsIcon /> },
          ] as { id: View; label: string; icon: React.ReactNode }[]).map(tab => (
            <button
              key={tab.id}
              className={`nav-item${view === tab.id ? ' active' : ''}`}
              onClick={() => setView(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </AuthGate>
  );
}
