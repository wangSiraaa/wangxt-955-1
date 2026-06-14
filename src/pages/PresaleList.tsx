import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Users, Plus, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { presaleApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { cn, formatDate, getCountdown } from '../lib/utils.js';
import type { Presale } from '../../shared/types.js';

const statusConfig: Record<Presale['status'], { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  draft: { label: '草稿', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Clock },
  upcoming: { label: '即将开始', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Clock },
  active: { label: '预售中', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  ended: { label: '已结束', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Clock },
  partial_arrived: { label: '部分到货', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: AlertCircle },
  arrived: { label: '已到货', color: 'text-accent-600', bgColor: 'bg-accent-500/10', icon: BookOpen },
};

export default function PresaleList() {
  const { user } = useAuthStore();
  const [presales, setPresales] = useState<Presale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Presale['status'] | 'all'>('all');
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPresales();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadPresales = async () => {
    try {
      const data = await presaleApi.getAll();
      setPresales(data);
      updateCountdownsForList(data);
    } catch (err) {
      console.error('加载预售列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateCountdownsForList = (list: Presale[]) => {
    const newCountdowns: Record<string, string> = {};
    list.forEach((presale) => {
      if (presale.status === 'upcoming') {
        newCountdowns[presale.id] = getCountdown(presale.presaleStartTime);
      } else if (presale.status === 'active') {
        newCountdowns[presale.id] = getCountdown(presale.presaleEndTime);
      }
    });
    setCountdowns(newCountdowns);
  };

  const updateCountdowns = () => {
    updateCountdownsForList(presales);
  };

  const filteredPresales = filter === 'all' 
    ? presales 
    : presales.filter((p) => p.status === filter);

  const filterOptions = [
    { value: 'all', label: '全部' },
    { value: 'upcoming', label: '即将开始' },
    { value: 'active', label: '预售中' },
    { value: 'arrived', label: '已到货' },
    { value: 'ended', label: '已结束' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary-800/20 border-t-primary-800 rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary-800 mb-2">预售书目</h1>
          <p className="text-primary-800/60">精选好书，抢先预订</p>
        </div>
        {user?.role === 'clerk' && (
          <Link
            to="/presales/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-800 text-white rounded-xl font-semibold hover:bg-primary-800/90 transition-all active:scale-[0.98] shadow-lg"
          >
            <Plus className="w-5 h-5" />
            发布预售
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value as typeof filter)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              filter === option.value
                ? 'bg-primary-800 text-white'
                : 'bg-white text-primary-800/70 hover:bg-primary-800/5'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredPresales.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl">
          <BookOpen className="w-16 h-16 text-primary-800/20 mx-auto mb-4" />
          <p className="text-primary-800/50">暂无预售书目</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPresales.map((presale) => {
            const status = statusConfig[presale.status];
            const StatusIcon = status.icon;
            const availableStock = presale.totalStock - presale.lockedStock;
            const soldProgress = ((presale.soldStock + presale.lockedStock) / presale.totalStock) * 100;

            return (
              <Link
                key={presale.id}
                to={`/presales/${presale.id}`}
                className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-primary-800/10 to-accent-500/10 flex items-center justify-center relative">
                  <BookOpen className="w-20 h-20 text-primary-800/30" />
                  <div className="absolute top-4 left-4">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold',
                        status.bgColor,
                        status.color
                      )}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-serif font-bold text-primary-800 mb-2 line-clamp-1 group-hover:text-accent-600 transition-colors">
                    {presale.bookTitle}
                  </h3>
                  <p className="text-primary-800/60 text-sm mb-4 line-clamp-2">
                    {presale.description}
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-accent-600">¥{presale.price}</span>
                        <span className="text-sm text-primary-800/40 line-through">¥{Math.round(presale.price * 1.2 * 100) / 100}</span>
                        <span className="px-2 py-0.5 bg-accent-500/10 text-accent-600 text-xs font-semibold rounded-full">
                          预售特惠
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-primary-800/60">订金 </span>
                        <span className="font-semibold text-primary-800">¥{presale.deposit}</span>
                      </div>
                    </div>

                    <div className="relative h-2 bg-primary-800/10 rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-accent-500 to-accent-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(soldProgress, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-primary-800/60">
                        <Users className="w-4 h-4" />
                        <span>已售 {presale.soldStock + presale.lockedStock}/{presale.totalStock}</span>
                      </div>
                      <span className="text-primary-800/60">
                        剩余 {availableStock}
                      </span>
                    </div>

                    {countdowns[presale.id] && (
                      <div className="flex items-center gap-2 p-3 bg-cream-100 rounded-lg">
                        <Clock className="w-4 h-4 text-accent-600" />
                        <span className="text-sm text-accent-600 font-mono font-semibold">
                          {presale.status === 'upcoming' ? '距开始' : '距结束'} {countdowns[presale.id]}
                        </span>
                      </div>
                    )}

                    {(presale.status === 'active' || presale.status === 'upcoming') && (
                      <div className="flex items-center gap-2 text-sm text-primary-800/60">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {formatDate(presale.presaleStartTime)} - {formatDate(presale.presaleEndTime)}
                        </span>
                      </div>
                    )}

                    {presale.status === 'arrived' && (
                      <div className="flex items-center gap-2 text-sm text-accent-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>取书截止：{formatDate(presale.pickupDeadline)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
