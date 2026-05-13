import { useEffect, useState } from 'react';
import { api } from '../api';
import type { FamilyConstraints, FamilyMember, User } from '../types';
import { DEFAULT_CONSTRAINTS } from '../types';
import { TagInput } from './TagInput';

interface Props {
  user: User;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  onLeaveFamily: () => void;
}

function Stepper({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 14, color: 'var(--text)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ width: 32, height: 32, padding: 0, fontSize: 18 }}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >−</button>
        <span style={{ fontSize: 16, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{value}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ width: 32, height: 32, padding: 0, fontSize: 18 }}
          onClick={() => onChange(value + 1)}
        >+</button>
      </div>
    </div>
  );
}

export function SettingsView({ user, onLogout, darkMode, onToggleDark, onLeaveFamily }: Props) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [inviteLabel, setInviteLabel] = useState('Invite family member');
  const [inviteError, setInviteError] = useState('');
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [constraints, setConstraints] = useState<FamilyConstraints>(DEFAULT_CONSTRAINTS);
  const [constraintsDirty, setConstraintsDirty] = useState(false);
  const [saveLabel, setSaveLabel] = useState<'Save preferences' | 'Saved!' | 'Error'>('Save preferences');

  useEffect(() => {
    api.getFamily()
      .then(data => {
        setMembers(data.members);
        if (data.constraints) setConstraints(data.constraints);
      })
      .catch(() => {});
  }, []);

  function update(patch: Partial<FamilyConstraints>) {
    setConstraints(prev => ({ ...prev, ...patch }));
    setConstraintsDirty(true);
  }

  function updateFamily(patch: Partial<FamilyConstraints['family']>) {
    setConstraints(prev => ({ ...prev, family: { ...prev.family, ...patch } }));
    setConstraintsDirty(true);
  }

  function setChildAge(index: number, age: number) {
    const children = constraints.family.children.map((c, i) => i === index ? { age } : c);
    updateFamily({ children });
  }

  function addChild() {
    updateFamily({ children: [...constraints.family.children, { age: 1 }] });
  }

  function removeChild(index: number) {
    updateFamily({ children: constraints.family.children.filter((_, i) => i !== index) });
  }

  async function handleSave() {
    try {
      await api.updateConstraints(constraints);
      setConstraintsDirty(false);
      setSaveLabel('Saved!');
      setTimeout(() => setSaveLabel('Save preferences'), 2500);
    } catch {
      setSaveLabel('Error');
      setTimeout(() => setSaveLabel('Save preferences'), 2500);
    }
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

  async function handleLeave() {
    await api.leaveFamily().catch(() => {});
    onLeaveFamily();
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

        {/* Family Members */}
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

        {/* Family Preferences */}
        <div className="card">
          <div className="section-label">Family Preferences</div>
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
              These preferences are used when generating your meal plan. Keep them up to date as your family changes.
            </p>

            {/* Family composition */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="field-label">Family composition</label>
              <Stepper label="Adults" value={constraints.family.adults} onChange={n => updateFamily({ adults: n })} min={1} />
              {constraints.family.children.map((child, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, color: 'var(--text)', flex: 1 }}>Child {i + 1} age</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ width: 32, height: 32, padding: 0, fontSize: 18 }}
                      onClick={() => setChildAge(i, Math.max(0, child.age - 1))}
                      disabled={child.age <= 0}
                    >−</button>
                    <span style={{ fontSize: 16, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{child.age}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ width: 32, height: 32, padding: 0, fontSize: 18 }}
                      onClick={() => setChildAge(i, child.age + 1)}
                    >+</button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0 10px', height: 32, fontSize: 13 }}
                      onClick={() => removeChild(i)}
                    >Remove</button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addChild}>
                + Add child
              </button>
            </div>

            <TagInput
              label="Allergies"
              tags={constraints.allergies}
              onChange={allergies => update({ allergies })}
              placeholder="e.g. gluten, peanuts…"
              danger
            />

            <TagInput
              label="Dietary restrictions"
              tags={constraints.dietary_restrictions}
              onChange={dietary_restrictions => update({ dietary_restrictions })}
              placeholder="e.g. vegetarian, no pork…"
            />

            <TagInput
              label="Go-to meals"
              tags={constraints.favorites}
              onChange={favorites => update({ favorites })}
              placeholder="e.g. Taco night, GF pasta…"
            />

            <TagInput
              label="Avoid"
              tags={constraints.avoid}
              onChange={avoid => update({ avoid })}
              placeholder="e.g. mushrooms, fish…"
            />

            <TagInput
              label="Preferred cuisines"
              tags={constraints.preferred_cuisines}
              onChange={preferred_cuisines => update({ preferred_cuisines })}
              placeholder="e.g. Italian, Mexican…"
            />

            <div>
              <label className="field-label">Additional notes</label>
              <textarea
                className="input"
                value={constraints.notes}
                onChange={e => update({ notes: e.target.value })}
                rows={4}
                placeholder="Anything that doesn't fit above — special meal rules, brand preferences, etc."
              />
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={handleSave}
              disabled={!constraintsDirty}
            >
              {saveLabel}
            </button>
          </div>
        </div>

        <button className="btn btn-ghost btn-full" onClick={onLogout}>
          Sign out
        </button>

      </div>
    </div>
  );
}
