import { Component } from 'react';
import { Heart, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
          <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-md">
            <Heart size={22} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-foreground">Ối, có gì đó không ổn 💔</h1>
            <p className="text-sm text-muted-foreground mt-1">Ứng dụng gặp lỗi bất ngờ. Thử tải lại nhé.</p>
          </div>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-4 py-2 rounded-full gradient-primary text-white text-sm font-semibold shadow-md hover:opacity-90 active:scale-95 transition-all"
          >
            <RefreshCw size={14} /> Tải lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
