import React from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Orizon TV] Erro capturado pelo ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0a0d14',
          color: '#f8fafc',
          padding: '30px',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            color: '#ef4444'
          }}>
            <AlertTriangle size={36} />
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px', color: '#ffffff' }}>
            Ops! Algo inesperado aconteceu
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '520px', lineHeight: '1.6', marginBottom: '24px' }}>
            A interface encontrou um erro durante o processamento. Você pode tentar recarregar ou limpar as preferências salvas.
          </p>

          <div style={{
            background: '#131722',
            border: '1px solid #242c3d',
            borderRadius: '12px',
            padding: '16px',
            maxWidth: '680px',
            width: '100%',
            textAlign: 'left',
            marginBottom: '24px',
            overflowX: 'auto',
            fontSize: '12px',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#ef4444'
          }}>
            <div style={{ fontWeight: '700', marginBottom: '6px' }}>
              {this.state.error?.toString()}
            </div>
            {this.state.errorInfo?.componentStack && (
              <pre style={{ margin: 0, color: '#64748b', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 22px',
                background: '#0284c7',
                border: 'none',
                borderRadius: '10px',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} /> Recarregar
            </button>
            <button
              onClick={this.handleResetAndReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 22px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '10px',
                color: '#cbd5e1',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={16} /> Limpar Cache e Reiniciar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

