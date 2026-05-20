interface LoadingViewProps {
  message?: string;
}

export function LoadingView({ message = 'Cargando…' }: LoadingViewProps) {
  return (
    <main className="centered-page">
      <div className="panel loading-panel">{message}</div>
    </main>
  );
}
