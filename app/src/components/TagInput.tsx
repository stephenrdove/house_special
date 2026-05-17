import { useRef, useState } from 'react';

interface Props {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  danger?: boolean;
}

export function TagInput({ label, tags, onChange, placeholder, danger }: Props) {
  const [input, setInput] = useState('');
  const justCommitted = useRef(false);

  function commit() {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
      justCommitted.current = true;
    }
    setInput('');
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      if (justCommitted.current) { justCommitted.current = false; return; }
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <label className="field-label">{label}</label>
      <div className={`tag-input${danger ? ' tag-input-danger' : ''}`}>
        {tags.map(tag => (
          <span key={tag} className={`tag${danger ? ' tag-danger' : ''}`}>
            {tag}
            <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))}>×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commit}
          placeholder={tags.length === 0 ? placeholder : 'Add another…'}
        />
      </div>
      {danger && (
        <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Safety-critical — these are treated as hard constraints.</p>
      )}
    </div>
  );
}
