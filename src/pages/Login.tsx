import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, Lock, User } from 'lucide-react';
import { authApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { cn } from '../lib/utils.js';

type Role = 'clerk' | 'member' | 'warehouse';

const roleOptions: { value: Role; label: string; description: string }[] = [
  { value: 'clerk', label: '店员', description: '发布预售、管理订单' },
  { value: 'member', label: '会员', description: '预订书籍、支付订金' },
  { value: 'warehouse', label: '仓管', description: '登记到货、确认取书' },
];

const testAccounts: Record<Role, { username: string; password: string }> = {
  clerk: { username: 'clerk001', password: 'password' },
  member: { username: 'member001', password: 'password' },
  warehouse: { username: 'warehouse001', password: 'password' },
};

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [role, setRole] = useState<Role>('member');
  const [username, setUsername] = useState(testAccounts.member.username);
  const [password, setPassword] = useState(testAccounts.member.password);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleSelect = (selectedRole: Role) => {
    setRole(selectedRole);
    setUsername(testAccounts[selectedRole].username);
    setPassword(testAccounts[selectedRole].password);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authApi.login({ username, password, role });
      login(result.token, result.user);
      navigate('/presales');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-800 rounded-full mb-4">
            <Book className="w-8 h-8 text-accent-500" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-primary-800 mb-2">三味书屋</h1>
          <p className="text-primary-800/60">会员预售系统</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {roleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleRoleSelect(option.value)}
              className={cn(
                'p-4 rounded-xl border-2 transition-all duration-200 text-center',
                role === option.value
                  ? 'border-accent-500 bg-accent-500/10 shadow-md'
                  : 'border-primary-800/20 hover:border-primary-800/40'
              )}
            >
              <div
                className={cn(
                  'font-semibold mb-1',
                  role === option.value ? 'text-primary-800' : 'text-primary-800/70'
                )}
              >
                {option.label}
              </div>
              <div className="text-xs text-primary-800/50">{option.description}</div>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-primary-800 mb-6 text-center">
            用户登录
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-800/80 mb-2">
                用户名
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-800/40" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-primary-800/20 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none"
                  placeholder="请输入用户名"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-800/80 mb-2">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-800/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-primary-800/20 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none"
                  placeholder="请输入密码"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full py-3 bg-primary-800 text-white rounded-lg font-semibold transition-all duration-200',
                loading
                  ? 'opacity-70 cursor-not-allowed'
                  : 'hover:bg-primary-800/90 active:scale-[0.98]'
              )}
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </div>

          <div className="mt-6 p-4 bg-cream-100 rounded-lg">
            <p className="text-xs text-primary-800/60 text-center">
              测试账号已自动填充，密码均为 <code className="bg-white px-1 rounded">password</code>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
