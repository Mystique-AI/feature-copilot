import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getCurrentUser } from '../services/api';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="flex w-64 flex-col border-r border-gray-200/10 bg-white dark:bg-[#111a22] p-4">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary"></div>
          <div className="flex flex-col">
            <h1 className="text-black dark:text-white text-base font-medium leading-normal">ProductTrack</h1>
            <p className="text-gray-500 dark:text-[#92adc9] text-sm font-normal leading-normal">AI-Powered Insights</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="mt-6 flex flex-col gap-2 flex-1">
          <Link 
            to="/" 
            className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
              isActive('/') 
                ? 'bg-primary/10 dark:bg-[#233648] text-primary dark:text-white' 
                : 'text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined">space_dashboard</span>
            <p className="text-sm font-medium leading-normal">Dashboard</p>
          </Link>
          <Link 
            to="/knowledge-base" 
            className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
              isActive('/knowledge-base') 
                ? 'bg-primary/10 dark:bg-[#233648] text-primary dark:text-white' 
                : 'text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined">menu_book</span>
            <p className="text-sm font-medium leading-normal">Knowledge Base</p>
          </Link>
          <Link 
            to="/settings" 
            className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
              isActive('/settings') 
                ? 'bg-primary/10 dark:bg-[#233648] text-primary dark:text-white' 
                : 'text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined">settings</span>
            <p className="text-sm font-medium leading-normal">Settings</p>
          </Link>
        </nav>

        {/* User Info & Logout */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          {user && (
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-medium">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black dark:text-white truncate">
                  {user.full_name || 'User'}
                </p>
                <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary capitalize">
                  {user.role}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">logout</span>
            <p className="text-sm font-medium leading-normal">Logout</p>
          </button>
        </div>
      </div>
    </aside>
  );
}
