import { useMemo, useState } from 'react';
import { clientUrl, copyToClipboard } from '../lib/url';

interface InviteClientProps {
  sessionId: string;
  clientToken: string;
}

export function InviteClient({ sessionId, clientToken }: InviteClientProps) {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => clientUrl(sessionId, clientToken), [clientToken, sessionId]);

  const handleCopy = async () => {
    await copyToClipboard(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="invite-box">
      <div>
        <span className="eyebrow">Cliente</span>
        <strong>Invitation link</strong>
        <code>{url}</code>
      </div>
      <button className="secondary-button" type="button" onClick={handleCopy}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}
