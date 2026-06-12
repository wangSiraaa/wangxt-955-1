import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Clock,
  CheckCheck,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';
import { notificationApi, orderApi, presaleApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { cn, formatDateTime } from '../lib/utils.js';
import type { Notification, Order, Presale } from '../../shared/types.js';

const notificationTypeConfig: Record<
  Notification['type'],
  { label: string; icon: typeof Bell; color: string; bgColor: string }
> = {
  pickup_ready: {
    label: '取书通知',
    icon: Package,
    color: 'text-accent-600',
    bgColor: 'bg-accent-500/10',
  },
  expiry_warning: {
    label: '逾期提醒',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  order_cancelled: {
    label: '订单取消',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [presales, setPresales] = useState<Record<string, Presale>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const [notificationsData, ordersData, presalesData] = await Promise.all([
        notificationApi.getMy(),
        orderApi.getAll().catch(() => []),
        presaleApi.getAll().catch(() => []),
      ]);

      setNotifications(
        notificationsData.sort(
          (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
        )
      );

      const orderMap: Record<string, Order> = {};
      ordersData.forEach((o) => {
        orderMap[o.id] = o;
      });
      setOrders(orderMap);

      const presaleMap: Record<string, Presale> = {};
      presalesData.forEach((p) => {
        presaleMap[p.id] = p;
      });
      setPresales(presaleMap);
    } catch (err) {
      console.error('加载通知失败:', err);
    } finally {
      setLoading(false);
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

  const handleMarkAllAsRead = async () => {
    setActionLoading(true);
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } catch (err) {
      console.error('全部标记已读失败:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.readAt) {
      handleMarkAsRead(notification.id);
    }
    if (notification.orderId) {
      navigate(`/orders/${notification.orderId}`);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.readAt;
    if (filter === 'read') return !!n.readAt;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const filterOptions = [
    { value: 'all', label: '全部' },
    { value: 'unread', label: '未读' },
    { value: 'read', label: '已读' },
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-primary-800/60 hover:text-primary-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回
          </button>
          <h1 className="text-3xl font-serif font-bold text-primary-800 mb-2">消息通知</h1>
          <p className="text-primary-800/60">
            查看您的所有通知消息
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-accent-500 text-white text-xs font-semibold rounded-full">
                {unreadCount} 条未读
              </span>
            )}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={actionLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-800/10 text-primary-800 hover:bg-primary-800/20 transition-colors flex items-center gap-2"
          >
            {actionLoading ? (
              <div className="animate-spin w-4 h-4 border-2 border-primary-800/20 border-t-primary-800 rounded-full" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            全部标记已读
          </button>
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
            {option.value === 'unread' && unreadCount > 0 && (
              <span className="ml-1">({unreadCount})</span>
            )}
          </button>
        ))}
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl">
          <Bell className="w-16 h-16 text-primary-800/20 mx-auto mb-4" />
          <p className="text-primary-800/50 mb-2">
            {filter === 'unread' ? '暂无未读消息' : filter === 'read' ? '暂无已读消息' : '暂无通知消息'}
          </p>
          <p className="text-sm text-primary-800/30">
            有新的通知消息会显示在这里
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => {
            const typeConfig = notificationTypeConfig[notification.type];
            const TypeIcon = typeConfig.icon;
            const order = orders[notification.orderId];
            const presale = order ? presales[order.presaleId] : null;

            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  'bg-white rounded-2xl shadow-sm border-2 transition-all cursor-pointer hover:shadow-md',
                  !notification.readAt
                    ? 'border-accent-500/30 bg-gradient-to-r from-accent-500/5 to-transparent'
                    : 'border-transparent hover:border-primary-800/10'
                )}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                        typeConfig.bgColor
                      )}
                    >
                      <TypeIcon className={cn('w-6 h-6', typeConfig.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold',
                              typeConfig.bgColor,
                              typeConfig.color
                            )}
                          >
                            {typeConfig.label}
                          </span>
                          {!notification.readAt && (
                            <span className="w-2 h-2 bg-accent-600 rounded-full" />
                          )}
                        </div>
                        <span className="text-xs text-primary-800/40 flex-shrink-0">
                          {formatDateTime(notification.sentAt)}
                        </span>
                      </div>

                      <p className="text-primary-800 font-medium mb-2">{notification.content}</p>

                      {order && presale && (
                        <Link
                          to={`/orders/${order.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-2 p-3 bg-cream-50 rounded-xl hover:bg-cream-100 transition-colors"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-primary-800/10 to-accent-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-5 h-5 text-primary-800/40" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-primary-800 truncate">
                              {presale.bookTitle}
                            </p>
                            <p className="text-xs text-primary-800/50">
                              订单号：{order.orderNo}
                            </p>
                          </div>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
