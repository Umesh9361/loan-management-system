import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: string;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || "Unknown error" };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("PageErrorBoundary:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-xl shadow-lg p-6 max-w-md w-full text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-lg font-bold text-red-800">{this.props.title || "पेज लोड त्रुटी"}</h2>
            <p className="text-sm text-gray-600">{this.state.error}</p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  try { localStorage.removeItem("inventory_scan_session"); } catch {}
                  this.setState({ hasError: false, error: "" });
                }}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium"
              >
                पुन्हा प्रयत्न करा
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium"
              >
                Page Reload करा
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
