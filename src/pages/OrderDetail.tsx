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
  Repeat,
  Undo2,
  Users,
  Layers,
  History,
  Send,
  X,
} from 'lucide-react';
import { orderApi, presaleApi, notificationApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { cn, formatDate, formatDateTime } from '../lib/utils.js';
import {
  memberLevelConfig,
  type OrderDetailWithRelations,
  type OrderTransfer,
  type RefundRecord,
  type WaitlistEntry,
  type StockReleaseRecord,
} from '../../shared/types.js';
import dayjs from 'dayjs';

const paymentStatusConfig: Record<
  OrderDetailWithRelations['paymentStatus'],
  { label: string; color: string; bgColor: string; icon: typeof CreditCard }
> = {
  unpaid: { label: '待支付', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: CreditCard },
  paid: { label: '已支付', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  refunded: { label: '已退款', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: XCircle },
  partial_refunded: {
    label: '部分退款',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    icon: CreditCard,
  },
};

const pickupStatusConfig: Record<
  OrderDetailWithRelations['pickupStatus'],
  { label: string; color: string; bgColor: string; icon: typeof Clock }
> = {
  pending: { label: '待到货', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Clock },
  ready: { label: '待取书', color: 'text-accent-600', bgColor: 'bg-accent-500/10', icon: Package },
  picked: { label: '已取书', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  expired: { label: '已取消', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: XCircle },
  waitlisted: {
    label: '候补中',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    icon: RefreshCw,
  },
  transferred: {
    label: '已转单',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    icon: RefreshCw,
  },
};

const refundTypeLabels: Record<string, string> = {
  deposit: '订金退款',
  full: '全额退款',
  partial: '部分退款',
};

const refundReasonLabels: Record<string, string> = {
  out_of_stock: '缺货退款',
  user_cancel: '用户取消',
  expired: '逾期取消',
  transfer: '转单退款',
  other: '其他原因',
};

const refundStatusLabels: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [detail, setDetail] = useState<OrderDetailWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [expireLoading, setExpireLoading] = useState(false);
  const [isOverdue, setIsOverdue] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferToUserId, setTransferToUserId] = useState('');
  const [transferRemark, setTransferRemark] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'transfers'>('info');

  useEffect(() => {
    loadOrderDetail();
  }, [id]);

  useEffect(() => {
    if (detail && detail.presale) {
      checkOverdue();
    }
  }, [detail]);

  const checkOverdue = () => {
    if (!detail || !detail.presale) return;
    if (detail.pickupStatus === 'picked' || detail.pickupStatus === 'expired') {
      setIsOverdue(false);
      return;
    }
    const overdue = dayjs().isAfter(dayjs(detail.presale.pickupDeadline));
    setIsOverdue(overdue);
  };

  const loadOrderDetail = async () => {
    if (!id) return;
    try {
      const data = await orderApi.getDetail(id);
      setDetail(data);
    } catch (err) {
      console.error('加载订单详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!detail) return;
    setActionLoading(true);
    try {
      const updatedOrder = await orderApi.pay(detail.id);
      await loadOrderDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : '支付失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExpireOrder = async () => {
    if (!detail) return;
    if (!confirm('确认要释放该逾期订单的库存吗？释放后订单将取消，订金将退还会员。')) return;

    setExpireLoading(true);
    try {
      await orderApi.expireOrder(detail.id);
      await loadOrderDetail();
      alert('订单已成功释放，库存已退回。');
    } catch (err) {
      alert(err instanceof Error ? err.message : '释放失败');
    } finally {
      setExpireLoading(false);
    }
  };

  const handleRequestTransfer = async () => {
    if (!detail || !transferToUserId.trim()) return;
    setTransferLoading(true);
    try {
      await orderApi.requestTransfer(detail.id, {
        toUserId: transferToUserId,
        remark: transferRemark || undefined,
      });
      setShowTransferModal(false);
      setTransferToUserId('');
      setTransferRemark('');
      await loadOrderDetail();
      alert('转单申请已发送，请等待对方确认');
    } catch (err) {
      alert(err instanceof Error ? err.message : '申请失败');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCancelTransfer = async (transferId: string) => {
    if (!confirm('确定取消转单申请？')) return;
    try {
      await orderApi.cancelTransfer(transferId);
      await loadOrderDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : '取消失败');
    }
  };

  const handleConfirmWaitlist = async (waitlistId: string, accepted: boolean) => {
    if (!accepted) {
      if (!window.confirm('确定要放弃候补资格吗？放弃后将退还订金。')) return;
    }
    try {
      await orderApi.confirmWaitlist(waitlistId, accepted);
      await loadOrderDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary-800/20 border-t-primary-800 rounded-full" />
      </div>
    );
  }

  if (!detail || !detail.presale) {
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

  const order = detail;
  const presale = detail.presale;
  const paymentStatus = paymentStatusConfig[order.paymentStatus];
  const pickupStatus = pickupStatusConfig[order.pickupStatus];
  const PaymentIcon = paymentStatus.icon;
  const PickupIcon = pickupStatus.icon;
  const remainingAmount = order.totalAmount - order.depositAmount;
  const hasTransfers = detail.transfers.length > 0;
  const hasRefunds = detail.refunds.length > 0;
  const hasStockReleases = detail.stockReleases.length > 0;

  const canTransfer =
    user?.role === 'member' &&
    order.paymentStatus === 'paid' &&
    order.pickupStatus !== 'picked' &&
    order.pickupStatus !== 'expired' &&
    !detail.transfers.some((t) => t.status === 'completed') &&
    !detail.transfers.some((t) => t.status === 'pending' && t.fromUserId === user.id);

  const pendingTransfer = detail.transfers.find(
    (t) => t.status === 'pending' && t.toUserId === user?.id
  );

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
                {order.batchNo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
                    <Layers className="w-3 h-3" />
                    第 {order.batchNo} 批
                  </span>
                )}
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
                <div className="text-xl font-bold text-primary-800">
                  ¥{Math.max(0, remainingAmount)}
                </div>
              </div>
            </div>
          </div>

          {order.memberLevel && (
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-800/60" />
                会员等级
              </h3>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold',
                    'bg-gradient-to-br from-accent-500/20 to-accent-600/20'
                  )}
                >
                  <User className="w-6 h-6 text-accent-600" />
                </div>
                <div>
                  <div
                    className={cn(
                      'font-semibold',
                      memberLevelConfig[order.memberLevel]?.color || 'text-primary-800'
                    )}
                  >
                    {memberLevelConfig[order.memberLevel]?.name || '普通会员'}
                  </div>
                  <div className="text-sm text-primary-800/50">
                    折扣：{(memberLevelConfig[order.memberLevel]?.discount || 1) * 100}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {order.pickupCode && order.paymentStatus === 'paid' && order.pickupStatus === 'ready' && (
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
                请在取书时出示此取书码，并支付尾款 ¥{Math.max(0, remainingAmount)}
              </p>
            </div>
          )}

          {detail.waitlist && (
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-600" />
                候补信息
              </h3>
              <div
                className={cn(
                  'p-4 rounded-xl',
                  detail.waitlist.status === 'waiting' && 'bg-amber-50',
                  detail.waitlist.status === 'notified' && 'bg-blue-50',
                  detail.waitlist.status === 'confirmed' && 'bg-green-50',
                  detail.waitlist.status === 'refunded' && 'bg-gray-50',
                  detail.waitlist.status === 'expired' && 'bg-red-50'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-primary-800">候补状态</span>
                  <span
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-semibold',
                      detail.waitlist.status === 'waiting' && 'bg-amber-100 text-amber-700',
                      detail.waitlist.status === 'notified' && 'bg-blue-100 text-blue-700',
                      detail.waitlist.status === 'confirmed' && 'bg-green-100 text-green-700',
                      detail.waitlist.status === 'refunded' && 'bg-gray-100 text-gray-600',
                      detail.waitlist.status === 'expired' && 'bg-red-100 text-red-700'
                    )}
                  >
                    {detail.waitlist.status === 'waiting' && '等待中'}
                    {detail.waitlist.status === 'notified' && '已通知'}
                    {detail.waitlist.status === 'confirmed' && '已确认'}
                    {detail.waitlist.status === 'refunded' && '已退款'}
                    {detail.waitlist.status === 'expired' && '已过期'}
                  </span>
                </div>
                {detail.waitlist.priority != null && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-primary-800/60">优先级</span>
                    <span className="text-sm font-medium text-primary-800">
                      第 {detail.waitlist.priority} 位
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-primary-800/60">加入时间</span>
                  <span className="text-sm font-medium text-primary-800">
                    {formatDateTime(detail.waitlist.createdAt)}
                  </span>
                </div>
                {detail.waitlist.notifiedAt && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-primary-800/60">通知时间</span>
                    <span className="text-sm font-medium text-primary-800">
                      {formatDateTime(detail.waitlist.notifiedAt)}
                    </span>
                  </div>
                )}

                {detail.waitlist.status === 'notified' && user?.role === 'member' && (
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => handleConfirmWaitlist(detail.waitlist.id, true)}
                      className="flex-1 py-2 rounded-lg font-semibold bg-green-500 text-white hover:bg-green-600 transition-all"
                    >
                      确认候补
                    </button>
                    <button
                      onClick={() => handleConfirmWaitlist(detail.waitlist.id, false)}
                      className="flex-1 py-2 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
                    >
                      放弃候补
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="flex border-b border-primary-800/10">
              <button
                onClick={() => setActiveTab('info')}
                className={cn(
                  'px-6 py-4 text-sm font-medium transition-colors -mb-px border-b-2',
                  activeTab === 'info'
                    ? 'border-accent-500 text-accent-600'
                    : 'border-transparent text-primary-800/60 hover:text-primary-800'
                )}
              >
                订单信息
              </button>
              <button
                onClick={() => setActiveTab('transfers')}
                className={cn(
                  'px-6 py-4 text-sm font-medium transition-colors -mb-px border-b-2 flex items-center gap-2',
                  activeTab === 'transfers'
                    ? 'border-accent-500 text-accent-600'
                    : 'border-transparent text-primary-800/60 hover:text-primary-800'
                )}
              >
                <Repeat className="w-4 h-4" />
                转单记录
                {hasTransfers && (
                  <span className="px-2 py-0.5 bg-accent-100 text-accent-700 rounded-full text-xs">
                    {detail.transfers.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  'px-6 py-4 text-sm font-medium transition-colors -mb-px border-b-2 flex items-center gap-2',
                  activeTab === 'history'
                    ? 'border-accent-500 text-accent-600'
                    : 'border-transparent text-primary-800/60 hover:text-primary-800'
                )}
              >
                <History className="w-4 h-4" />
                处理记录
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'info' && (
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
                  {order.batchNo && (
                    <div className="flex items-center justify-between py-3">
                      <span className="text-primary-800/60 flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        到货批次
                      </span>
                      <span className="font-medium text-primary-800">第 {order.batchNo} 批</span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'transfers' && (
                <div className="space-y-3">
                  {!hasTransfers && (
                    <div className="text-center py-8 text-primary-800/40">
                      <Repeat className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>暂无转单记录</p>
                    </div>
                  )}
                  {detail.transfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="p-4 bg-cream-50 rounded-xl border border-primary-800/10"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center',
                              transfer.status === 'completed' && 'bg-green-100',
                              transfer.status === 'pending' && 'bg-amber-100',
                              transfer.status === 'cancelled' && 'bg-gray-100'
                            )}
                          >
                            {transfer.status === 'completed' && (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                            {transfer.status === 'pending' && (
                              <Clock className="w-4 h-4 text-amber-600" />
                            )}
                            {transfer.status === 'cancelled' && (
                              <XCircle className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                          <span className="font-medium text-primary-800">
                            {transfer.fromUserName} → {transfer.toUserName}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            transfer.status === 'completed' && 'bg-green-100 text-green-700',
                            transfer.status === 'pending' && 'bg-amber-100 text-amber-700',
                            transfer.status === 'cancelled' && 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {transfer.status === 'completed' && '已完成'}
                          {transfer.status === 'pending' && '待确认'}
                          {transfer.status === 'cancelled' && '已取消'}
                        </span>
                      </div>
                      {transfer.remark && (
                        <p className="text-sm text-primary-800/60 mb-3">
                          备注：{transfer.remark}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-primary-800/50">
                        <span>申请时间：{formatDateTime(transfer.createdAt)}</span>
                        {transfer.completedAt && (
                          <span>完成时间：{formatDateTime(transfer.completedAt)}</span>
                        )}
                      </div>
                      {transfer.status === 'pending' &&
                        transfer.fromUserId === user?.id && (
                          <button
                            onClick={() => handleCancelTransfer(transfer.id)}
                            className="mt-3 w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            取消转单
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  {hasRefunds && (
                    <div>
                      <h4 className="text-sm font-semibold text-primary-800 mb-3 flex items-center gap-2">
                        <Undo2 className="w-4 h-4" />
                        退款记录
                      </h4>
                      <div className="space-y-2">
                        {detail.refunds.map((refund) => (
                          <div
                            key={refund.id}
                            className="p-3 bg-red-50 rounded-lg border border-red-100"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-red-800">
                                {refundTypeLabels[refund.refundType] || refund.refundType}
                              </span>
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded text-xs font-medium',
                                  refund.refundStatus === 'completed' &&
                                    'bg-green-100 text-green-700',
                                  refund.refundStatus === 'processing' &&
                                    'bg-blue-100 text-blue-700',
                                  refund.refundStatus === 'pending' &&
                                    'bg-amber-100 text-amber-700',
                                  refund.refundStatus === 'failed' && 'bg-red-100 text-red-700'
                                )}
                              >
                                {refundStatusLabels[refund.refundStatus] || refund.refundStatus}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-red-600/70">
                                原因：{refundReasonLabels[refund.refundReason] || refund.refundReason}
                              </span>
                              <span className="font-semibold text-red-700">
                                -¥{refund.refundAmount}
                              </span>
                            </div>
                            {refund.remark && (
                              <p className="text-xs text-red-600/60 mt-1">
                                备注：{refund.remark}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasStockReleases && (
                    <div>
                      <h4 className="text-sm font-semibold text-primary-800 mb-3 flex items-center gap-2">
                        <Unlock className="w-4 h-4" />
                        库存释放记录
                      </h4>
                      <div className="space-y-2">
                        {detail.stockReleases.map((release) => (
                          <div
                            key={release.id}
                            className="p-3 bg-amber-50 rounded-lg border border-amber-100"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-amber-800">库存释放</span>
                              <span className="text-sm text-amber-700">
                                释放数量：{release.quantity}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-amber-600/70">
                                订金处理：{release.depositRetained ? '保留订金' : '退还订金'}
                              </span>
                              <span className="text-amber-600/70">
                                {formatDateTime(release.createdAt)}
                              </span>
                            </div>
                            {release.reason && (
                              <p className="text-xs text-amber-600/60 mt-1">
                                原因：{release.reason}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.notifications.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-primary-800 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        通知记录
                      </h4>
                      <div className="space-y-2">
                        {detail.notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={cn(
                              'p-3 rounded-lg border',
                              notification.readAt
                                ? 'bg-cream-50 border-primary-800/10'
                                : 'bg-accent-500/5 border-accent-500/30'
                            )}
                          >
                            <p className="text-primary-800 text-sm">{notification.content}</p>
                            <p className="text-xs text-primary-800/50 mt-1">
                              {formatDateTime(notification.sentAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!hasRefunds && !hasStockReleases && detail.notifications.length === 0 && (
                    <div className="text-center py-8 text-primary-800/40">
                      <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>暂无处理记录</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
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

            {canTransfer && (
              <button
                onClick={() => setShowTransferModal(true)}
                className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-all mb-4"
              >
                <Repeat className="w-5 h-5" />
                申请转单
              </button>
            )}

            {pendingTransfer && user?.role === 'member' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <div className="flex items-start gap-3 mb-3">
                  <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">待确认转单</p>
                    <p className="text-sm text-amber-600">
                      {pendingTransfer.fromUserName} 想把订单转给您
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await orderApi.acceptTransfer(pendingTransfer.id);
                        await loadOrderDetail();
                        alert('已接受转单');
                      } catch (err) {
                        alert(err instanceof Error ? err.message : '接受失败');
                      }
                    }}
                    className="flex-1 py-2 text-sm font-semibold bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
                  >
                    接受
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await orderApi.rejectTransfer(pendingTransfer.id);
                        await loadOrderDetail();
                      } catch (err) {
                        alert(err instanceof Error ? err.message : '拒绝失败');
                      }
                    }}
                    className="flex-1 py-2 text-sm font-semibold bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                  >
                    拒绝
                  </button>
                </div>
              </div>
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
                        请携带取书码前往书店取书，取书时支付尾款 ¥{Math.max(0, remainingAmount)}
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

            {order.pickupStatus === 'waitlisted' && (
              <div className="p-4 bg-amber-50 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <RefreshCw className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">候补中</p>
                    <p className="text-sm text-amber-600">
                      当前库存不足，已加入候补队列。如有库存释放，将按优先级通知您
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isOverdue &&
              order.pickupStatus !== 'expired' &&
              order.paymentStatus === 'paid' && (
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
                      已超过取书截止日期，订单已取消
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
                {presale.balanceDeadline && (
                  <div className="flex items-center justify-between">
                    <span className="text-primary-800/60">尾款截止</span>
                    <span className="font-medium text-primary-800">
                      {formatDateTime(presale.balanceDeadline)}
                    </span>
                  </div>
                )}
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

      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-primary-800 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                申请转单
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-800/80 mb-2">
                  接收人用户ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={transferToUserId}
                  onChange={(e) => setTransferToUserId(e.target.value)}
                  placeholder="请输入接收人用户ID"
                  className="w-full px-4 py-3 border border-primary-800/20 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-800/80 mb-2">
                  备注（可选）
                </label>
                <textarea
                  value={transferRemark}
                  onChange={(e) => setTransferRemark(e.target.value)}
                  placeholder="请输入转单备注"
                  rows={3}
                  className="w-full px-4 py-3 border border-primary-800/20 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none resize-none"
                />
              </div>

              <div className="p-4 bg-amber-50 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    <p className="font-medium mb-1">转单说明</p>
                    <ul className="space-y-1 text-xs">
                      <li>• 每个订单只能转单一次</li>
                      <li>• 转单需要对方确认后生效</li>
                      <li>• 转单生效后，订单归属将转移给接收人</li>
                      <li>• 在对方确认前，您可以取消转单申请</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 py-3 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
              >
                取消
              </button>
              <button
                onClick={handleRequestTransfer}
                disabled={!transferToUserId.trim() || transferLoading}
                className={cn(
                  'flex-1 py-3 rounded-xl font-semibold transition-all',
                  transferToUserId.trim() && !transferLoading
                    ? 'bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {transferLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full inline-block mr-2" />
                    申请中...
                  </>
                ) : (
                  '发送申请'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
