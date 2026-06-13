import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  AlertTriangle,
  BookOpen,
  QrCode,
  Calendar,
  User,
  Phone,
  FileText,
  Unlock,
  RefreshCw,
} from 'lucide-react';
import { orderApi, presaleApi, notificationApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { cn, formatDate, formatDateTime } from '../lib/utils.js';
import type { Order, Presale, Notification } from '../../shared/types.js';
import dayjs from 'dayjs';

const paymentStatusConfig: Record<
  Order['paymentStatus'],
  { label: string; color: string; bgColor: string; icon: typeof CreditCard }
> = {
  unpaid: { label: '待支付', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: CreditCard },
  paid: { label: '已支付', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  refunded: { label: '已退款', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: XCircle },
};

const pickupStatusConfig: Record<
  Order['pickupStatus'],
  { label: string; color: string; bgColor: string; icon: typeof Clock }
> = {
  pending: { label: '待到货', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Clock },
  ready: { label: '待取书', color: 'text-accent-600', bgColor: 'bg-accent-500/10', icon: Package },
  picked: { label: '已取书', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  expired: { label: '已取消', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: XCircle },
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [presale, setPresale] = useState<Presale | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [expireLoading, setExpireLoading] = useState(false);
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    loadOrderDetail();
  }, [id]);

  useEffect(() => {
    if (order && presale) {
      checkOverdue();
    }
  }, [order, presale]);

  const checkOverdue = () => {
    if (!order || !presale) return;
    if (order.pickupStatus === 'picked' || order.pickupStatus === 'expired') {
      setIsOverdue(false);
      return;
    }
    const overdue = dayjs().isAfter(dayjs(presale.pickupDeadline));
    setIsOverdue(overdue);
  };

  const loadOrderDetail = async () => {
    if (!id) return;
    try {
      const [orderData, notificationsData] = await Promise.all([
        orderApi.getById(id),
        notificationApi.getMy().catch(() => []),
      ]);
      setOrder(orderData);
      const presaleData = await presaleApi.getById(orderData.presaleId);
      setPresale(presaleData);
      const orderNotifications = notificationsData.filter(
        (n) => n.orderId === orderData.id
      );
      setNotifications(orderNotifications);
    } catch (err) {
      console.error('加载订单详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!order) return;
    setActionLoading(true);
    try {
      const updatedOrder = await orderApi.pay(order.id);
      setOrder(updatedOrder);
      await loadOrderDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : '支付失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExpireOrder = async () => {
    if (!order) return;
    if (!confirm('确认要释放该逾期订单的库存吗？释放后订单将取消，订金将退还会员。')) return;
    
    setExpireLoading(true);
    try {
      const updatedOrder = await orderApi.expireOrder(order.id);
      setOrder(updatedOrder);
      await loadOrderDetail();
      alert('订单已成功释放，库存已退回。');
    } catch (err) {
      alert(err instanceof Error ? err.message : '释放失败');
    } finally {
      setExpireLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationApi.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
    } catch (err) {
      console.error('标记已读失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary-800/20 border-t-primary-800 rounded-full" />
      </div>
    );
  }

  if (!order || !presale) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-16 h-16 text-primary-800/20 mx-auto mb-4" />
        <p className="text-primary-800/50 mb-4">订单不存在</p>
        <button
          onClick={() => navigate('/orders')}
          className="text-accent-600 hover:underline"
        >
          返回订单列表
        </button>
      </div>
    );
  }

  const paymentStatus = paymentStatusConfig[order.paymentStatus];
  const pickupStatus = pickupStatusConfig[order.pickupStatus];
  const PaymentIcon = paymentStatus.icon;
  const PickupIcon = pickupStatus.icon;
  const remainingAmount = order.totalAmount - order.depositAmount;

  return (
    <div>
      <button
        onClick={() => navigate('/orders')}
        className="inline-flex items-center gap-2 text-primary-800/60 hover:text-primary-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        返回订单列表
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-serif font-bold text-primary-800 mb-1">
                  订单详情
                </h1>
                <p className="text-sm text-primary-800/50">订单号：{order.orderNo}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold',
                    paymentStatus.bgColor,
                    paymentStatus.color
                  )}
                >
                  <PaymentIcon className="w-3 h-3" />
                  {paymentStatus.label}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold',
                    pickupStatus.bgColor,
                    pickupStatus.color
                  )}
                >
                  <PickupIcon className="w-3 h-3" />
                  {pickupStatus.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-cream-100 rounded-xl mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-800/10 to-accent-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-8 h-8 text-primary-800/40" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-primary-800 text-lg truncate">
                  {presale.bookTitle}
                </h3>
                <p className="text-sm text-primary-800/50">作者：{presale.bookAuthor}</p>
                <p className="text-sm text-primary-800/50">ISBN：{presale.bookIsbn}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-accent-600">¥{presale.price}</div>
                <div className="text-xs text-primary-800/50">单价</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-cream-50 rounded-xl">
                <div className="text-xs text-primary-800/50 mb-1">预订数量</div>
                <div className="text-xl font-bold text-primary-800">{order.quantity} 本</div>
              </div>
              <div className="p-4 bg-cream-50 rounded-xl">
                <div className="text-xs text-primary-800/50 mb-1">订单总额</div>
                <div className="text-xl font-bold text-primary-800">¥{order.totalAmount}</div>
              </div>
              <div className="p-4 bg-accent-500/10 rounded-xl">
                <div className="text-xs text-primary-800/50 mb-1">已付订金</div>
                <div className="text-xl font-bold text-accent-600">¥{order.depositAmount}</div>
              </div>
              <div className="p-4 bg-cream-50 rounded-xl">
                <div className="text-xs text-primary-800/50 mb-1">待付尾款</div>
                <div className="text-xl font-bold text-primary-800">¥{remainingAmount}</div>
              </div>
            </div>
          </div>

          {order.pickupCode && order.paymentStatus === 'paid' && (
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-accent-600" />
                取书凭证
              </h3>
              <div className="p-6 bg-gradient-to-br from-accent-500/5 to-primary-800/5 rounded-xl border-2 border-dashed border-accent-500/30">
                <div className="text-center">
                  <div className="text-sm text-primary-800/60 mb-2">取书码</div>
                  <div className="text-4xl font-mono font-bold text-accent-600 tracking-[0.5em] mb-4">
                    {order.pickupCode}
                  </div>
                  <div className="flex items-center justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary-800/40" />
                      <span className="text-primary-800/60">
                        取书截止：{formatDate(presale.pickupDeadline)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-primary-800/50 text-center">
                请在取书时出示此取书码，并支付尾款 ¥{remainingAmount}
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-800/60" />
              订单信息
            </h3>
            <div className="divide-y divide-primary-800/10">
              <div className="flex items-center justify-between py-3">
                <span className="text-primary-800/60 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  预订人
                </span>
                <span className="font-medium text-primary-800">{order.userName}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-primary-800/60 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  下单时间
                </span>
                <span className="font-medium text-primary-800">
                  {formatDateTime(order.createdAt)}
                </span>
              </div>
              {order.paidAt && (
                <div className="flex items-center justify-between py-3">
                  <span className="text-primary-800/60 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    支付时间
                  </span>
                  <span className="font-medium text-primary-800">
                    {formatDateTime(order.paidAt)}
                  </span>
                </div>
              )}
              {order.pickupAt && (
                <div className="flex items-center justify-between py-3">
                  <span className="text-primary-800/60 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    取书时间
                  </span>
                  <span className="font-medium text-primary-800">
                    {formatDateTime(order.pickupAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {notifications.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-800/60" />
                通知记录
              </h3>
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 rounded-xl border transition-all cursor-pointer',
                      notification.readAt
                        ? 'bg-cream-50 border-primary-800/10'
                        : 'bg-accent-500/5 border-accent-500/30'
                    )}
                    onClick={() => !notification.readAt && handleMarkAsRead(notification.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-primary-800">{notification.content}</p>
                      {!notification.readAt && (
                        <span className="w-2 h-2 bg-accent-600 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                    <p className="text-xs text-primary-800/50 mt-2">
                      {formatDateTime(notification.sentAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-md p-6 sticky top-8">
            <h3 className="text-lg font-semibold text-primary-800 mb-6">订单操作</h3>

            {user?.role === 'member' && order.paymentStatus === 'unpaid' && (
              <button
                onClick={handlePay}
                disabled={actionLoading}
                className={cn(
                  'w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all mb-4',
                  !actionLoading
                    ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white hover:shadow-lg active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
                    支付中...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    支付订金 ¥{order.depositAmount}
                  </>
                )}
              </button>
            )}

            {user?.role === 'member' &&
              order.paymentStatus === 'paid' &&
              order.pickupStatus === 'ready' && (
                <div className="p-4 bg-green-50 rounded-xl mb-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">书籍已到货</p>
                      <p className="text-sm text-green-600">
                        请携带取书码前往书店取书，取书时支付尾款 ¥{remainingAmount}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {user?.role === 'member' &&
              order.paymentStatus === 'paid' &&
              order.pickupStatus === 'pending' && (
                <div className="p-4 bg-blue-50 rounded-xl mb-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">等待到货</p>
                      <p className="text-sm text-blue-600">
                        书籍到货后我们会第一时间通知您前来取书
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {isOverdue && order.pickupStatus !== 'expired' && order.paymentStatus === 'paid' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">订单已逾期</p>
                    <p className="text-sm text-red-600">
                      已超过取书截止日期 {formatDate(presale?.pickupDeadline)}，需要释放库存
                    </p>
                  </div>
                </div>
                {(user?.role === 'clerk' || user?.role === 'warehouse') && (
                  <button
                    onClick={handleExpireOrder}
                    disabled={expireLoading}
                    className={cn(
                      'w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all',
                      !expireLoading
                        ? 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {expireLoading ? (
                      <>
                        <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
                        释放中...
                      </>
                    ) : (
                      <>
                        <Unlock className="w-5 h-5" />
                        释放库存并取消订单
                      </>
                    )}
                  </button>
                )}
                {user?.role === 'member' && (
                  <p className="text-sm text-red-600 text-center">
                    请联系店员处理，订金将自动退还
                  </p>
                )}
              </div>
            )}

            {order.pickupStatus === 'expired' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">订单已取消</p>
                    <p className="text-sm text-red-600">
                      已超过取书截止日期，订单已取消，订金 ¥{order.depositAmount} 已退还
                    </p>
                  </div>
                </div>
              </div>
            )}

            {order.pickupStatus === 'picked' && (
              <div className="p-4 bg-green-50 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">交易完成</p>
                    <p className="text-sm text-green-600">感谢您的购买，期待您再次光临</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 text-sm">
              <Link
                to={`/presales/${presale.id}`}
                className="block w-full py-3 rounded-xl font-semibold text-center bg-primary-800/10 text-primary-800 hover:bg-primary-800/20 transition-all"
              >
                查看预售详情
              </Link>
            </div>

            <div className="mt-6 pt-6 border-t border-primary-800/10">
              <h4 className="font-semibold text-primary-800 mb-3">预售时间安排</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-primary-800/60">预售开始</span>
                  <span className="font-medium text-primary-800">
                    {formatDateTime(presale.presaleStartTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-primary-800/60">预售结束</span>
                  <span className="font-medium text-primary-800">
                    {formatDateTime(presale.presaleEndTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-primary-800/60">取书截止</span>
                  <span className="font-medium text-accent-600">
                    {formatDateTime(presale.pickupDeadline)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
