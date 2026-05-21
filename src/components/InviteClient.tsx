import { useMemo, useState } from 'react';
import { clientUrl, copyToClipboard } from '../lib/url';
import { useI18n } from '../lib/i18n';

interface InviteClientProps {
  sessionId: string;
  clientToken: string;
}

export function InviteClient({ sessionId, clientToken }: InviteClientProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  const url = useMemo(() => clientUrl(sessionId, clientToken), [clientToken, sessionId]);

  const handleCopy = async () => {
    await copyToClipboard(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="invite-box">
      <div>
        <span className="eyebrow">{t('invite.eyebrow')}</span>
        <strong>{t('invite.title')}</strong>
        <code>{url}</code>
      </div>
      <button className="secondary-button" type="button" onClick={handleCopy}>
        {copied ? t('common.copied') : t('common.copy')}
      </button>
    </div>
  );
}
