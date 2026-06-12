import { useState, useEffect } from 'react';
import {
  Search,
  Package,
  CheckCircle,
  AlertCircle,
  User,
  BookOpen,
  CreditCard,
  QrCode,
  Clock,
  ArrowRight,
  ScanLine,
} from 'lucide-react';
import { orderApi, presaleApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { cn, formatDateTime } from '../lib/utils.js';
import type { Order, Presale } from '../../shared/types.js';

export default function Pickup() {
  const { user } = useAuthStore();
  const [pickupCode, setPickupCode] = useState('');
  const [searchResult, setSearchResult] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [presales, setPresales] = useState<Record<string, Presale>>({});
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (user?.role === 'member') {
      loadMyOrders();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadMyOrders = async () => {
    try {
      const [ordersData, presalesData] = await Promise.all([
        orderApi.getAll(),
        presaleApi.getAll(),
      ]);
      const readyOrders = ordersData.filter(
        (o) => o.paymentStatus === 'paid' && o.pickupStatus === 'ready'
      );
      setMyOrders(readyOrders);
      const presaleMap: Record<string, Presale> = {};
      presalesData.forEach((p) => {
        presaleMap[p.id] = p;
      });
      setPresales(presaleMap);
    } catch (err) {
      console.error('加载待取书订单失败:', err);
    } finally {
      setLoading(false);
    }
  };

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

              {searchResult && (
                <div className="border-2 border-accent-500/30 rounded-xl overflow-hidden">
                  <div className="bg-accent-500/10 px-6 py-4 border-b border-accent-500/30">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-primary-800">订单信息</h3>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold',
                          searchResult.pickupStatus === 'ready'
                            ? 'bg-accent-500/10 text-accent-600'
                            : searchResult.pickupStatus === 'picked'
                            ? 'bg-green-50 text-green-600'
                            : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {searchResult.pickupStatus === 'ready'
                          ? '待取书'
                          : searchResult.pickupStatus === 'picked'
                          ? '已取书'
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

                    {searchResult.pickupStatus === 'ready' && (
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
            </div>
          </div>

          <div>
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-primary-800 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-800/60" />
                今日待取书
              </h2>

              <div className="space-y-3">
                <div className="text-center py-8 text-primary-800/50">
                  <Package className="w-12 h-12 mx-auto mb-3 text-primary-800/20" />
                  <p>暂无待取书订单数据</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'member' && (
        <div>
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
                        <button
                          onClick={() => handleQuickFill(order.pickupCode)}
                          className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all',
                            isStaff
                              ? 'bg-primary-800/10 text-primary-800 hover:bg-primary-800/20'
                              : 'bg-accent-500/10 text-accent-600'
                          )}
                        >
                          {isStaff ? (
                            <>
                              快速录入
                              <ArrowRight className="w-4 h-4" />
                            </>
                          ) : (
                            <QrCode className="w-4 h-4" />
                          )}
                        </button>
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
      )}
    </div>
  );
}
