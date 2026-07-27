import { useMemo, useState } from 'react';
import { clientUrl, copyToClipboard } from '../lib/url';
import { useI18n } from '../lib/i18n';

interface InviteClientProps {
  sessionId: string;
  clientToken: string;
}

export function InviteClient({ sessionId, clientToken }: InviteClientProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const { t } = useI18n();
  const url = useMemo(() => clientUrl(sessionId, clientToken), [clientToken, sessionId]);

  const handleCopy = async () => {
    setCopyFailed(false);

    try {
      await copyToClipboard(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <div className="invite-box">
      <div className="invite-copy">
        <span className="invite-label">{t('invite.eyebrow')}</span>
        <strong>{t('invite.title')}</strong>
        <code title={url}>{url}</code>
      </div>
      <button className="secondary-button" type="button" onClick={handleCopy}>
        {copied ? t('common.copied') : t('common.copy')}
      </button>
      {copyFailed ? <span className="field-error invite-error" role="alert">{t('invite.copyError')}</span> : null}
    </div>
  );
}
