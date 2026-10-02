import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

import ErrorBoundary from './pages/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Roles from './pages/Roles';
import Users from './pages/Users';
import Menus from './pages/Menus';
import Permissions from './pages/Permissions';
import CompanyProfile from './pages/CompanyProfile';
import TimeSettings from './pages/TimeSettings';
import PackSize from './pages/PackSize';
import Category from './pages/Category';
import Manufacturer from './pages/Manufacturer';
import Supplier from './pages/Supplier';
import Product from './pages/Product';
import Purchase from './pages/Purchase';
import Purchase_print from './pages/Purchase_print';
import Sale from './pages/Sale';
import Sale_print from './pages/Sale_print';
import Adjustment from './pages/Adjustment';

import Report_Stock from './pages/Report_Stock';
import Report_Salesqty from './pages/Report_Salesqty';
import Report_Profitqty from './pages/Report_Profitqty';
import Report_Salesinvoice from './pages/Report_Salesinvoice';
import Report_Salesvolume from './pages/Report_Salesvolume';
import AdminLayout from './components/AdminLayout';

import PurchaseDue from './pages/PurchaseDue';
import SaleDue from './pages/SaleDue';
import Backup from "./pages/Backup";

const API_BASE_URL = 'http://127.0.0.1:8000/api';

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      axios
        .get(`${API_BASE_URL}/user`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('auth_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-white text-gray-600">Loading BusinessPOS...</div>;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Public login route */}
          <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/dashboard" />} />

          {/* Protected Layout Route */}
          <Route element={user ? <AdminLayout user={user} setUser={setUser} /> : <Navigate to="/login" />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/users" element={<Users />} />
            <Route path="/menus" element={<Menus />} />
            <Route path="/permissions" element={<Permissions />} />
            <Route path="/company-profile" element={<CompanyProfile />} />
            <Route path="/time-settings" element={<TimeSettings />} />
            <Route path="/pack-sizes" element={<PackSize />} />
            <Route path="/categories" element={<Category />} />
            <Route path="/manufacturers" element={<Manufacturer />} />
            <Route path="/suppliers" element={<Supplier />} />
            <Route path="/products" element={<Product />} />
            <Route path="/purchases" element={<Purchase />} />
            <Route path="/purchases/print/:id" element={<Purchase_print />} />
            <Route path="/sales" element={<Sale />} />
            <Route path="/sales/print/:id" element={<Sale_print />} />
            <Route path="/adjustments" element={<Adjustment />} />

            <Route path="/reports/stock" element={<Report_Stock />} />
            <Route path="/reports/sales-qty" element={<Report_Salesqty />} /> 
            <Route path="/reports/profit-qty" element={<Report_Profitqty />} /> 
            <Route path="/reports/sales-invoice" element={<Report_Salesinvoice />} />  
            <Route path="/reports/sales-volume" element={<Report_Salesvolume />} /> 

            <Route path="/purchases/due" element={<PurchaseDue />} />
            <Route path="/sales/due" element={<SaleDue />} />  
            <Route path="/backups" element={<Backup />}/>                                             
          </Route>

          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;