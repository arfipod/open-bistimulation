import { useI18n } from '../lib/i18n';

interface LoadingViewProps {
  message?: string;
}

export function LoadingView({ message }: LoadingViewProps) {
  const { t } = useI18n();

  return (
    <main className="centered-page">
      <div className="panel loading-panel">{message ?? t('common.loading')}</div>
    </main>
  );
}
