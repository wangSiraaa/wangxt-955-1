import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, BookOpen, Calendar, DollarSign, Package } from 'lucide-react';
import { presaleApi } from '../api/endpoints.js';
import { cn } from '../lib/utils.js';
import dayjs from 'dayjs';

export default function CreatePresale() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    bookTitle: '',
    bookAuthor: '',
    bookIsbn: '',
    bookCover: '',
    description: '',
    price: '',
    deposit: '',
    totalStock: '',
    presaleStartTime: dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm'),
    presaleEndTime: dayjs().add(7, 'day').format('YYYY-MM-DDTHH:mm'),
    pickupDeadline: dayjs().add(30, 'day').format('YYYY-MM-DDTHH:mm'),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.bookTitle.trim()) newErrors.bookTitle = '请输入书名';
    if (!form.bookAuthor.trim()) newErrors.bookAuthor = '请输入作者';
    if (!form.description.trim()) newErrors.description = '请输入内容简介';
    if (!form.price || parseFloat(form.price) <= 0) newErrors.price = '请输入有效的预售价格';
    if (!form.deposit || parseFloat(form.deposit) <= 0) newErrors.deposit = '请输入有效的订金金额';
    if (!form.totalStock || parseInt(form.totalStock) <= 0) newErrors.totalStock = '请输入有效的库存数量';
    if (!form.presaleStartTime) newErrors.presaleStartTime = '请选择预售开始时间';
    if (!form.presaleEndTime) newErrors.presaleEndTime = '请选择预售结束时间';
    if (!form.pickupDeadline) newErrors.pickupDeadline = '请选择取书截止时间';

    if (form.presaleStartTime && form.presaleEndTime) {
      if (dayjs(form.presaleStartTime).isAfter(dayjs(form.presaleEndTime))) {
        newErrors.presaleEndTime = '结束时间必须晚于开始时间';
      }
    }
    if (form.presaleEndTime && form.pickupDeadline) {
      if (dayjs(form.presaleEndTime).isAfter(dayjs(form.pickupDeadline))) {
        newErrors.pickupDeadline = '取书截止时间必须晚于预售结束时间';
      }
    }
    if (parseFloat(form.deposit) >= parseFloat(form.price)) {
      newErrors.deposit = '订金必须低于预售价格';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const presale = await presaleApi.create({
        bookTitle: form.bookTitle,
        bookAuthor: form.bookAuthor,
        bookIsbn: form.bookIsbn,
        bookCover: form.bookCover || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop',
        description: form.description,
        price: parseFloat(form.price),
        deposit: parseFloat(form.deposit),
        totalStock: parseInt(form.totalStock),
        presaleStartTime: dayjs(form.presaleStartTime).format('YYYY-MM-DD HH:mm:ss'),
        presaleEndTime: dayjs(form.presaleEndTime).format('YYYY-MM-DD HH:mm:ss'),
        pickupDeadline: dayjs(form.pickupDeadline).format('YYYY-MM-DD HH:mm:ss'),
      });
      navigate(`/presales/${presale.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => navigate('/presales')}
        className="inline-flex items-center gap-2 text-primary-800/60 hover:text-primary-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        返回预售列表
      </button>

      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-8">
          <h1 className="text-2xl font-serif font-bold text-primary-800 mb-6 flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-accent-500" />
            发布新预售
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-6 bg-cream-100 rounded-xl space-y-4">
              <h3 className="font-semibold text-primary-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                书籍基本信息
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-800/80 mb-2">
                    书名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="bookTitle"
                    value={form.bookTitle}
                    onChange={handleChange}
                    placeholder="请输入书名"
                    className={cn(
                      'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none',
                      errors.bookTitle ? 'border-red-300' : 'border-primary-800/20'
                    )}
                  />
                  {errors.bookTitle && <p className="text-red-500 text-sm mt-1">{errors.bookTitle}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-800/80 mb-2">
                    作者 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="bookAuthor"
                    value={form.bookAuthor}
                    onChange={handleChange}
                    placeholder="请输入作者"
                    className={cn(
                      'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none',
                      errors.bookAuthor ? 'border-red-300' : 'border-primary-800/20'
                    )}
                  />
                  {errors.bookAuthor && <p className="text-red-500 text-sm mt-1">{errors.bookAuthor}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-primary-800/80 mb-2">ISBN</label>
                  <input
                    type="text"
                    name="bookIsbn"
                    value={form.bookIsbn}
                    onChange={handleChange}
                    placeholder="请输入ISBN（可选）"
                    className="w-full px-4 py-3 border border-primary-800/20 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-primary-800/80 mb-2">封面图片URL</label>
                  <input
                    type="text"
                    name="bookCover"
                    value={form.bookCover}
                    onChange={handleChange}
                    placeholder="请输入封面图片URL（可选，将使用默认封面）"
                    className="w-full px-4 py-3 border border-primary-800/20 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-800/80 mb-2">
                  内容简介 <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="请输入书籍内容简介"
                  className={cn(
                    'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none resize-none',
                    errors.description ? 'border-red-300' : 'border-primary-800/20'
                  )}
                />
                {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
              </div>
            </div>

            <div className="p-6 bg-cream-100 rounded-xl space-y-4">
              <h3 className="font-semibold text-primary-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                价格设置
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-800/80 mb-2">
                    预售价格 (元) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={cn(
                      'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none',
                      errors.price ? 'border-red-300' : 'border-primary-800/20'
                    )}
                  />
                  {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-800/80 mb-2">
                    订金 (元) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="deposit"
                    value={form.deposit}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={cn(
                      'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none',
                      errors.deposit ? 'border-red-300' : 'border-primary-800/20'
                    )}
                  />
                  {errors.deposit && <p className="text-red-500 text-sm mt-1">{errors.deposit}</p>}
                </div>
              </div>
            </div>

            <div className="p-6 bg-cream-100 rounded-xl space-y-4">
              <h3 className="font-semibold text-primary-800 flex items-center gap-2">
                <Package className="w-5 h-5" />
                库存与时间设置
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-800/80 mb-2">
                    总库存 (本) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="totalStock"
                    value={form.totalStock}
                    onChange={handleChange}
                    min="1"
                    placeholder="100"
                    className={cn(
                      'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none',
                      errors.totalStock ? 'border-red-300' : 'border-primary-800/20'
                    )}
                  />
                  {errors.totalStock && <p className="text-red-500 text-sm mt-1">{errors.totalStock}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-800/80 mb-2">
                    预售开始时间 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="presaleStartTime"
                    value={form.presaleStartTime}
                    onChange={handleChange}
                    className={cn(
                      'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none',
                      errors.presaleStartTime ? 'border-red-300' : 'border-primary-800/20'
                    )}
                  />
                  {errors.presaleStartTime && <p className="text-red-500 text-sm mt-1">{errors.presaleStartTime}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-800/80 mb-2">
                    预售结束时间 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="presaleEndTime"
                    value={form.presaleEndTime}
                    onChange={handleChange}
                    className={cn(
                      'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none',
                      errors.presaleEndTime ? 'border-red-300' : 'border-primary-800/20'
                    )}
                  />
                  {errors.presaleEndTime && <p className="text-red-500 text-sm mt-1">{errors.presaleEndTime}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-800/80 mb-2">
                  取书截止时间 <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="pickupDeadline"
                  value={form.pickupDeadline}
                  onChange={handleChange}
                  className={cn(
                    'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all outline-none',
                    errors.pickupDeadline ? 'border-red-300' : 'border-primary-800/20'
                  )}
                />
                {errors.pickupDeadline && <p className="text-red-500 text-sm mt-1">{errors.pickupDeadline}</p>}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/presales')}
                className="flex-1 py-4 border border-primary-800/20 text-primary-800 rounded-xl font-semibold hover:bg-primary-800/5 transition-all"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all',
                  loading
                    ? 'bg-primary-800/70 cursor-not-allowed text-white'
                    : 'bg-primary-800 text-white hover:bg-primary-800/90 active:scale-[0.98] shadow-lg'
                )}
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
                    发布中...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    发布预售
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
