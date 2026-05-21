import { useI18n } from '../lib/i18n';

const KOFI_ACCOUNT_ID = 'anrubiof';
const KOFI_URL = `https://ko-fi.com/${KOFI_ACCOUNT_ID}`;

export function KoFiWidget() {
  const { t } = useI18n();

  return (
    <a
      className="support-button"
      href={KOFI_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={t('support.ariaLabel')}
    >
      {t('support.button')}
    </a>
  );
}
