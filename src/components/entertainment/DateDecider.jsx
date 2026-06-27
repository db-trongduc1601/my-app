import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, Ticket, RefreshCw, Plus, X, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const FilterBtn = ({ active, onClick, emoji, label }) => (
  <button onClick={onClick}
    className={cn(
      "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all duration-200 text-sm font-medium",
      active
        ? "border-primary bg-primary text-primary-foreground shadow-md scale-105"
        : "border-border liquid-glass-sm text-muted-foreground hover:border-primary/30"
    )}>
    <span className="text-xl">{emoji}</span>
    {label}
  </button>
);

function SpotDetailModal({ spot, open, onClose }) {
  if (!spot) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 liquid-glass">
        {spot.anh
          ? <img src={spot.anh} alt={spot.ten_dia_diem} className="w-full h-44 object-cover" />
          : <div className="w-full h-32 gradient-rose flex items-center justify-center text-5xl">🏞️</div>
        }
        <div className="p-4 space-y-3">
          <h3 className="font-display text-xl font-semibold">{spot.ten_dia_diem}</h3>
          <div className="space-y-1.5">
            {spot.dia_chi && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={13}/>{spot.dia_chi}</div>}
            {spot.gia_ve && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Ticket size={13}/>{spot.gia_ve}</div>}
            {spot.gio_hoat_dong && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock size={13}/>{spot.gio_hoat_dong}</div>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-2 py-1 rounded-full liquid-glass-sm">{spot.khong_gian}</span>
            <span className="text-xs px-2 py-1 rounded-full liquid-glass-sm">{spot.nang_luong}</span>
            <span className="text-xs px-2 py-1 rounded-full liquid-glass-sm">{spot.thoi_diem}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY_FORM = { ten_dia_diem: '', khong_gian: 'Trong nhà', nang_luong: 'Chilling', thoi_diem: 'Sáng', dia_chi: '', gia_ve: '', gio_hoat_dong: '', anh: '' };

export default function DateDecider({ spots, onRefresh }) {
  const [r1, setR1] = useState(null);
  const [r2, setR2] = useState(null);
  const [r3, setR3] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const filtered = spots.filter(s => {
    if (r1 && s.khong_gian !== r1) return false;
    if (r2 && s.nang_luong !== r2) return false;
    if (r3 && s.thoi_diem !== r3) return false;
    return true;
  });

  const reset = () => { setR1(null); setR2(null); setR3(null); };

  const handleAdd = async () => {
    if (!form.ten_dia_diem) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'date_spots'), form);
      toast.success('📍 Đã thêm địa điểm!');
      setForm(EMPTY_FORM);
      setShowAdd(false);
      onRefresh?.();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi thêm địa điểm!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={() => setShowAdd(v => !v)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-secondary/50 transition-colors">
        {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Huỷ' : 'Thêm địa điểm'}
      </button>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="liquid-glass rounded-2xl p-4 space-y-3">
            <Input placeholder="Tên địa điểm *" value={form.ten_dia_diem} onChange={e => setForm(f => ({...f, ten_dia_diem: e.target.value}))} />
            <div className="grid grid-cols-3 gap-2">
              <Select value={form.khong_gian} onValueChange={v => setForm(f => ({...f, khong_gian: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Trong nhà">Trong nhà</SelectItem>
                  <SelectItem value="Ngoài trời">Ngoài trời</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.nang_luong} onValueChange={v => setForm(f => ({...f, nang_luong: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chilling">Chilling</SelectItem>
                  <SelectItem value="Hoạt động">Hoạt động</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.thoi_diem} onValueChange={v => setForm(f => ({...f, thoi_diem: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sáng">Sáng</SelectItem>
                  <SelectItem value="Tối">Tối</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Địa chỉ" value={form.dia_chi} onChange={e => setForm(f => ({...f, dia_chi: e.target.value}))} />
            <Input placeholder="Giá vé" value={form.gia_ve} onChange={e => setForm(f => ({...f, gia_ve: e.target.value}))} />
            <Input placeholder="Giờ hoạt động" value={form.gio_hoat_dong} onChange={e => setForm(f => ({...f, gio_hoat_dong: e.target.value}))} />
            <Input placeholder="URL ảnh (tuỳ chọn)" value={form.anh} onChange={e => setForm(f => ({...f, anh: e.target.value}))} />
            <Button onClick={handleAdd} disabled={saving} className="w-full gradient-primary text-white border-0 rounded-xl">
              {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Thêm địa điểm
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Vòng 1 — Không gian</p>
        <div className="flex gap-2">
          <FilterBtn active={r1 === 'Trong nhà'} onClick={() => setR1(r1 === 'Trong nhà' ? null : 'Trong nhà')} emoji="🏠" label="Trong nhà" />
          <FilterBtn active={r1 === 'Ngoài trời'} onClick={() => setR1(r1 === 'Ngoài trời' ? null : 'Ngoài trời')} emoji="🌿" label="Ngoài trời" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Vòng 2 — Năng lượng</p>
        <div className="flex gap-2">
          <FilterBtn active={r2 === 'Chilling'} onClick={() => setR2(r2 === 'Chilling' ? null : 'Chilling')} emoji="☕" label="Chilling" />
          <FilterBtn active={r2 === 'Hoạt động'} onClick={() => setR2(r2 === 'Hoạt động' ? null : 'Hoạt động')} emoji="🎮" label="Hoạt động" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Vòng 3 — Thời điểm</p>
        <div className="flex gap-2">
          <FilterBtn active={r3 === 'Sáng'} onClick={() => setR3(r3 === 'Sáng' ? null : 'Sáng')} emoji="☀️" label="Sáng" />
          <FilterBtn active={r3 === 'Tối'} onClick={() => setR3(r3 === 'Tối' ? null : 'Tối')} emoji="🌙" label="Tối" />
        </div>
      </div>

      {(r1 || r2 || r3) && (
        <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
          <RefreshCw size={11} /> Reset
        </button>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{filtered.length} địa điểm</p>
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground">
              <p className="text-3xl mb-2">🗺️</p>
              <p className="text-sm">Không tìm thấy địa điểm phù hợp</p>
            </motion.div>
          ) : filtered.map(spot => (
            <motion.div key={spot.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="liquid-glass liquid-glass-interactive rounded-2xl p-3 flex gap-3 items-center cursor-pointer"
              onClick={() => setSelected(spot)}>
              {spot.anh
                ? <img src={spot.anh} alt={spot.ten_dia_diem} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-14 h-14 rounded-xl gradient-rose flex items-center justify-center flex-shrink-0 text-2xl">🏞️</div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{spot.ten_dia_diem}</p>
                {spot.dia_chi && <p className="text-xs text-muted-foreground mt-0.5 truncate"><MapPin size={10} className="inline mr-1"/>{spot.dia_chi}</p>}
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full liquid-glass-sm">{spot.khong_gian}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full liquid-glass-sm">{spot.nang_luong}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <SpotDetailModal spot={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}