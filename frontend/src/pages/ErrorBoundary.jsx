import React from 'react';

/**
 * সাদা/ব্ল্যাংক স্ক্রিন প্রতিরোধ করার জন্য Error Boundary।
 * কোনো অপ্রত্যাশিত JS error হলে পুরো অ্যাপ crash করে সাদা হয়ে যাওয়ার বদলে
 * এখানে একটা বন্ধুত্বপূর্ণ মেসেজ ও "আবার চেষ্টা করুন" বাটন দেখাবে।
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // ডেভেলপমেন্টে ডিবাগ করার জন্য কনসোলে লগ থাকবে
    // eslint-disable-next-line no-console
    console.error('Application crashed:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-lg shadow-sm p-6 text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <h1 className="text-lg font-bold text-red-600 mb-2">কিছু একটা সমস্যা হয়েছে!</h1>
            <p className="text-sm text-gray-600 mb-4">
              অপ্রত্যাশিত একটি এরর হয়েছে। নিচের বাটনে ক্লিক করে আবার চেষ্টা করুন। সমস্যা থেকেই গেলে
              ব্রাউজারের কনসোল (F12 চেপে Console ট্যাব দেখুন) চেক করুন এবং ডেভেলপারকে জানান।
            </p>
            {this.state.error?.message && (
              <p className="text-[10px] text-gray-400 mb-4 break-all font-mono">
                {String(this.state.error.message)}
              </p>
            )}
            <button
              onClick={this.handleReset}
              type="button"
              className="bg-[#417690] hover:bg-[#345e73] text-white px-4 py-2 rounded text-sm font-semibold"
            >
              আবার চেষ্টা করুন
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;