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
    
    // যদি অভিভাবক কম্পোনেন্ট থেকে অন-রিসেট হ্যান্ডলার প্রপস হিসেবে দেওয়া থাকে
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    } else {
      // স্টেট পরিবর্তন করার পর অ্যাপ পুনরায় ক্র্যাশ করা এড়াতে লাইভ/প্রোডাকশনে পেজ রিফ্রেশ দেওয়া নিরাপদ
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // ডেভেলপমেন্ট এনভায়রনমেন্ট চেক (Vite অথবা CRA/Webpack উভয় সাপোর্ট করে)
      const isDevelopment =
        (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') ||
        (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV);

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-lg shadow-sm p-6 text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <h1 className="text-lg font-bold text-red-600 mb-2">কিছু একটা সমস্যা হয়েছে!</h1>
            <p className="text-sm text-gray-600 mb-4">
              অপ্রত্যাশিত একটি এরর হয়েছে। নিচের বাটনে ক্লিক করে আবার চেষ্টা করুন। সমস্যা থেকেই গেলে
              ব্রাউজারের কনসোল (F12 চেপে Console ট্যাব দেখুন) চেক করুন এবং ডেভেলপারকে জানান।
            </p>

            {/* সিকিউরিটি নিশ্চিত করতে শুধুমাত্র ডেভেলপমেন্ট এনভায়রনমেন্টেই এরর মেসেজটি দেখানো হবে */}
            {isDevelopment && this.state.error?.message && (
              <p className="text-[10px] text-gray-400 mb-4 break-all font-mono bg-gray-50 p-2 rounded border border-gray-100">
                {String(this.state.error.message)}
              </p>
            )}

            <button
              onClick={this.handleReset}
              type="button"
              className="bg-[#417690] hover:bg-[#345e73] text-white px-4 py-2 rounded text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#417690] focus:ring-offset-1"
            >
              আবার চেষ্টা করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children || null;
  }
}

export default ErrorBoundary;