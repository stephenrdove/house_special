import { useEffect, useState } from 'react';
import { api } from '../api';
import type { FamilyMember, User } from '../types';

interface Props {
  user: User;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
}

export function SettingsView({ user, onLogout, darkMode, onToggleDark }: Props) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [inviteLabel, setInviteLabel] = useState('Invite family member');
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    api.getFamily()
      .then(data => setMembers(data.members))
      .catch(() => {});
  }, []);

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
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-ghost btn-full btn-sm" onClick={handleInvite}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
              {inviteLabel}
            </button>
            {inviteError && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{inviteError}</p>}
            <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, lineHeight: 1.5 }}>
              Generates a link valid for 48 hours. Anyone with the link can join your plan.
            </p>
          </div>
        </div>

        <button className="btn btn-ghost btn-full" onClick={onLogout}>
          Sign out
        </button>

      </div>
    </div>
  );
}
