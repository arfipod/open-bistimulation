import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider, useI18n } from './i18n';

function Probe() {
  const { language, t, toggleLanguage } = useI18n();

  return (
    <div>
      <p data-testid="language">{language}</p>
      <p data-testid="plain">{t('controls.start')}</p>
      <p data-testid="param">{t('visual.speed', { value: 12 })}</p>
      <button type="button" onClick={toggleLanguage}>
        toggle
      </button>
    </div>
  );
}

describe('i18n provider', () => {
  it('uses stored language before the system language', () => {
    localStorage.setItem('open-bistimulation.language.v1', 'es');

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('es');
    expect(screen.getByTestId('plain')).toHaveTextContent('Iniciar BLS');
    expect(screen.getByTestId('param')).toHaveTextContent('Velocidad: 12');
    expect(document.documentElement.lang).toBe('es');
  });

  it('falls back to Spanish for Spanish system locales', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('es-ES');

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('es');
  });

  it('defaults to English and persists toggles', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('en');
    expect(screen.getByTestId('plain')).toHaveTextContent('Start BLS');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByTestId('language')).toHaveTextContent('es');
    expect(localStorage.getItem('open-bistimulation.language.v1')).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('keeps working when browser storage is unavailable', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('en');
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('language')).toHaveTextContent('es');
  });

  it('throws a clear error when the hook is used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow('useI18n must be used inside LanguageProvider.');
  });
});
