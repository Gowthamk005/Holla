import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty" style={{ padding: 40 }}>
        <h2>This page could not load</h2>
        <p className="muted">Try reloading. If it happens again, tell me which page you were on.</p>
        <button className="pill" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}