import { useState, useEffect, useRef } from 'react';
import API from '../api';

export default function Backup() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isAuthorized, setIsAuthorized] = useState(false);

  const notificationTimerRef = useRef(null);

  // Helper function to show notifications safely
  const showNotification = (type, text) => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    setMessage({ type, text });
    notificationTimerRef.current = setTimeout(() => {
      setMessage({ type: '', text: '' });
    }, 5000);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  // 1. Fetch all backup files list
  const fetchBackups = async () => {
    try {
      setFetching(true);
      const response = await API.get('/backups');
      if (response.data && response.data.status === 'success') {
        setBackups(response.data.backups || []);
      }
    } catch (err) {
      console.error('Error fetching backups:', err);
      showNotification('error', 'Failed to load backup list.');
    } finally {
      setFetching(false);
    }
  };

  // Check user role on mount
  useEffect(() => {
    const checkUserRoleAndFetch = async () => {
      try {
        const response = await API.get('/user');
        if (response.data) {
          const roleId = response.data.role_id;
          if ([1, 2, 3].includes(Number(roleId))) {
            setIsAuthorized(true);
            fetchBackups();
          } else {
            setIsAuthorized(false);
            setFetching(false);
            showNotification('error', 'Access denied! Only administrators can manage backups.');
          }
        }
      } catch (err) {
        console.error('Error verifying user role:', err);
        setFetching(false);
        showNotification('error', 'Authentication failed or session expired.');
      }
    };

    checkUserRoleAndFetch();
  }, []);

  // 2. Create a new backup file
  const handleCreateBackup = async () => {
    setLoading(true);
    showNotification('info', 'Creating large backup (5-6 GB), this may take a few minutes. Please do not close the page...');
    try {
      const response = await API.post('/backups/create', {}, {
        timeout: 1800000, // 30 minutes timeout for large backups
      });
      if (response.data && response.data.status === 'success') {
        showNotification('success', response.data.message || 'Backup completed successfully!');
        fetchBackups(); // Refresh the list
      }
    } catch (err) {
      console.error('Error creating backup:', err);
      const errorMsg = err.response?.data?.message || 'Failed to create backup. Server might have timed out.';
      showNotification('error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 3. Delete a backup file
  const handleDelete = async (filename) => {
    if (!filename) return;
    if (!window.confirm('Are you sure you want to delete this large backup file?')) return;

    try {
      const response = await API.delete(`/backups/${filename}`);
      if (response.data && response.data.status === 'success') {
        showNotification('success', 'Backup deleted successfully!');
        fetchBackups();
      }
    } catch (err) {
      console.error('Error deleting backup:', err);
      const errorMsg = err.response?.data?.message || 'Failed to delete the backup file.';
      showNotification('error', errorMsg);
    }
  };

  // 4. Download a backup file securely via Blob & Authorization Header
  const handleDownload = async (filename) => {
    if (!filename) return;
    try {
      showNotification('info', 'Preparing large file download, please wait...');
      const response = await API.get(`/backups/download/${filename}`, {
        responseType: 'blob',
        timeout: 1800000, // 30 minutes timeout for downloading large files
      });

      // Handle JSON error inside Blob response
      if (response.data.type === 'application/json') {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        showNotification('error', errorData.message || 'Failed to download backup file.');
        return;
      }

      const blob = new Blob([response.data]);
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);

      showNotification('success', 'Backup downloaded successfully!');
    } catch (err) {
      console.error('Error downloading backup:', err);
      showNotification('error', 'Failed to download the backup file.');
    }
  };

  if (!isAuthorized && !fetching) {
    return (
      <div className="p-6 max-w-6xl mx-auto text-center">
        <div className="bg-rose-50 text-rose-800 border border-rose-200 p-6 rounded-xl text-sm font-semibold">
          Access Denied: You do not have permission to view or manage system backups.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-white p-6 rounded-t-xl shadow-sm mb-6 gap-4" style={{ backgroundColor: '#417690' }}>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            🗄️ Database & System Backup
          </h1>
          <p className="text-xs text-gray-100 mt-1 opacity-90">
            Securely create and download high-capacity server and database backups.
          </p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={loading}
          className="bg-white text-[#417690] hover:bg-gray-100 px-5 py-2.5 rounded-lg text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-[#417690]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              Processing Large Backup...
            </>
          ) : (
            '⚡ Take New Backup'
          )}
        </button>
      </div>

      {/* Alert / Notification */}
      {message.text && (
        <div
          className={`mb-6 p-4 rounded-lg text-xs font-medium border flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : message.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-sky-50 text-sky-800 border-sky-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Backups Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-600">
            Saved Backup Files ({backups.length})
          </h2>
          <button
            onClick={fetchBackups}
            className="text-xs text-cyan-600 hover:text-cyan-800 font-semibold cursor-pointer"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-white" style={{ backgroundColor: '#417690' }}>
                <th className="p-4 font-semibold rounded-tl-lg">File Name</th>
                <th className="p-4 font-semibold">Size</th>
                <th className="p-4 font-semibold">Created At</th>
                <th className="p-4 font-semibold text-right rounded-tr-lg">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {fetching ? (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-400 text-xs">
                    Loading data...
                  </td>
                </tr>
              ) : backups.length > 0 ? (
                backups.map((file, index) => (
                  <tr key={index} className="hover:bg-gray-50/80 transition">
                    <td className="p-4 font-medium text-gray-700 flex items-center gap-2">
                      📦 {file.name}
                    </td>
                    <td className="p-4 text-gray-500 text-xs">{file.size}</td>
                    <td className="p-4 text-gray-500 text-xs">{file.date}</td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleDownload(file.name)}
                        className="inline-flex items-center gap-1.5 bg-[#417690] hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-md text-xs font-medium transition-all shadow-sm hover:shadow cursor-pointer"
                      >
                        📥 Download
                      </button>
                      <button
                        onClick={() => handleDelete(file.name)}
                        className="inline-flex items-center gap-1.5 bg-[#417690] hover:bg-rose-600 text-white px-3.5 py-1.5 rounded-md text-xs font-medium transition-all shadow-sm hover:shadow cursor-pointer"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-10 text-gray-400 text-xs">
                    No backup files found. Please create a new backup.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}