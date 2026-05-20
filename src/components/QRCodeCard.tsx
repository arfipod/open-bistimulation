import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { copyToClipboard } from '../lib/url';

interface QRCodeCardProps {
  title: string;
  url: string;
  helper: string;
}

export function QRCodeCard({ title, url, helper }: QRCodeCardProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, { width: 180, margin: 1 }).then((next) => {
      if (active) {
        setDataUrl(next);
      }
    });

    return () => {
      active = false;
    };
  }, [url]);

  const handleCopy = async () => {
    await copyToClipboard(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className="qr-card">
      <h3>{title}</h3>
      {dataUrl ? <img src={dataUrl} alt={`QR ${title}`} /> : <div className="qr-placeholder">Generando QR…</div>}
      <p>{helper}</p>
      <button className="secondary-button" type="button" onClick={handleCopy}>
        {copied ? 'Copiado' : 'Copiar enlace'}
      </button>
    </article>
  );
}
