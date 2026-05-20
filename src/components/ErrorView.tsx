interface ErrorViewProps {
  title?: string;
  message: string;
}

export function ErrorView({ title = 'No se pudo abrir la sesión', message }: ErrorViewProps) {
  return (
    <main className="centered-page">
      <div className="panel error-panel">
        <h1>{title}</h1>
        <p>{message}</p>
        <a className="secondary-button inline-link-button" href="/">
          Volver al inicio
        </a>
      </div>
    </main>
  );
}
