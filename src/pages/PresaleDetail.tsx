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
  Layers,
  History,
  Package,
  RefreshCw,
  XCircle,
  ListOrdered,
  Undo2,
  DollarSign,
} from 'lucide-react';
import { presaleApi, orderApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { cn, formatDate, getCountdown } from '../lib/utils.js';
import {
  memberLevelConfig,
  type Presale,
  type PresaleDetailWithRelations,
  type PresaleBatch,
  type Arrival,
  type MemberLevel,
} from '../../shared/types.js';

const statusConfig: Record<
  Presale['status'],
  { label: string; color: string; bgColor: string; icon: typeof Clock }
> = {
  draft: { label: '草稿', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Clock },
  upcoming: { label: '即将开始', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Clock },
  active: { label: '预售中', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  ended: { label: '已结束', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Clock },
  partial_arrived: {
    label: '部分到货',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    icon: Package,
  },
  arrived: { label: '已到货', color: 'text-accent-600', bgColor: 'bg-accent-500/10', icon: BookOpen },
};

interface TimelineEvent {
  time: string;
  type: 'presale_start' | 'presale_end' | 'batch_expected' | 'batch_arrived' | 'balance_deadline' | 'pickup_deadline' | 'refund' | 'stock_release';
  title: string;
  description?: string;
  status: 'done' | 'current' | 'upcoming';
}

export default function PresaleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [detail, setDetail] = useState<PresaleDetailWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [availability, setAvailability] = useState<{
    available: boolean;
    message: string;
    canWaitlist: boolean;
  }>({ available: false, message: '', canWaitlist: false });
  const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'stats'>('info');

  useEffect(() => {
    loadDetail();
  }, [id]);

  useEffect(() => {
    if (!detail) return;

    const updateCountdown = () => {
      if (detail.status === 'upcoming') {
        setCountdown(getCountdown(detail.presaleStartTime));
      } else if (detail.status === 'active') {
        setCountdown(getCountdown(detail.presaleEndTime));
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [detail]);

  useEffect(() => {
    if (detail && user?.role === 'member') {
      checkAvailability();
    }
  }, [detail, quantity]);

  const loadDetail = async () => {
    if (!id) return;
    try {
      const data = await presaleApi.getDetail(id);
      setDetail(data);
    } catch (err) {
      console.error('加载预售详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkAvailability = async () => {
    if (!detail) return;
    try {
      const result = await presaleApi.checkAvailability(detail.id, quantity);
      setAvailability({
        available: result.available,
        message: result.message,
        canWaitlist: result.canWaitlist || false,
      });
    } catch (err) {
      setAvailability({ available: false, message: '检查库存失败', canWaitlist: false });
    }
  };

  const handleReserve = async () => {
    if (!detail || !availability.available) return;
    setActionLoading(true);

    try {
      const order = await orderApi.create({
        presaleId: detail.id,
        quantity,
      });
      navigate(`/orders/${order.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '预订失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWaitlistReserve = async () => {
    if (!detail || !availability.canWaitlist) return;
    setActionLoading(true);

    try {
      const order = await orderApi.create({
        presaleId: detail.id,
        quantity,
      });
      const result = await orderApi.payWithWaitlist(order.id);
      navigate(`/orders/${order.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '加入候补失败');
    } finally {
      setActionLoading(false);
    }
  };

  const buildTimeline = (): TimelineEvent[] => {
    if (!detail) return [];

    const events: TimelineEvent[] = [];
    const now = new Date();

    events.push({
      time: detail.presaleStartTime,
      type: 'presale_start',
      title: '预售开始',
      status: new Date(detail.presaleStartTime) <= now ? 'done' : 'upcoming',
    });

    detail.batches.forEach((batch) => {
      events.push({
        time: batch.expectedArrivalDate,
        type: 'batch_expected',
        title: `第 ${batch.batchNo} 批预计到货`,
        description: `${batch.quantity} 本`,
        status: batch.status === 'arrived' ? 'done' : 'upcoming',
      });
    });

    detail.arrivals.forEach((arrival) => {
      events.push({
        time: arrival.arrivedAt,
        type: 'batch_arrived',
        title: `第 ${arrival.batchNo} 批实际到货`,
        description: `${arrival.quantity} 本`,
        status: 'done',
      });
    });

    detail.refunds.forEach((refund) => {
      events.push({
        time: refund.completedAt || refund.createdAt,
        type: 'refund',
        title: '退款处理',
        description: `¥${refund.refundAmount} - ${refund.refundReason}`,
        status: 'done',
      });
    });

    detail.stockReleases.forEach((release) => {
      events.push({
        time: release.createdAt,
        type: 'stock_release',
        title: '库存释放',
        description: `${release.quantity} 本 - ${release.depositRetained ? '订金已扣留' : '订金已退还'}`,
        status: 'done',
      });
    });

    events.push({
      time: detail.presaleEndTime,
      type: 'presale_end',
      title: '预售结束',
      status: new Date(detail.presaleEndTime) <= now ? 'done' : 'upcoming',
    });

    if (detail.balanceDeadline) {
      events.push({
        time: detail.balanceDeadline,
        type: 'balance_deadline',
        title: '尾款截止',
        status: new Date(detail.balanceDeadline) <= now ? 'done' : 'upcoming',
      });
    }

    events.push({
      time: detail.pickupDeadline,
      type: 'pickup_deadline',
      title: '取书截止',
      status: new Date(detail.pickupDeadline) <= now ? 'done' : 'upcoming',
    });

    events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    let foundCurrent = false;
    return events.map((event) => {
      if (event.status === 'done') return event;
      if (!foundCurrent && event.status === 'upcoming') {
        foundCurrent = true;
        return { ...event, status: 'current' as const };
      }
      return event;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary-800/20 border-t-primary-800 rounded-full" />
      </div>
    );
  }

  if (!detail) {
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

  const presale = detail;
  const status = statusConfig[presale.status];
  const StatusIcon = status.icon;
  const availableStock = presale.totalStock - presale.lockedStock - presale.soldStock;
  const soldProgress = ((presale.soldStock + presale.lockedStock) / presale.totalStock) * 100;
  const depositTotal = presale.deposit * quantity;
  const totalAmount = presale.price * quantity;
  const timeline = buildTimeline();

  const memberLevels: MemberLevel[] = ['diamond', 'gold', 'silver', 'normal'];

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
        <div className="lg:col-span-2 space-y-6">
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
                <span className="text-lg text-primary-800/40 line-through">
                  ¥{Math.round(presale.price * 1.2 * 100) / 100}
                </span>
                <span className="px-2 py-1 bg-red-50 text-red-600 text-sm font-semibold rounded">
                  预售特惠
                </span>
              </div>

              <div className="flex border-b border-primary-800/10 mb-6">
                <button
                  onClick={() => setActiveTab('info')}
                  className={cn(
                    'px-4 py-3 text-sm font-medium transition-colors -mb-px border-b-2',
                    activeTab === 'info'
                      ? 'border-accent-500 text-accent-600'
                      : 'border-transparent text-primary-800/60 hover:text-primary-800'
                  )}
                >
                  基本信息
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={cn(
                    'px-4 py-3 text-sm font-medium transition-colors -mb-px border-b-2 flex items-center gap-2',
                    activeTab === 'timeline'
                      ? 'border-accent-500 text-accent-600'
                      : 'border-transparent text-primary-800/60 hover:text-primary-800'
                  )}
                >
                  <History className="w-4 h-4" />
                  全流程时间线
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={cn(
                    'px-4 py-3 text-sm font-medium transition-colors -mb-px border-b-2 flex items-center gap-2',
                    activeTab === 'stats'
                      ? 'border-accent-500 text-accent-600'
                      : 'border-transparent text-primary-800/60 hover:text-primary-800'
                  )}
                >
                  <ListOrdered className="w-4 h-4" />
                  统计数据
                </button>
              </div>

              {activeTab === 'info' && (
                <div className="space-y-6">
                  <div className="prose prose-primary max-w-none">
                    <h3 className="text-lg font-semibold text-primary-800 mb-3">内容简介</h3>
                    <p className="text-primary-800/70 leading-relaxed">
                      {presale.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-6 bg-cream-100 rounded-xl">
                    <div>
                      <div className="text-sm text-primary-800/60 mb-1">预售时间</div>
                      <div className="font-semibold text-primary-800">
                        {formatDate(presale.presaleStartTime)} -{' '}
                        {formatDate(presale.presaleEndTime)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-primary-800/60 mb-1">尾款截止</div>
                      <div className="font-semibold text-primary-800">
                        {presale.balanceDeadline
                          ? formatDate(presale.balanceDeadline)
                          : '-'}
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
                      <div className="font-semibold text-primary-800">
                        {presale.totalStock} 本
                      </div>
                    </div>
                  </div>

                  {detail.batches.length > 0 && (
                    <div className="p-6 bg-cream-100 rounded-xl">
                      <h3 className="font-semibold text-primary-800 mb-4 flex items-center gap-2">
                        <Layers className="w-5 h-5" />
                        到货批次
                      </h3>
                      <div className="space-y-3">
                        {detail.batches.map((batch) => (
                          <div
                            key={batch.id}
                            className="flex items-center justify-between p-4 bg-white rounded-lg border border-primary-800/10"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                                  batch.status === 'arrived'
                                    ? 'bg-green-100 text-green-600'
                                    : 'bg-gray-100 text-gray-500'
                                )}
                              >
                                {batch.batchNo}
                              </div>
                              <div>
                                <div className="font-medium text-primary-800">
                                  第 {batch.batchNo} 批
                                </div>
                                <div className="text-sm text-primary-800/60">
                                  预计 {formatDate(batch.expectedArrivalDate)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-primary-800">
                                {batch.status === 'arrived'
                                  ? `已到 ${batch.arrivedQuantity} / ${batch.quantity} 本`
                                  : `${batch.quantity} 本`}
                              </div>
                              <div
                                className={cn(
                                  'text-xs',
                                  batch.status === 'arrived'
                                    ? 'text-green-600'
                                    : 'text-gray-500'
                                )}
                              >
                                {batch.status === 'arrived'
                                  ? '已到货'
                                  : batch.status === 'cancelled'
                                    ? '已取消'
                                    : '待到货'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {presale.memberLevelLimit && (
                    <div className="p-6 bg-cream-100 rounded-xl">
                      <h3 className="font-semibold text-primary-800 mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        会员等级限购
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {memberLevels.map((level) => {
                          const config = memberLevelConfig[level];
                          const limit = presale.memberLevelLimit?.[level] || 0;
                          return (
                            <div
                              key={level}
                              className="p-3 bg-white rounded-lg text-center border border-primary-800/10"
                            >
                              <div className={cn('text-sm font-medium mb-1', config.color)}>
                                {config.name}
                              </div>
                              <div className="text-lg font-bold text-primary-800">
                                {limit > 0 ? `${limit} 本` : '不限'}
                              </div>
                              <div className="text-xs text-primary-800/50">每人限购</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="py-4">
                  <div className="relative">
                    {timeline.map((event, index) => (
                      <div key={index} className="flex gap-4 pb-6 last:pb-0">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                              event.status === 'done'
                                ? 'bg-green-100'
                                : event.status === 'current'
                                  ? 'bg-accent-100 ring-4 ring-accent-100/30'
                                  : 'bg-gray-100'
                            )}
                          >
                            {event.type === 'presale_start' && (
                              <Clock
                                className={cn(
                                  'w-5 h-5',
                                  event.status === 'done'
                                    ? 'text-green-600'
                                    : event.status === 'current'
                                      ? 'text-accent-600'
                                      : 'text-gray-400'
                                )}
                              />
                            )}
                            {event.type === 'presale_end' && (
                              <CheckCircle
                                className={cn(
                                  'w-5 h-5',
                                  event.status === 'done'
                                    ? 'text-green-600'
                                    : event.status === 'current'
                                      ? 'text-accent-600'
                                      : 'text-gray-400'
                                )}
                              />
                            )}
                            {(event.type === 'batch_expected' ||
                              event.type === 'batch_arrived') && (
                              <Package
                                className={cn(
                                  'w-5 h-5',
                                  event.status === 'done'
                                    ? 'text-green-600'
                                    : event.status === 'current'
                                      ? 'text-accent-600'
                                      : 'text-gray-400'
                                )}
                              />
                            )}
                            {event.type === 'balance_deadline' && (
                              <CreditCard
                                className={cn(
                                  'w-5 h-5',
                                  event.status === 'done'
                                    ? 'text-green-600'
                                    : event.status === 'current'
                                      ? 'text-accent-600'
                                      : 'text-gray-400'
                                )}
                              />
                            )}
                            {event.type === 'pickup_deadline' && (
                              <BookOpen
                                className={cn(
                                  'w-5 h-5',
                                  event.status === 'done'
                                    ? 'text-green-600'
                                    : event.status === 'current'
                                      ? 'text-accent-600'
                                      : 'text-gray-400'
                                )}
                              />
                            )}
                            {event.type === 'refund' && (
                              <DollarSign
                                className={cn(
                                  'w-5 h-5',
                                  event.status === 'done'
                                    ? 'text-green-600'
                                    : event.status === 'current'
                                      ? 'text-accent-600'
                                      : 'text-gray-400'
                                )}
                              />
                            )}
                            {event.type === 'stock_release' && (
                              <Undo2
                                className={cn(
                                  'w-5 h-5',
                                  event.status === 'done'
                                    ? 'text-green-600'
                                    : event.status === 'current'
                                      ? 'text-accent-600'
                                      : 'text-gray-400'
                                )}
                              />
                            )}
                          </div>
                          {index < timeline.length - 1 && (
                            <div
                              className={cn(
                                'w-0.5 flex-1 mt-2',
                                event.status === 'done' ? 'bg-green-200' : 'bg-gray-200'
                              )}
                            />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center justify-between mb-1">
                            <h4
                              className={cn(
                                'font-semibold',
                                event.status === 'done'
                                  ? 'text-primary-800'
                                  : event.status === 'current'
                                    ? 'text-accent-600'
                                    : 'text-primary-800/50'
                              )}
                            >
                              {event.title}
                            </h4>
                            <span className="text-sm text-primary-800/50">
                              {formatDate(event.time)}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-sm text-primary-800/60">{event.description}</p>
                          )}
                          {event.status === 'current' && (
                            <span className="inline-block mt-2 px-2 py-1 bg-accent-100 text-accent-700 text-xs font-medium rounded">
                              当前阶段
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'stats' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-green-50 rounded-xl text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {presale.soldStock}
                    </div>
                    <div className="text-sm text-green-700/70">已售出</div>
                  </div>
                  <div className="p-6 bg-blue-50 rounded-xl text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {presale.lockedStock}
                    </div>
                    <div className="text-sm text-blue-700/70">待取书</div>
                  </div>
                  <div className="p-6 bg-amber-50 rounded-xl text-center">
                    <div className="text-3xl font-bold text-amber-600 mb-1">
                      {detail.waitlistCount}
                    </div>
                    <div className="text-sm text-amber-700/70">候补人数</div>
                  </div>
                  <div className="p-6 bg-gray-50 rounded-xl text-center">
                    <div className="text-3xl font-bold text-gray-600 mb-1">
                      {presale.totalStock - presale.soldStock - presale.lockedStock}
                    </div>
                    <div className="text-sm text-gray-700/70">剩余库存</div>
                  </div>
                  <div className="p-6 bg-red-50 rounded-xl text-center">
                    <div className="text-3xl font-bold text-red-600 mb-1">
                      {detail.refunds.length}
                    </div>
                    <div className="text-sm text-red-700/70">退款记录</div>
                  </div>
                  <div className="p-6 bg-purple-50 rounded-xl text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-1">
                      {detail.stockReleases.length}
                    </div>
                    <div className="text-sm text-purple-700/70">库存释放</div>
                  </div>
                </div>
              )}

              {countdown && (
                <div className="mt-6 p-4 bg-gradient-to-r from-accent-500/10 to-accent-500/5 rounded-xl border border-accent-500/20">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-accent-600" />
                    <div>
                      <div className="text-sm text-primary-800/60">
                        {presale.status === 'upcoming' ? '距离预售开始' : '距离预售结束'}
                      </div>
                      <div className="text-xl font-mono font-bold text-accent-600">
                        {countdown}
                      </div>
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
                <span className="font-semibold text-primary-800">
                  {Math.max(0, availableStock)} 本
                </span>
              </div>
              {detail.waitlistCount > 0 && (
                <div className="flex items-center justify-between py-3 border-b border-primary-800/10">
                  <span className="text-primary-800/60">候补人数</span>
                  <span className="font-semibold text-amber-600">
                    {detail.waitlistCount} 人
                  </span>
                </div>
              )}

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
                  <span className="w-8 text-center font-semibold text-primary-800">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={presale.status !== 'active'}
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
              <span>剩余 {Math.max(0, availableStock)}</span>
            </div>

            {user?.role === 'member' && availability.message && (
              <div
                className={cn(
                  'p-3 rounded-lg text-sm mb-4 flex items-start gap-2',
                  availability.available
                    ? 'bg-green-50 text-green-600'
                    : availability.canWaitlist
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-red-50 text-red-600'
                )}
              >
                {availability.available ? (
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : availability.canWaitlist ? (
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
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
              <div className="space-y-3">
                {availability.available && (
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
                {!availability.available && availability.canWaitlist && (
                  <button
                    onClick={handleWaitlistReserve}
                    disabled={actionLoading}
                    className={cn(
                      'w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all',
                      !actionLoading
                        ? 'bg-amber-500 text-white hover:bg-amber-500/90 active:scale-[0.98] shadow-lg'
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
                        <RefreshCw className="w-5 h-5" />
                        加入候补
                      </>
                    )}
                  </button>
                )}
              </div>
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
                        loadDetail();
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
