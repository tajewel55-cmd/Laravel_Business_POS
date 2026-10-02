import { useState, useEffect } from 'react';
import axios from 'axios';

// Small inline SVG icon for button
const IconPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconRefresh = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.23-5.23" />
  </svg>
);

const BRAND = '#417690';
const BRAND_DARK = '#2f5163';

export default function CompanyProfile() {
  const [formData, setFormData] = useState({
    company_name: '',
    mobile: '',
    mail: '',
    address: ''
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-hide success or error messages after 2 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchCompanyProfile = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/company-profile', getAuthHeaders());
      if (response.data.data) {
        setFormData(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching company profile', err);
      setError('Failed to load company profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyProfile();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/company-profile', formData, getAuthHeaders());
      setSuccess(response.data.message || 'Company profile updated successfully!');
      if (response.data.data) {
        setFormData(response.data.data);
      }
    } catch (err) {
      console.error('Error saving company profile', err);
      setError(err.response?.data?.message || 'Failed to update company profile. Please check the inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    fetchCompanyProfile();
    setError('');
    setSuccess('Form reloaded with current data.');
  };

  if (loading) {
    return <div className="text-center p-6 text-gray-600">Loading Company Profile...</div>;
  }

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#417690]';
  const labelCls = 'block text-sm font-semibold text-gray-800';

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 bg-white shadow-sm rounded-lg mt-6 border border-gray-200">
      {/* Top header bar */}
      <div
        className="rounded-t-md shadow-md flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3 mb-6"
        style={{ background: BRAND }}
      >
        <h1 className="text-base sm:text-lg font-bold text-white tracking-wide text-center sm:text-left">
          Company Profile Management
        </h1>

        <div className="flex-1 px-2 text-center">
          {error && <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded shadow-sm inline-block font-medium">{error}</span>}
          {success && <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded shadow-sm inline-block font-medium">{success}</span>}
        </div>
      </div>

      {/* Form Section with Two Cards */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Card: Company Basic Information */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div className="text-white text-center font-semibold py-2.5 px-4 text-sm tracking-wide" style={{ background: BRAND }}>
              Company Basic Information
            </div>
            <div className="p-4 bg-white flex flex-col gap-4">
              <div className="grid grid-cols-3 items-center gap-2">
                <label className={labelCls}>Company Name *</label>
                <div className="col-span-2">
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    required
                    className={inputCls}
                    placeholder="Enter company name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 items-center gap-2">
                <label className={labelCls}>Mobile Number</label>
                <div className="col-span-2">
                  <input
                    type="text"
                    name="mobile"
                    value={formData.mobile || ''}
                    onChange={handleChange}
                    className={inputCls}
                    placeholder="Enter mobile number"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Card: Contact & Address Information */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div className="text-white text-center font-semibold py-2.5 px-4 text-sm tracking-wide" style={{ background: BRAND }}>
              Contact & Address Information
            </div>
            <div className="p-4 bg-white flex flex-col gap-4">
              <div className="grid grid-cols-3 items-center gap-2">
                <label className={labelCls}>Email Address</label>
                <div className="col-span-2">
                  <input
                    type="email"
                    name="mail"
                    value={formData.mail || ''}
                    onChange={handleChange}
                    className={inputCls}
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 items-start gap-2 pt-1">
                <label className={`${labelCls} pt-2`}>Address</label>
                <div className="col-span-2">
                  <textarea
                    name="address"
                    rows="3"
                    value={formData.address || ''}
                    onChange={handleChange}
                    className={inputCls}
                    placeholder="Enter company address"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Action bar with Centered Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 py-3 px-4 mt-6 rounded shadow-md" style={{ background: BRAND }}>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded text-white text-xs font-semibold hover:opacity-90 transition shadow"
            style={{ background: BRAND_DARK }}
          >
            <IconPlus size={14} />
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded text-white text-xs font-semibold hover:opacity-90 transition shadow"
            style={{ background: BRAND_DARK }}
          >
            <IconRefresh size={14} />
            Reset / Reload
          </button>
        </div>
      </form>
    </div>
  );
}