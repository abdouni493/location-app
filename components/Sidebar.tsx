
import React from 'react';
import { MENU_ITEMS } from '../constants';
import { Language, User } from '../types';

interface SidebarProps {
  isOpen: boolean;
  activeId: string;
  onNavigate: (id: string) => void;
  lang: Language;
  onToggle: () => void;
  user: User;
  storeName?: string;
  logo?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, activeId, onNavigate, lang, onToggle, user, storeName = 'DriveFlow', logo = '' }) => {
  const isRtl = lang === 'ar';
  const isAdmin = user.role === 'admin';
  const isDriver = user.role === 'driver';

  // Filter menu items based on role
  const filteredMenuItems = MENU_ITEMS.filter(item => {
    if (isDriver) {
      // Very restricted for drivers
      return ['dashboard', 'planner'].includes(item.id);
    }
    if (!isAdmin) {
      // Restricted items for workers (non-admin, non-driver)
      const restricted = ['agencies', 'team', 'reports', 'config', 'ai_analysis'];
      return !restricted.includes(item.id);
    }
    return true;
  });

  // Add "My Payments" for non-admin only
  const finalMenu = [...filteredMenuItems];
  if (!isAdmin) {
    finalMenu.push({
      id: 'my_payments',
      labelFr: 'Mes Paiements',
      labelAr: 'مدفوعاتي',
      icon: '💳'
    });
  }

  return (
    <aside 
      className={`
        fixed inset-y-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-all duration-500 ease-in-out overflow-hidden
        ${isRtl ? 'right-0' : 'left-0'}
        ${isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 pointer-events-none'}
        md:relative md:translate-x-0 md:opacity-100 md:pointer-events-auto
        ${!isOpen && 'lg:w-0 lg:border-none lg:p-0'}
      `}
    >
      <div className="flex items-center justify-between h-20 px-6 border-b border-gray-100 min-w-[288px] whitespace-nowrap gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {logo && (
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-600 to-red-600 flex items-center justify-center shadow-lg border-2 border-white">
              <img src={logo} className="w-full h-full object-cover" alt="Logo" />
            </div>
          )}
          {!logo && (
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-600 to-red-600 flex items-center justify-center shadow-lg border-2 border-white text-white font-black text-lg">
              DF
            </div>
          )}
          <span className={`text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-red-600 ${isRtl ? 'font-arabic' : ''} truncate`}>
            {storeName}
          </span>
        </div>
        <button 
          onClick={onToggle}
          className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-all duration-300 flex-shrink-0"
        >
          <span className="text-xl font-bold">✕</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 scrollbar-hide min-w-[288px]">
        <ul className="space-y-2 px-4">
          {finalMenu.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                className={`
                  w-full flex items-center p-4 rounded-2xl transition-all duration-300 group
                  ${activeId === item.id 
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 shadow-sm border border-blue-100' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                  }
                  ${isRtl ? 'flex-row-reverse space-x-reverse' : ''}
                `}
              >
                <span className="text-2xl transform transition-transform group-hover:scale-110">{item.icon}</span>
                <span className={`mx-4 text-sm font-bold tracking-tight ${isRtl ? 'font-arabic' : ''}`}>
                  {lang === 'fr' ? item.labelFr : item.labelAr}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-6 border-t border-gray-100 min-w-[288px]">
        <div className={`flex items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-red-600 flex items-center justify-center text-white text-lg font-black shadow-lg">
            {user.username.substring(0, 2).toUpperCase()}
          </div>
          <div className={`mx-4 ${isRtl ? 'text-right' : ''}`}>
            <p className="text-sm font-black text-gray-900 capitalize">{user.username}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{user.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
