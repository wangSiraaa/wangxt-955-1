import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  CreditCard,
  Package,
  AlertTriangle,
  BookOpen,
  Unlock,
  RefreshCw,
} from 'lucide-react';
import { orderApi, presaleApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { cn, formatDate, formatDateTime } from '../lib/utils.js';
import type { Order, Presale } from '../../shared/types.js';
import dayjs from 'dayjs';

const paymentStatusConfig: Record<Order['paymentStatus'], { label: string; color: string; icon: typeof CreditCard }> = {
  unpaid: { label: '待支付', color: 'text-amber-600', icon: CreditCard },
  paid: { label: '已支付', color: 'text-green-600', icon: CheckCircle },
  refunded: { label: '已退款', color: 'text-gray-500', icon: XCircle },
  partial_refunded: { label: '部分退款', color: 'text-orange-600', icon: RefreshCw },
};

const pickupStatusConfig: Record<Order['pickupStatus'], { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: '待到货', color: 'text-blue-600', icon: Clock },
  ready: { label: '待取书', color: 'text-accent-600', icon: Package },
  picked: { label: '已取书', color: 'text-green-600', icon: CheckCircle },
  expired: { label: '已取消', color: 'text-red-600', icon: XCircle },
  waitlisted: { label: '候补中', color: 'text-purple-600', icon: Clock },
  transferred: { label: '已转单', color: 'text-teal-600', icon: RefreshCw },
};

const getOrderDisplayStatus = (order: Order, presale?: Presale): { label: string; color: string; bgColor: string; icon: typeof Clock; isOverdue: boolean } => {
  const isOverdue = presale && order.paymentStatus === 'paid' 
    && order.pickupStatus !== 'picked' && order.pickupStatus !== 'expired'
    && dayjs().isAfter(dayjs(presale.pickupDeadline));

  if (order.pickupStatus === 'expired') {
    return { label: '已取消', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: XCircle, isOverdue: false };
  }
  
  if (isOverdue) {
    return { label: '已逾期', color: 'text-red-600', bgColor: 'bg-red-50', icon: AlertTriangle, isOverdue: true };
  }

  const config = pickupStatusConfig[order.pickupStatus];
  const bgColor = config.color === 'text-accent-600' ? 'bg-accent-500/10' 
    : config.color === 'text-green-600' ? 'bg-green-50' 
    : 'bg-blue-50';
  return { ...config, bgColor, isOverdue: false };
};

