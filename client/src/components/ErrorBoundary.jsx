import React from 'react';
import PropTypes from 'prop-types';

/**
 * Captura errores de render/efectos de sus hijos para que un fallo (p. ej. en la
 * capa PixiJS) no deje toda la aplicación en blanco ni provoque el cierre del
 * WebSocket por desmontaje del árbol de React.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Error capturado:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback || (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: '#1a1a2e', color: '#f88', fontFamily: 'monospace',
            padding: 24, textAlign: 'center', zIndex: 50
          }}>
            <h3>⚠️ Error en el renderizado</h3>
            <p style={{ color: '#aaa', fontSize: 12, marginTop: 8, maxWidth: 480 }}>
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                marginTop: 16, padding: '6px 16px', background: '#5588cc',
                border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer',
                fontFamily: 'monospace'
              }}>
              Reintentar
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
  fallback: PropTypes.node,
};
