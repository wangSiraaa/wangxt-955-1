import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  Users,
  Calendar,
  CheckCircle,
  AlertCircle,
  Minus,
  Plus,
  ShoppingCart,
  CreditCard,
  ArrowLeft,
  Edit,
} from 'lucide-react';
import { presaleApi, orderApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { cn, formatDate, getCountdown } from '../lib/utils.js';
import type { Presale } from '../../shared/types.js';

const statusConfig: Record<Presale['status'], { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  draft: { label: '草稿', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Clock },
  upcoming: { label: '即将开始', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Clock },
  active: { label: '预售中', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  ended: { label: '已结束', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Clock },
  arrived: { label: '已到货', color: 'text-accent-600', bgColor: 'bg-accent-500/10', icon: BookOpen },
};

export default function PresaleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [presale, setPresale] = useState<Presale | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [availability, setAvailability] = useState<{
    available: boolean;
    message: string;
  }>({ available: false, message: '' });

  useEffect(() => {
    loadPresale();
  }, [id]);

  useEffect(() => {
    if (!presale) return;

    const updateCountdown = () => {
      if (presale.status === 'upcoming') {
        setCountdown(getCountdown(presale.presaleStartTime));
      } else if (presale.status === 'active') {
        setCountdown(getCountdown(presale.presaleEndTime));
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [presale]);

  useEffect(() => {
    if (presale && user?.role === 'member') {
      checkAvailability();
    }
  }, [presale, quantity]);

  const loadPresale = async () => {
    if (!id) return;
    try {
      const data = await presaleApi.getById(id);
      setPresale(data);
    } catch (err) {
      console.error('加载预售详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkAvailability = async () => {
    if (!presale) return;
    try {
      const result = await presaleApi.checkAvailability(presale.id, quantity);
      setAvailability({ available: result.available, message: result.message });
    } catch (err) {
      setAvailability({ available: false, message: '检查库存失败' });
    }
  };

  const handleReserve = async () => {
    if (!presale || !availability.available) return;
    setActionLoading(true);

    try {
      const order = await orderApi.create({
        presaleId: presale.id,
        quantity,
      });
      navigate(`/orders/${order.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '预订失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary-800/20 border-t-primary-800 rounded-full" />
      </div>
    );
  }

  if (!presale) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-16 h-16 text-primary-800/20 mx-auto mb-4" />
        <p className="text-primary-800/50 mb-4">预售不存在</p>
        <button
          onClick={() => navigate('/presales')}
          className="text-accent-600 hover:underline"
        >
          返回列表
        </button>
      </div>
    );
  }

  const status = statusConfig[presale.status];
  const StatusIcon = status.icon;
  const availableStock = presale.totalStock - presale.lockedStock;
  const soldProgress = ((presale.soldStock + presale.lockedStock) / presale.totalStock) * 100;
  const depositTotal = presale.deposit * quantity;
  const totalAmount = presale.price * quantity;

  return (
    <div>
      <button
        onClick={() => navigate('/presales')}
        className="inline-flex items-center gap-2 text-primary-800/60 hover:text-primary-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        返回预售列表
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="aspect-[16/9] bg-gradient-to-br from-primary-800/10 to-accent-500/10 flex items-center justify-center relative">
              <BookOpen className="w-32 h-32 text-primary-800/30" />
              <div className="absolute top-6 left-6">
                <span
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold',
                    status.bgColor,
                    status.color
                  )}
                >
                  <StatusIcon className="w-4 h-4" />
                  {status.label}
                </span>
              </div>
            </div>

            <div className="p-8">
              <h1 className="text-3xl font-serif font-bold text-primary-800 mb-3">
                {presale.bookTitle}
              </h1>

              <div className="flex flex-wrap items-center gap-4 mb-6">
                <span className="text-3xl font-bold text-accent-600">¥{presale.price}</span>
                <span className="text-lg text-primary-800/40 line-through">¥{Math.round(presale.price * 1.2 * 100) / 100}</span>
                <span className="px-2 py-1 bg-red-50 text-red-600 text-sm font-semibold rounded">
                  预售特惠
                </span>
              </div>

              <div className="prose prose-primary max-w-none mb-8">
                <h3 className="text-lg font-semibold text-primary-800 mb-3">内容简介</h3>
                <p className="text-primary-800/70 leading-relaxed">{presale.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-6 bg-cream-100 rounded-xl">
                <div>
                  <div className="text-sm text-primary-800/60 mb-1">预售时间</div>
                  <div className="font-semibold text-primary-800">
                    {formatDate(presale.presaleStartTime)} - {formatDate(presale.presaleEndTime)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-primary-800/60 mb-1">取书截止</div>
                  <div className="font-semibold text-primary-800">
                    {formatDate(presale.pickupDeadline)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-primary-800/60 mb-1">总库存</div>
                  <div className="font-semibold text-primary-800">{presale.totalStock} 本</div>
                </div>
                <div>
                  <div className="text-sm text-primary-800/60 mb-1">已售出</div>
                  <div className="font-semibold text-primary-800">
                    {presale.soldStock + presale.lockedStock} 本
                  </div>
                </div>
              </div>

              {countdown && (
                <div className="mt-6 p-4 bg-gradient-to-r from-accent-500/10 to-accent-500/5 rounded-xl border border-accent-500/20">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-accent-600" />
                    <div>
                      <div className="text-sm text-primary-800/60">
                        {presale.status === 'upcoming' ? '距离预售开始' : '距离预售结束'}
                      </div>
                      <div className="text-xl font-mono font-bold text-accent-600">{countdown}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-md p-6 sticky top-8">
            <h3 className="text-lg font-semibold text-primary-800 mb-6">预订信息</h3>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between py-3 border-b border-primary-800/10">
                <span className="text-primary-800/60">预售单价</span>
                <span className="font-semibold text-primary-800">¥{presale.price}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-primary-800/10">
                <span className="text-primary-800/60">订金</span>
                <span className="font-semibold text-accent-600">¥{presale.deposit}/本</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-primary-800/10">
                <span className="text-primary-800/60">剩余库存</span>
                <span className="font-semibold text-primary-800">{availableStock} 本</span>
              </div>

              <div className="flex items-center justify-between py-3">
                <span className="text-primary-800/60">预订数量</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1 || presale.status !== 'active'}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-primary-800/20 text-primary-800/60 hover:bg-primary-800/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-semibold text-primary-800">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                    disabled={quantity >= availableStock || presale.status !== 'active'}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-primary-800/20 text-primary-800/60 hover:bg-primary-800/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="relative h-2 bg-primary-800/10 rounded-full overflow-hidden mb-4">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-accent-500 to-accent-600 rounded-full"
                style={{ width: `${Math.min(soldProgress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm text-primary-800/60 mb-6">
              <span>已售 {presale.soldStock + presale.lockedStock}</span>
              <span>剩余 {availableStock}</span>
            </div>

            {user?.role === 'member' && availability.message && (
              <div
                className={cn(
                  'p-3 rounded-lg text-sm mb-4 flex items-start gap-2',
                  availability.available
                    ? 'bg-green-50 text-green-600'
                    : 'bg-amber-50 text-amber-600'
                )}
              >
                {availability.available ? (
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                {availability.message}
              </div>
            )}

            <div className="p-4 bg-cream-100 rounded-xl mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-primary-800/60">应付订金</span>
                <span className="text-2xl font-bold text-accent-600">¥{depositTotal}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary-800/60">尾款</span>
                <span className="text-primary-800/60">¥{totalAmount - depositTotal}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-primary-800/60">合计</span>
                <span className="font-semibold text-primary-800">¥{totalAmount}</span>
              </div>
            </div>

            {user?.role === 'member' && (
              <button
                onClick={handleReserve}
                disabled={!availability.available || actionLoading}
                className={cn(
                  'w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all',
                  availability.available && !actionLoading
                    ? 'bg-primary-800 text-white hover:bg-primary-800/90 active:scale-[0.98] shadow-lg'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
                    处理中...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    立即预订
                  </>
                )}
              </button>
            )}

            {user?.role === 'clerk' && (
              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/presales/${presale.id}/edit`)}
                  className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 bg-primary-800/10 text-primary-800 hover:bg-primary-800/20 transition-all"
                >
                  <Edit className="w-5 h-5" />
                  编辑预售
                </button>
                {presale.status !== 'arrived' && (
                  <button
                    onClick={async () => {
                      if (confirm('确定标记为已到货？')) {
                        await presaleApi.markAsArrived(presale.id);
                        loadPresale();
                      }
                    }}
                    className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 bg-accent-500/10 text-accent-600 hover:bg-accent-500/20 transition-all"
                  >
                    <CheckCircle className="w-5 h-5" />
                    标记到货
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