export default function OrderList() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [presales, setPresales] = useState<Record<string, Presale>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid' | 'picked' | 'expired' | 'cancelled'>('all');
  const [expireLoading, setExpireLoading] = useState<string | null>(null);
  const [batchReleaseLoading, setBatchReleaseLoading] = useState(false);

  const isStaff = user?.role === 'clerk' || user?.role === 'warehouse';

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const [ordersData, presalesData] = await Promise.all([
        orderApi.getAll(),
        presaleApi.getAll(),
      ]);
      setOrders(ordersData);
      const presaleMap: Record<string, Presale> = {};
      presalesData.forEach((p) => {
        presaleMap[p.id] = p;
      });
      setPresales(presaleMap);
    } catch (err) {
      console.error('加载订单列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const isOrderOverdue = (order: Order): boolean => {
    const presale = presales[order.presaleId];
    if (!presale) return false;
    if (order.pickupStatus === 'picked' || order.pickupStatus === 'expired') return false;
    if (order.paymentStatus !== 'paid') return false;
    return dayjs().isAfter(dayjs(presale.pickupDeadline));
  };

  const getOverdueOrders = (): Order[] => {
    return orders.filter(
      (o) => o.paymentStatus === 'paid' && o.pickupStatus !== 'picked' && o.pickupStatus !== 'expired' && isOrderOverdue(o)
    );
  };

  const handleExpireOrder = async (orderId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('确认要释放该逾期订单的库存吗？')) return;
    
    setExpireLoading(orderId);
    try {
      await orderApi.expireOrder(orderId);
      await loadOrders();
      alert('订单已成功释放');
    } catch (err) {
      alert(err instanceof Error ? err.message : '释放失败');
    } finally {
      setExpireLoading(null);
    }
  };

  const handleBatchRelease = async () => {
    const overdueCount = getOverdueOrders().length;
    if (overdueCount === 0) {
      alert('没有需要释放的逾期订单');
      return;
    }
    if (!confirm(`确认要释放 ${overdueCount} 个逾期订单的库存吗？`)) return;
    
    setBatchReleaseLoading(true);
    try {
      const result = await orderApi.releaseExpired();
      await loadOrders();
      alert(`成功释放 ${result.count} 个逾期订单`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '批量释放失败');
    } finally {
      setBatchReleaseLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'unpaid') return order.paymentStatus === 'unpaid';
    if (filter === 'paid') return order.paymentStatus === 'paid' && order.pickupStatus !== 'picked' && order.pickupStatus !== 'expired';
    if (filter === 'picked') return order.pickupStatus === 'picked';
    if (filter === 'expired') return isOrderOverdue(order);
    if (filter === 'cancelled') return order.pickupStatus === 'expired' || order.paymentStatus === 'refunded';
    return true;
  });

  const filterOptions = [
    { value: 'all', label: '全部' },
    { value: 'unpaid', label: '待支付' },
    { value: 'paid', label: '待取书' },
    { value: 'expired', label: '已逾期' },
    { value: 'cancelled', label: '已取消' },
    { value: 'picked', label: '已完成' },
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
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-primary-800 mb-2">我的订单</h1>
        <p className="text-primary-800/60">查看和管理您的预售订单</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
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
              {option.value === 'expired' && getOverdueOrders().length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {getOverdueOrders().length}
                </span>
              )}
            </button>
          ))}
        </div>
        {isStaff && getOverdueOrders().length > 0 && (
          <button
            onClick={handleBatchRelease}
            disabled={batchReleaseLoading}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all',
              !batchReleaseLoading
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {batchReleaseLoading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                释放中...
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                批量释放逾期库存 ({getOverdueOrders().length})
              </>
            )}
          </button>
        )}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl">
          <ShoppingCart className="w-16 h-16 text-primary-800/20 mx-auto mb-4" />
          <p className="text-primary-800/50 mb-2">暂无订单</p>
          <Link
            to="/presales"
            className="text-accent-600 hover:underline font-medium"
          >
            去看看预售书目
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const presale = presales[order.presaleId];
            const paymentStatus = paymentStatusConfig[order.paymentStatus];
            const pickupStatus = pickupStatusConfig[order.pickupStatus];
            const PaymentIcon = paymentStatus.icon;
            const PickupIcon = pickupStatus.icon;

            return (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-primary-800/10 to-accent-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-8 h-8 text-primary-800/40" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-primary-800 text-lg">
                          {presale?.bookTitle || '加载中...'}
                        </h3>
                        <p className="text-sm text-primary-800/50">
                          订单号：{order.orderNo}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold',
                            paymentStatus.color,
                            paymentStatus.color === 'text-green-600' ? 'bg-green-50' :
                            paymentStatus.color === 'text-amber-600' ? 'bg-amber-50' : 'bg-gray-50'
                          )}
                        >
                          <PaymentIcon className="w-3 h-3" />
                          {paymentStatus.label}
                        </span>
                        {(() => {
                          const displayStatus = getOrderDisplayStatus(order, presale);
                          const DisplayIcon = displayStatus.icon;
                          return (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold',
                                displayStatus.color,
                                displayStatus.bgColor,
                                displayStatus.isOverdue && 'animate-pulse'
                              )}
                            >
                              <DisplayIcon className="w-3 h-3" />
                              {displayStatus.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-accent-600">¥{order.depositAmount}</div>
                        <div className="text-xs text-primary-800/50">订金</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-primary-800/10">
                    <div>
                      <div className="text-xs text-primary-800/50 mb-1">数量</div>
                      <div className="font-semibold text-primary-800">{order.quantity} 本</div>
                    </div>
                    <div>
                      <div className="text-xs text-primary-800/50 mb-1">总价</div>
                      <div className="font-semibold text-primary-800">¥{order.totalAmount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-primary-800/50 mb-1">下单时间</div>
                      <div className="font-semibold text-primary-800 text-sm">{formatDateTime(order.createdAt)}</div>
                    </div>
                    {order.paidAt && (
                      <div>
                        <div className="text-xs text-primary-800/50 mb-1">支付时间</div>
                        <div className="font-semibold text-primary-800 text-sm">{formatDateTime(order.paidAt)}</div>
                      </div>
                    )}
                  </div>

                  {order.pickupCode && order.paymentStatus === 'paid' && order.pickupStatus === 'ready' && (
                    <div className="mt-4 p-4 bg-accent-500/10 rounded-xl border border-accent-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-primary-800/60">取书码</div>
                          <div className="text-2xl font-mono font-bold text-accent-600 tracking-wider">
                            {order.pickupCode}
                          </div>
                        </div>
                        {presale && (
                          <div className="text-right">
                            <div className="text-sm text-primary-800/60">取书截止</div>
                            <div className="font-semibold text-accent-600">{formatDate(presale.pickupDeadline)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isOrderOverdue(order) && (
                    <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-red-800">订单已逾期</p>
                            <p className="text-sm text-red-600">
                              已超过取书截止日期 {formatDate(presale?.pickupDeadline)}
                            </p>
                          </div>
                        </div>
                        {isStaff && (
                          <button
                            onClick={(e) => handleExpireOrder(order.id, e)}
                            disabled={expireLoading === order.id}
                            className={cn(
                              'px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all flex-shrink-0',
                              expireLoading !== order.id
                                ? 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            )}
                          >
                            {expireLoading === order.id ? (
                              <>
                                <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                                释放中
                              </>
                            ) : (
                              <>
                                <Unlock className="w-4 h-4" />
                                释放库存
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {order.pickupStatus === 'expired' && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-3">
                        <XCircle className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-gray-700">订单已取消</p>
                          <p className="text-sm text-gray-500">
                            已超过取书期限，订金 ¥{order.depositAmount} 已退还
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
