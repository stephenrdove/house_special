import type { SyncStatus } from '../types';

interface Props {
  status: SyncStatus;
  onRetry?: () => void;
}

export function SyncIndicator({ status, onRetry }: Props) {
  if (status === 'idle') return null;

  const label = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Sync failed';

  return (
    <div
      className={`sync-pill ${status}`}
      onClick={status === 'error' ? onRetry : undefined}
    >
      <div className={`sync-dot ${status === 'saving' ? 'spinning' : ''}`} />
      {label}
    </div>
  );
}
