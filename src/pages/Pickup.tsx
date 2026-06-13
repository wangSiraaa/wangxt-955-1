import { useState, useEffect } from 'react';
import {
  Search,
  Package,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  User,
  BookOpen,
  CreditCard,
  QrCode,
  Clock,
  ArrowRight,
  ScanLine,
  Unlock,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { orderApi, presaleApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { cn, formatDateTime, formatDate } from '../lib/utils.js';
import type { Order, Presale } from '../../shared/types.js';
import dayjs from 'dayjs';

export default function Pickup() {
  const { user } = useAuthStore();
  const [pickupCode, setPickupCode] = useState('');
  const [searchResult, setSearchResult] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [expireLoading, setExpireLoading] = useState<string | null>(null);
  const [batchReleaseLoading, setBatchReleaseLoading] = useState(false);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [overdueOrders, setOverdueOrders] = useState<Order[]>([]);
  const [presales, setPresales] = useState<Record<string, Presale>>({});
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'pickup' | 'overdue'>('pickup');
  const [autoExpiredCount, setAutoExpiredCount] = useState(0);
  const [showAutoNotice, setShowAutoNotice] = useState(false);

  useEffect(() => {
    if (user) {
      loadAllOrders();
    }
  }, [user]);

  const isOrderOverdue = (order: Order): boolean => {
    const presale = presales[order.presaleId];
    if (!presale) return false;
    if (order.pickupStatus === 'picked' || order.pickupStatus === 'expired') return false;
    if (order.paymentStatus !== 'paid') return false;
    return dayjs().isAfter(dayjs(presale.pickupDeadline));
  };

  const loadAllOrders = async () => {
    try {
      const [ordersData, presalesData] = await Promise.all([
        orderApi.getAll(),
        presaleApi.getAll(),
      ]);
      
      const presaleMap: Record<string, Presale> = {};
      presalesData.forEach((p) => {
        presaleMap[p.id] = p;
      });
      setPresales(presaleMap);

      const isStaff = user?.role === 'clerk' || user?.role === 'warehouse';
      
      const filteredOrders = isStaff 
        ? ordersData 
        : ordersData.filter((o) => o.userId === user?.id);

      const readyOrders = filteredOrders.filter(
        (o) => o.paymentStatus === 'paid' && o.pickupStatus === 'ready'
      );
      setMyOrders(readyOrders);

      const stillOverdueList = filteredOrders.filter(
        (o) => o.paymentStatus === 'paid' 
          && o.pickupStatus !== 'picked' 
          && o.pickupStatus !== 'expired'
          && isOrderOverdue(o)
      );
      setOverdueOrders(stillOverdueList);

      const alreadyExpiredList = filteredOrders.filter(
        (o) => o.pickupStatus === 'expired'
      );
      if (alreadyExpiredList.length > 0) {
        setAutoExpiredCount(alreadyExpiredList.length);
        setShowAutoNotice(true);
        setTimeout(() => setShowAutoNotice(false), 6000);
      }
    } catch (err) {
      console.error('加载订单失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMyOrders = loadAllOrders;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupCode.trim()) return;

    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    setSuccessMessage('');

    try {
      const order = await orderApi.getByPickupCode(pickupCode.trim().toUpperCase());
      setSearchResult(order);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : '未找到该取书码对应的订单');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmPickup = async () => {
    if (!searchResult) return;

    setConfirming(true);
    try {
      const updatedOrder = await orderApi.pickup(searchResult.pickupCode);
      setSearchResult(updatedOrder);
      setSuccessMessage('取书确认成功！');
      setPickupCode('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : '取书确认失败');
    } finally {
      setConfirming(false);
    }
  };

  const handleQuickFill = (code: string) => {
    setPickupCode(code);
  };

  const handleExpireOrder = async (orderId: string) => {
    if (!confirm('确认要释放该逾期订单的库存吗？释放后订单将取消，订金将退还会员。')) return;
    
    setExpireLoading(orderId);
    try {
      await orderApi.expireOrder(orderId);
      await loadAllOrders();
      if (searchResult?.id === orderId) {
        setSearchResult(null);
      }
      setSuccessMessage('订单已成功释放，库存已退回。');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : '释放失败');
    } finally {
      setExpireLoading(null);
    }
  };

  const handleBatchRelease = async () => {
    if (overdueOrders.length === 0) {
      alert('没有需要释放的逾期订单');
      return;
    }
    if (!confirm(`确认要释放 ${overdueOrders.length} 个逾期订单的库存吗？`)) return;
    
    setBatchReleaseLoading(true);
    try {
      const result = await orderApi.releaseExpired();
      await loadAllOrders();
      setSearchResult(null);
      setSuccessMessage(`成功释放 ${result.count} 个逾期订单`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : '批量释放失败');
    } finally {
      setBatchReleaseLoading(false);
    }
  };

  const isSearchResultOverdue = (): boolean => {
    if (!searchResult) return false;
    return isOrderOverdue(searchResult);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary-800/20 border-t-primary-800 rounded-full" />
      </div>
    );
  }

  const isStaff = user?.role === 'clerk' || user?.role === 'warehouse';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-primary-800 mb-2">取书管理</h1>
        <p className="text-primary-800/60">
          {isStaff ? '输入取书码确认会员取书' : '查看您的待取书订单'}
        </p>
      </div>

      {isStaff && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pickup')}
            className={cn(
              'px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2',
              activeTab === 'pickup'
                ? 'bg-primary-800 text-white'
                : 'bg-white text-primary-800/70 hover:bg-primary-800/5'
            )}
          >
            <ScanLine className="w-5 h-5" />
            取书管理
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={cn(
              'px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2',
              activeTab === 'overdue'
                ? 'bg-red-600 text-white'
                : 'bg-white text-primary-800/70 hover:bg-primary-800/5'
            )}
          >
            <AlertTriangle className="w-5 h-5" />
            逾期处理
            {overdueOrders.length > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {overdueOrders.length}
              </span>
            )}
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800 font-medium">{successMessage}</span>
        </div>
      )}

      {isStaff && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-primary-800 mb-6 flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-accent-600" />
                扫描取书码
              </h2>

              <form onSubmit={handleSearch} className="mb-6">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-800/40" />
                    <input
                      type="text"
                      value={pickupCode}
                      onChange={(e) => setPickupCode(e.target.value.toUpperCase())}
                      placeholder="请输入6位取书码"
                      className="w-full pl-12 pr-4 py-4 border-2 border-primary-800/20 rounded-xl focus:border-accent-500 focus:outline-none transition-colors text-xl font-mono tracking-widest text-center"
                      maxLength={6}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searching || !pickupCode.trim()}
                    className={cn(
                      'px-8 py-4 rounded-xl font-semibold flex items-center gap-2 transition-all',
                      !searching && pickupCode.trim()
                        ? 'bg-primary-800 text-white hover:bg-primary-800/90 active:scale-[0.98]'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {searching ? (
                      <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                    查询
                  </button>
                </div>
              </form>

              {searchError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">查询失败</p>
                    <p className="text-sm text-red-600">{searchError}</p>
                  </div>
                </div>
              )}

              {searchResult && activeTab === 'pickup' && (
                <div className={cn(
                  'border-2 rounded-xl overflow-hidden',
                  isSearchResultOverdue() ? 'border-red-300' : 'border-accent-500/30'
                )}>
                  <div className={cn(
                    'px-6 py-4 border-b',
                    isSearchResultOverdue() ? 'bg-red-50 border-red-200' : 'bg-accent-500/10 border-accent-500/30'
                  )}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-primary-800">订单信息</h3>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold',
                          isSearchResultOverdue()
                            ? 'bg-red-100 text-red-600 animate-pulse'
                            : searchResult.pickupStatus === 'ready'
                            ? 'bg-accent-500/10 text-accent-600'
                            : searchResult.pickupStatus === 'picked'
                            ? 'bg-green-50 text-green-600'
                            : searchResult.pickupStatus === 'expired'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {isSearchResultOverdue()
                          ? '已逾期'
                          : searchResult.pickupStatus === 'ready'
                          ? '待取书'
                          : searchResult.pickupStatus === 'picked'
                          ? '已取书'
                          : searchResult.pickupStatus === 'expired'
                          ? '已取消'
                          : '状态异常'}
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-gradient-to-br from-primary-800/10 to-accent-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-8 h-8 text-primary-800/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-primary-800 text-lg">
                          {presales[searchResult.presaleId]?.bookTitle || '加载中...'}
                        </h4>
                        <p className="text-sm text-primary-800/50">
                          作者：{presales[searchResult.presaleId]?.bookAuthor}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-3 bg-cream-50 rounded-lg">
                        <div className="text-xs text-primary-800/50 mb-1 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          预订人
                        </div>
                        <div className="font-semibold text-primary-800">
                          {searchResult.userName}
                        </div>
                      </div>
                      <div className="p-3 bg-cream-50 rounded-lg">
                        <div className="text-xs text-primary-800/50 mb-1 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          数量
                        </div>
                        <div className="font-semibold text-primary-800">
                          {searchResult.quantity} 本
                        </div>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-xs text-primary-800/50 mb-1 flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          已付订金
                        </div>
                        <div className="font-semibold text-green-600">
                          ¥{searchResult.depositAmount}
                        </div>
                      </div>
                      <div className="p-3 bg-accent-500/10 rounded-lg">
                        <div className="text-xs text-primary-800/50 mb-1 flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          应收尾款
                        </div>
                        <div className="font-semibold text-accent-600">
                          ¥{searchResult.totalAmount - searchResult.depositAmount}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-cream-100 rounded-xl mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-primary-800/60">订单总额</span>
                        <span className="text-xl font-bold text-primary-800">
                          ¥{searchResult.totalAmount}
                        </span>
                      </div>
                    </div>

                    {isSearchResultOverdue() && (
                      <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-200">
                        <div className="flex items-start gap-3 mb-4">
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-red-800">订单已逾期</p>
                            <p className="text-sm text-red-600">
                              已超过取书截止日期 {formatDate(presales[searchResult.presaleId]?.pickupDeadline)}，无法取书
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleExpireOrder(searchResult.id)}
                          disabled={expireLoading === searchResult.id}
                          className={cn(
                            'w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all',
                            expireLoading !== searchResult.id
                              ? 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          )}
                        >
                          {expireLoading === searchResult.id ? (
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
                      </div>
                    )}

                    {searchResult.pickupStatus === 'expired' && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-start gap-3">
                          <XCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-gray-700">订单已取消</p>
                            <p className="text-sm text-gray-500">
                              已超过取书期限，订单已取消，订金 ¥{searchResult.depositAmount} 已退还
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {searchResult.pickupStatus === 'ready' && !isSearchResultOverdue() && (
                      <button
                        onClick={handleConfirmPickup}
                        disabled={confirming}
                        className={cn(
                          'w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all',
                          !confirming
                            ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white hover:shadow-lg active:scale-[0.98]'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        )}
                      >
                        {confirming ? (
                          <>
                            <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
                            确认中...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            确认取书（收取尾款 ¥
                            {searchResult.totalAmount - searchResult.depositAmount}）
                          </>
                        )}
                      </button>
                    )}

                    {searchResult.pickupStatus === 'picked' && searchResult.pickupAt && (
                      <div className="p-4 bg-green-50 rounded-xl text-center">
                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="font-medium text-green-800">已完成取书</p>
                        <p className="text-sm text-green-600">
                          取书时间：{formatDateTime(searchResult.pickupAt)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'overdue' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-primary-800 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      逾期订单列表
                    </h2>
                    {overdueOrders.length > 0 && (
                      <button
                        onClick={handleBatchRelease}
                        disabled={batchReleaseLoading}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all',
                          !batchReleaseLoading
                            ? 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'
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
                            批量释放 ({overdueOrders.length})
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {overdueOrders.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl">
                      <CheckCircle className="w-16 h-16 text-green-500/20 mx-auto mb-4" />
                      <p className="text-primary-800/50 mb-2">暂无逾期订单</p>
                      <p className="text-sm text-primary-800/30">所有订单都在取书期限内</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {overdueOrders.map((order) => {
                        const presale = presales[order.presaleId];
                        return (
                          <div
                            key={order.id}
                            className="bg-white rounded-2xl shadow-md overflow-hidden border-2 border-red-200"
                          >
                            <div className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                  <div className="w-16 h-16 bg-gradient-to-br from-red-500/10 to-red-600/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-8 h-8 text-red-600/40" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-primary-800 text-lg">
                                      {presale?.bookTitle || '加载中...'}
                                    </h3>
                                    <p className="text-sm text-primary-800/50">
                                      订单号：{order.orderNo}
                                    </p>
                                    <p className="text-sm text-red-600">
                                      取书截止：{formatDate(presale?.pickupDeadline)}
                                    </p>
                                  </div>
                                </div>
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600 animate-pulse">
                                  <AlertTriangle className="w-3 h-3" />
                                  已逾期
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-4 mb-4 pt-4 border-t border-primary-800/10">
                                <div>
                                  <div className="text-xs text-primary-800/50 mb-1">预订人</div>
                                  <div className="font-semibold text-primary-800">{order.userName}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-primary-800/50 mb-1">数量</div>
                                  <div className="font-semibold text-primary-800">{order.quantity} 本</div>
                                </div>
                                <div>
                                  <div className="text-xs text-primary-800/50 mb-1">订金</div>
                                  <div className="font-semibold text-accent-600">¥{order.depositAmount}</div>
                                </div>
                              </div>

                              <button
                                onClick={() => handleExpireOrder(order.id)}
                                disabled={expireLoading === order.id}
                                className={cn(
                                  'w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all',
                                  expireLoading !== order.id
                                    ? 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                )}
                              >
                                {expireLoading === order.id ? (
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
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {showAutoNotice && autoExpiredCount > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" style={{ animationDuration: '3s' }} />
                <div>
                  <p className="font-medium text-blue-800">系统自动处理</p>
                  <p className="text-sm text-blue-600">
                    检测到 {autoExpiredCount} 个逾期订单已自动取消，库存已释放并通知会员
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-primary-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary-800/60" />
                  {activeTab === 'overdue' ? '待处理逾期订单' : '今日待取书'}
                </h2>
                <button
                  onClick={loadAllOrders}
                  className="p-2 rounded-lg hover:bg-primary-800/10 transition-colors"
                  title="刷新数据"
                >
                  <RefreshCw className="w-4 h-4 text-primary-800/60" />
                </button>
              </div>

              <div className="space-y-3">
                {activeTab === 'overdue' && overdueOrders.length > 0 ? (
                  overdueOrders.slice(0, 5).map((order) => {
                    const presale = presales[order.presaleId];
                    return (
                      <div
                        key={order.id}
                        className="p-4 bg-red-50 rounded-xl border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
                        onClick={() => {
                          handleQuickFill(order.pickupCode);
                          setActiveTab('pickup');
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-red-800">{presale?.bookTitle}</p>
                            <p className="text-xs text-red-600">{order.userName} · {order.quantity}本</p>
                          </div>
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        </div>
                      </div>
                    );
                  })
                ) : activeTab === 'pickup' && myOrders.length > 0 ? (
                  myOrders.slice(0, 5).map((order) => {
                    const presale = presales[order.presaleId];
                    return (
                      <div
                        key={order.id}
                        className="p-4 bg-accent-500/5 rounded-xl border border-accent-500/20 cursor-pointer hover:bg-accent-500/10 transition-colors"
                        onClick={() => handleQuickFill(order.pickupCode)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-primary-800 truncate">{presale?.bookTitle}</p>
                            <p className="text-xs text-primary-800/60">{order.userName} · {order.quantity}本</p>
                          </div>
                          <Package className="w-4 h-4 text-accent-500" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-primary-800/50">
                    <Package className="w-12 h-12 mx-auto mb-3 text-primary-800/20" />
                    <p>
                      {activeTab === 'overdue'
                        ? overdueOrders.length === 0
                          ? '暂无逾期订单，太棒了！'
                          : '暂无待处理逾期订单'
                        : myOrders.length === 0
                        ? '暂无待取书订单'
                        : '暂无待取书订单数据'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {isStaff && (
              <div className="bg-white rounded-2xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-primary-800 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-gray-500" />
                    最近取消/逾期
                  </h2>
                  <span className="text-xs text-primary-800/50">
                    系统已自动处理 {autoExpiredCount} 个
                  </span>
                </div>
                <ExpiredOrdersList />
              </div>
            )}
          </div>
        </div>
      )}

      {user?.role === 'member' && (
        <div>
          {overdueOrders.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-serif font-bold text-primary-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                逾期订单
              </h2>
              <div className="space-y-4">
                {overdueOrders.map((order) => {
                  const presale = presales[order.presaleId];
                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl shadow-md overflow-hidden border-2 border-red-200"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-red-500/10 to-red-600/10 rounded-xl flex items-center justify-center flex-shrink-0">
                              <AlertTriangle className="w-8 h-8 text-red-600/40" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-primary-800 text-lg">
                                {presale?.bookTitle || '加载中...'}
                              </h3>
                              <p className="text-sm text-primary-800/50">
                                订单号：{order.orderNo}
                              </p>
                              <p className="text-sm text-red-600">
                                取书截止：{formatDate(presale?.pickupDeadline)}
                              </p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            已逾期
                          </span>
                        </div>

                        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                          <div className="flex items-start gap-3">
                            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-red-800">订单已逾期</p>
                              <p className="text-sm text-red-600">
                                已超过取书截止日期，无法取书。请联系店员，订金 ¥{order.depositAmount} 将自动退还。
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-serif font-bold text-primary-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-accent-600" />
              待取书订单
            </h2>
            {myOrders.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl">
                <Package className="w-16 h-16 text-primary-800/20 mx-auto mb-4" />
                <p className="text-primary-800/50 mb-2">暂无待取书订单</p>
                <p className="text-sm text-primary-800/30">
                  支付订金并等待书籍到货后，取书码将显示在这里
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myOrders.map((order) => {
                  const presale = presales[order.presaleId];
                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl shadow-md overflow-hidden"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
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
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-accent-500/10 text-accent-600">
                            <Package className="w-3 h-3" />
                            待取书
                          </span>
                        </div>

                        <div className="p-4 bg-gradient-to-br from-accent-500/5 to-primary-800/5 rounded-xl border-2 border-dashed border-accent-500/30 mb-4">
                          <div className="text-center">
                            <div className="text-sm text-primary-800/60 mb-2">取书码</div>
                            <div className="text-4xl font-mono font-bold text-accent-600 tracking-[0.5em]">
                              {order.pickupCode}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-primary-800/50 mb-1">数量</div>
                            <div className="font-semibold text-primary-800">
                              {order.quantity} 本
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-primary-800/50 mb-1">已付订金</div>
                            <div className="font-semibold text-accent-600">
                              ¥{order.depositAmount}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-primary-800/50 mb-1">待付尾款</div>
                            <div className="font-semibold text-primary-800">
                              ¥{order.totalAmount - order.depositAmount}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExpiredOrdersList() {
  const [expiredList, setExpiredList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpired();
  }, []);

  const loadExpired = async () => {
    try {
      const allOrders = await orderApi.getAll();
      const expired = allOrders.filter((o) => o.pickupStatus === 'expired').slice(0, 5);
      setExpiredList(expired);
    } catch (err) {
      console.error('加载逾期订单失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-4 text-center text-primary-800/40 text-sm">
        <div className="animate-spin w-4 h-4 border-2 border-primary-800/20 border-t-primary-800 rounded-full mx-auto" />
      </div>
    );
  }

  if (expiredList.length === 0) {
    return (
      <div className="py-6 text-center text-primary-800/40 text-sm">
        最近没有取消或逾期的订单
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {expiredList.map((order) => (
        <div
          key={order.id}
          className="p-3 bg-gray-50 rounded-lg border border-gray-100"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary-800 truncate">
                订单 {order.orderNo}
              </p>
              <p className="text-xs text-gray-500">
                {order.userName} · 订金 ¥{order.depositAmount} 已退还
              </p>
            </div>
            <span className="text-xs text-gray-400">
              {order.pickupAt ? formatDate(order.pickupAt) : formatDate(order.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
