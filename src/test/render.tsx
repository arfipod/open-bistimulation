import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LanguageProvider } from '../lib/i18n';

export function renderWithI18n(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: LanguageProvider, ...options });
}
