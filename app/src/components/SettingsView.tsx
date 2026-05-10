import { useEffect, useState } from 'react';
import { api } from '../api';
import type { FamilyMember, User } from '../types';
import { DEFAULT_FAMILY_CONTEXT } from '../utils/planningPrompt';

interface Props {
  user: User;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  onLeaveFamily: () => void;
}

export function SettingsView({ user, onLogout, darkMode, onToggleDark, onLeaveFamily }: Props) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [inviteLabel, setInviteLabel] = useState('Invite family member');
  const [inviteError, setInviteError] = useState('');
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [promptContext, setPromptContext] = useState(DEFAULT_FAMILY_CONTEXT);
  const [promptDirty, setPromptDirty] = useState(false);
  const [promptSaveLabel, setPromptSaveLabel] = useState<'Save' | 'Saved!' | 'Error'>('Save');

  useEffect(() => {
    api.getFamily()
      .then(data => {
        setMembers(data.members);
        setPromptContext(data.promptContext ?? DEFAULT_FAMILY_CONTEXT);
      })
      .catch(() => {});
  }, []);

  async function handleSavePrompt() {
    const trimmed = promptContext.trim();
    const valueToSave = trimmed === DEFAULT_FAMILY_CONTEXT.trim() ? null : trimmed || null;
    try {
      await api.updatePrompt(valueToSave);
      setPromptDirty(false);
      setPromptSaveLabel('Saved!');
      setTimeout(() => setPromptSaveLabel('Save'), 2500);
    } catch {
      setPromptSaveLabel('Error');
      setTimeout(() => setPromptSaveLabel('Save'), 2500);
    }
  }

  function handleResetPrompt() {
    setPromptContext(DEFAULT_FAMILY_CONTEXT);
    setPromptDirty(true);
  }

  async function handleLeave() {
    await api.leaveFamily().catch(() => {});
    onLeaveFamily();
  }

  async function handleInvite() {
    setInviteError('');
    try {
      const { url } = await api.createInvite();
      await navigator.clipboard.writeText(url);
      setInviteLabel('Link copied!');
      setTimeout(() => setInviteLabel('Invite family member'), 3000);
    } catch {
      setInviteError('Failed to generate invite link. Try again.');
    }
  }

  return (
    <div>
      <h2 className="page-title">Settings</h2>
      <div className="stack">

        {/* Profile */}
        <div className="card">
          <div className="profile-row">
            <img src={user.picture} alt={user.name} className="profile-avatar" referrerPolicy="no-referrer" />
            <div>
              <div className="profile-name">{user.name}</div>
              <div className="profile-email">{user.email}</div>
            </div>
          </div>
          <div className="settings-row">
            <div>Dark mode</div>
            <label className="toggle">
              <input type="checkbox" checked={darkMode} onChange={onToggleDark} />
              <div className="toggle-track" />
            </label>
          </div>
        </div>

        {/* Family */}
        <div className="card">
          <div className="section-label">Family Plan</div>
          {members.map(member => (
            <div key={member.id} className="profile-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, paddingBottom: 12 }}>
              <img src={member.picture} alt={member.name} className="profile-avatar" referrerPolicy="no-referrer" style={{ width: 36, height: 36 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="profile-name" style={{ fontSize: 14 }}>
                  {member.name}
                  {member.id === user.id && <span style={{ color: 'var(--text2)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>you</span>}
                </div>
                <div className="profile-email">{member.email}</div>
              </div>
              {member.is_owner && (
                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, background: 'var(--accent-light)', padding: '2px 8px', borderRadius: 20 }}>
                  Owner
                </span>
              )}
            </div>
          ))}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-ghost btn-full btn-sm" onClick={handleInvite}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
              {inviteLabel}
            </button>
            {inviteError && <p style={{ fontSize: 12, color: 'var(--red)' }}>{inviteError}</p>}
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
              Generates a link valid for 48 hours. Anyone with the link can join your plan.
            </p>
            <button className="btn btn-danger btn-full btn-sm" style={{ marginTop: 4 }} onClick={() => setLeaveConfirm(true)}>
              Leave family
            </button>
          </div>
        </div>

        {leaveConfirm && (
          <div className="sheet-overlay" onClick={() => setLeaveConfirm(false)}>
            <div className="sheet" onClick={e => e.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-header">
                <span className="sheet-title">Leave Family?</span>
              </div>
              <div className="sheet-body">
                <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>
                  You'll lose access to the shared meal plan and grocery list. If you're the owner, another member will become the owner automatically.
                </p>
              </div>
              <div className="sheet-footer">
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setLeaveConfirm(false)}>Cancel</button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleLeave}>Leave Family</button>
              </div>
            </div>
          </div>
        )}

        {/* Planning Prompt */}
        <div className="card">
          <div className="section-label">Planning Prompt</div>
          <div style={{ padding: '0 16px 16px' }}>
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 12 }}>
              Customize the family instructions sent to Claude when generating your meal plan. The JSON format requirements are always added automatically — you can't break the import.
            </p>
            <textarea
              className="input"
              value={promptContext}
              onChange={e => { setPromptContext(e.target.value); setPromptDirty(true); }}
              rows={14}
              style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleResetPrompt}
                disabled={promptContext.trim() === DEFAULT_FAMILY_CONTEXT.trim()}
              >
                Reset to default
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSavePrompt}
                disabled={!promptDirty}
              >
                {promptSaveLabel}
              </button>
            </div>
          </div>
        </div>

        <button className="btn btn-ghost btn-full" onClick={onLogout}>
          Sign out
        </button>

      </div>
    </div>
  );
}
