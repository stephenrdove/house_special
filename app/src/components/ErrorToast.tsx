import { useEffect } from 'react';

interface Props {
  message: string | null;
  onDismiss: () => void;
}

export function ErrorToast({ message, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div className="error-toast" role="alert" onClick={onDismiss}>
      <span>{message}</span>
      <button className="error-toast-close" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </div>
  );
}
