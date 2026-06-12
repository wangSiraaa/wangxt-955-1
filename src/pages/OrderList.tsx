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
} from 'lucide-react';
import { orderApi, presaleApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { cn, formatDate, formatDateTime } from '../lib/utils.js';
import type { Order, Presale } from '../../shared/types.js';

const paymentStatusConfig: Record<Order['paymentStatus'], { label: string; color: string; icon: typeof CreditCard }> = {
  unpaid: { label: '待支付', color: 'text-amber-600', icon: CreditCard },
  paid: { label: '已支付', color: 'text-green-600', icon: CheckCircle },
  refunded: { label: '已退款', color: 'text-gray-500', icon: XCircle },
};

const pickupStatusConfig: Record<Order['pickupStatus'], { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: '待到货', color: 'text-blue-600', icon: Clock },
  ready: { label: '待取书', color: 'text-accent-600', icon: Package },
  picked: { label: '已取书', color: 'text-green-600', icon: CheckCircle },
  expired: { label: '已逾期', color: 'text-red-600', icon: AlertTriangle },
};

export default function OrderList() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [presales, setPresales] = useState<Record<string, Presale>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid' | 'picked'>('all');

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

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'unpaid') return order.paymentStatus === 'unpaid';
    if (filter === 'paid') return order.paymentStatus === 'paid' && order.pickupStatus !== 'picked';
    if (filter === 'picked') return order.pickupStatus === 'picked';
    return true;
  });

  const filterOptions = [
    { value: 'all', label: '全部' },
    { value: 'unpaid', label: '待支付' },
    { value: 'paid', label: '待取书' },
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
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold',
                            pickupStatus.color,
                            pickupStatus.color === 'text-green-600' ? 'bg-green-50' :
                            pickupStatus.color === 'text-accent-600' ? 'bg-accent-500/10' :
                            pickupStatus.color === 'text-red-600' ? 'bg-red-50' : 'bg-blue-50'
                          )}
                        >
                          <PickupIcon className="w-3 h-3" />
                          {pickupStatus.label}
                        </span>
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
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
