import { useEffect } from 'react';
import { useI18n } from '../lib/i18n';

const KOFI_ACCOUNT_ID = 'anrubiof';
const KOFI_CONTAINER_ID = 'kofi-widget-overlay-host';
const KOFI_SCRIPT_ID = 'kofi-widget-overlay-script';
const KOFI_SCRIPT_SRC = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
const KOFI_BUTTON_COLOR = '#46739D';

interface KoFiWidgetOverlay {
  draw: (
    pageId: string,
    config: {
      type: 'floating-chat';
      [key: string]: string;
    },
    containerId?: string,
  ) => void;
}

declare global {
  interface Window {
    kofiWidgetOverlay?: KoFiWidgetOverlay;
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadKoFiScript(): Promise<void> {
  if (window.kofiWidgetOverlay) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(KOFI_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = KOFI_SCRIPT_ID;
    script.src = KOFI_SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', reject, { once: true });
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

export function KoFiWidget() {
  const { t } = useI18n();
  const donateButtonText = t('support.button');

  useEffect(() => {
    let active = true;

    loadKoFiScript()
      .then(() => {
        if (!active || !window.kofiWidgetOverlay || !document.getElementById(KOFI_CONTAINER_ID)) {
          return;
        }

        window.kofiWidgetOverlay.draw(
          KOFI_ACCOUNT_ID,
          {
            type: 'floating-chat',
            'floating-chat.donateButton.text': donateButtonText,
            'floating-chat.donateButton.background-color': KOFI_BUTTON_COLOR,
            'floating-chat.donateButton.text-color': '#fff',
          },
          KOFI_CONTAINER_ID,
        );
      })
      .catch((error: unknown) => {
        console.error('Could not load Ko-fi widget.', error);
      });

    return () => {
      active = false;
    };
  }, [donateButtonText]);

  return <div id={KOFI_CONTAINER_ID} />;
}
