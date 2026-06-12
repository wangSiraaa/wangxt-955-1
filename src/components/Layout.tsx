import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Book, ShoppingCart, Package, LogOut, Bell, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import { notificationApi } from '../api/endpoints.js';
import { cn } from '../lib/utils.js';

const navItems = [
  { path: '/presales', label: '预售', icon: Book, roles: ['clerk', 'member', 'warehouse'] },
  { path: '/orders', label: '订单', icon: ShoppingCart, roles: ['clerk', 'member', 'warehouse'] },
  { path: '/pickup', label: '取书', icon: Package, roles: ['clerk', 'warehouse', 'member'] },
];

export default function Layout() {
  const { user, logout, token } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (token) {
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const loadUnreadCount = async () => {
    try {
      const result = await notificationApi.getUnreadCount();
      setUnreadCount(result.unreadCount);
    } catch (err) {
      console.error('加载未读消息数失败:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter((item) =>
    user ? item.roles.includes(user.role) : true
  );

  const roleLabels: Record<string, string> = {
    clerk: '店员',
    member: '会员',
    warehouse: '仓管',
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="bg-primary-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Book className="w-8 h-8 text-accent-500" />
            <h1 className="text-2xl font-serif font-bold">三味书屋</h1>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {filteredNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
                  location.pathname.startsWith(item.path)
                    ? 'bg-accent-500 text-primary-800 font-semibold'
                    : 'hover:bg-white/10'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <Link
                  to="/notifications"
                  className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  <User className="w-4 h-4" />
                  <span>{user.name}</span>
                  <span className="text-accent-500">({roleLabels[user.role]})</span>
                </div>
              </>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>
        <nav className="md:hidden border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-2 flex justify-around">
            {filteredNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all',
                  location.pathname.startsWith(item.path)
                    ? 'text-accent-500'
                    : 'text-white/70'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="bg-primary-800/50 text-white/70 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>三味书屋 · 让阅读成为一种生活方式</p>
          <p className="mt-1">© 2025 三味书屋预售系统</p>
        </div>
      </footer>
    </div>
  );
}
