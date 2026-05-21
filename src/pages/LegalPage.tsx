import { AppHeader } from '../components/AppHeader';
import { useI18n } from '../lib/i18n';

type LegalPageKind = 'legal' | 'privacy' | 'terms' | 'disclaimer';

const CONTENT = {
  legal: {
    title: 'legal.legal.title',
    intro: 'legal.legal.intro',
    items: ['legal.legal.item1', 'legal.legal.item2', 'legal.legal.item3', 'legal.legal.item4'],
  },
  privacy: {
    title: 'legal.privacy.title',
    intro: 'legal.privacy.intro',
    items: ['legal.privacy.item1', 'legal.privacy.item2', 'legal.privacy.item3', 'legal.privacy.item4'],
  },
  terms: {
    title: 'legal.terms.title',
    intro: 'legal.terms.intro',
    items: ['legal.terms.item1', 'legal.terms.item2', 'legal.terms.item3', 'legal.terms.item4'],
  },
  disclaimer: {
    title: 'legal.disclaimer.title',
    intro: 'legal.disclaimer.intro',
    items: ['legal.disclaimer.item1', 'legal.disclaimer.item2', 'legal.disclaimer.item3', 'legal.disclaimer.item4'],
  },
} as const;

interface LegalPageProps {
  page: LegalPageKind;
}

export function LegalPage({ page }: LegalPageProps) {
  const { t } = useI18n();
  const content = CONTENT[page];

  return (
    <>
      <AppHeader title={t(content.title)} />
      <main className="legal-page">
        <article className="legal-panel panel">
          <span className="eyebrow">{t('app.footer')}</span>
          <h1>{t(content.title)}</h1>
          <p>{t(content.intro)}</p>
          <ul>
            {content.items.map((item) => (
              <li key={item}>{t(item)}</li>
            ))}
          </ul>
        </article>
      </main>
    </>
  );
}
