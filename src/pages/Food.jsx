import { useQuery } from '@tanstack/react-query';
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import FoodDecider from '@/components/food/FoodDecider';
import FoodSwipeMatcher from '@/components/food/FoodSwipeMatcher';
import { Plus, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const EMPTY_FORM = {
  ten_mon: '', nhiet_do: 'Nóng hổi', loai_no: 'Ăn no nê',
  kieu_an: 'Nước', quoc_tich: 'Việt', khoang_cach: 'Gần nhà',
  ngan_sach: 'Bình dân', dia_chi: '', gia_uoc_tinh: '', gio_mo_cua: '', anh: ''
};

export default function Food() {
  const currentUser = auth.currentUser;
  const [activeTab, setActiveTab] = useState('decider'); // 'decider' hoặc 'swipe'

  const { data: foods = [], refetch } = useQuery({
    queryKey: ['food'],
    queryFn: async () => {
      const querySnapshot = await getDocs(collection(db, 'foods'));
      return querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.ten_mon || '').localeCompare(b.ten_mon || ''));
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.ten_mon) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'foods'), { ...form, chot_don: false });
      toast.success(`🍜 Đã thêm ${form.ten_mon}!`);
      setForm(EMPTY_FORM);
      setShowAdd(false);
      refetch();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi thêm món ăn!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Ăn Gì? 🍜</h1>
          <p className="text-xs text-muted-foreground mt-0.5">hết lo không biết ăn gì nữa</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="w-9 h-9 rounded-full gradient-primary text-primary-foreground flex items-center justify-center shadow-md animate-glow-pulse hover:opacity-90 transition">
          {showAdd ? <X size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 liquid-glass rounded-2xl p-1">
        <button onClick={() => setActiveTab('decider')}
          className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition-all",
            activeTab === 'decider' ? "liquid-glass shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          Gợi ý & Bộ lọc 🔍
        </button>
        <button onClick={() => setActiveTab('swipe')}
          className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition-all",
            activeTab === 'swipe' ? "liquid-glass shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          Game quẹt món 🎯
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="liquid-glass rim-light rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold">Thêm món mới</p>
            <Input placeholder="Tên món *" value={form.ten_mon} onChange={e => setForm(f => ({...f, ten_mon: e.target.value}))} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.nhiet_do} onValueChange={v => setForm(f => ({...f, nhiet_do: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nóng hổi">🔥 Nóng hổi</SelectItem>
                  <SelectItem value="Lạnh mát">🧊 Lạnh mát</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.loai_no} onValueChange={v => setForm(f => ({...f, loai_no: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ăn no nê">🍛 Ăn no nê</SelectItem>
                  <SelectItem value="Ăn vặt sương sương">🧁 Ăn vặt</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.kieu_an} onValueChange={v => setForm(f => ({...f, kieu_an: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nước">🍲 Nước</SelectItem>
                  <SelectItem value="Khô">🍱 Khô</SelectItem>
                  <SelectItem value="Cuốn">🌯 Cuốn</SelectItem>
                  <SelectItem value="Nướng-Chiên">🍖 Nướng/Chiên</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.quoc_tich} onValueChange={v => setForm(f => ({...f, quoc_tich: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Việt">🇻🇳 Món Việt</SelectItem>
                  <SelectItem value="Hàn">🇰🇷 Món Hàn</SelectItem>
                  <SelectItem value="Nhật">🇯🇵 Món Nhật</SelectItem>
                  <SelectItem value="Âu">🇮🇹 Món Âu</SelectItem>
                  <SelectItem value="Khác">Khác</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.khoang_cach} onValueChange={v => setForm(f => ({...f, khoang_cach: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gần nhà">🏠 Gần nhà (&lt;2km)</SelectItem>
                  <SelectItem value="Đi xa">🚗 Đi xa (&gt;2km)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.ngan_sach} onValueChange={v => setForm(f => ({...f, ngan_sach: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bình dân">💰 Bình dân</SelectItem>
                  <SelectItem value="Sang chảnh">💎 Sang chảnh</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Địa chỉ quán (tuỳ chọn)" value={form.dia_chi} onChange={e => setForm(f => ({...f, dia_chi: e.target.value}))} />
            <Input placeholder="URL ảnh (tuỳ chọn)" value={form.anh} onChange={e => setForm(f => ({...f, anh: e.target.value}))} />
            <Button onClick={handleAdd} disabled={saving} className="w-full gradient-primary text-white border-0 rounded-xl">
              {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Thêm món
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'decider' && <FoodDecider foods={foods} onConfirm={refetch} onRefresh={refetch} />}
      {activeTab === 'swipe' && <FoodSwipeMatcher foods={foods} currentUser={currentUser} onRefresh={refetch} />}
    </div>
  );
}