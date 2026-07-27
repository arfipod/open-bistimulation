import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import { ErrorView } from './ErrorView';

interface BoundaryProps {
  children: ReactNode;
  title: string;
  message: string;
}

interface BoundaryState {
  failed: boolean;
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unexpected application error', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return <ErrorView title={this.props.title} message={this.props.message} />;
    }

    return this.props.children;
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <Boundary title={t('app.unexpectedErrorTitle')} message={t('app.unexpectedErrorMessage')}>
      {children}
    </Boundary>
  );
}
