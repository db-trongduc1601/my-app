import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { db } from '../../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ShoppingCart, Check, RefreshCw, MapPin, DollarSign, Pencil, Trash2, Loader2, Plus, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import confetti from 'canvas-confetti';

/* ── Slice colors (pink palette) ─────────────────────── */
const SLICE_COLORS = [
  '#FF6B9D', '#FF8FAB', '#FFB3C6', '#FF4785', '#E91E8C',
  '#F72585', '#FF69B4', '#FF85B3', '#FFC2D4', '#FF4D7D',
];

/* ── Lucky Wheel Component ────────────────────────────── */
function LuckyWheel({ foods }) {
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [winnerFood, setWinnerFood] = useState(null);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef(null);
  const controls = useAnimation();

  // Sample up to 10 dishes per spin
  const [slices, setSlices] = useState(() => {
    if (foods.length <= 10) return foods;
    return [...foods].sort(() => Math.random() - 0.5).slice(0, 10);
  });

  // Re-sample when foods change
  useEffect(() => {
    if (foods.length <= 10) setSlices(foods);
    else setSlices([...foods].sort(() => Math.random() - 0.5).slice(0, 10));
  }, [foods.length]);

  const n = slices.length;
  if (n === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <p className="text-3xl mb-2">🍽️</p>
      <p className="text-sm">Chưa có món nào để quay!</p>
    </div>
  );

  const sliceAngle = 360 / n;

  const spin = () => {
    if (spinning) return;
    setWinner(null);
    setWinnerFood(null);

    // Re-sample on each spin if > 10
    let currentSlices = slices;
    if (foods.length > 10) {
      currentSlices = [...foods].sort(() => Math.random() - 0.5).slice(0, 10);
      setSlices(currentSlices);
    }

    const localN = currentSlices.length;
    const localSliceAngle = 360 / localN;

    // Pick random winner index
    const winnerIdx = Math.floor(Math.random() * localN);
    // Pointer is at top (270deg offset). Calculate angle to land winner slice under pointer.
    // Slice i spans from i*sliceAngle to (i+1)*sliceAngle. Center of winning slice:
    const winnerSliceCenter = winnerIdx * localSliceAngle + localSliceAngle / 2;
    // We need winnerSliceCenter to point up (at 270deg from 0/3 o'clock)
    const baseSpins = (5 + Math.floor(Math.random() * 4)) * 360;
    const targetAngle = baseSpins + (270 - winnerSliceCenter + 360) % 360;

    setSpinning(true);
    controls.start({
      rotate: rotation + targetAngle,
      transition: {
        duration: 3.5,
        ease: [0.17, 0.67, 0.12, 0.99],
      },
    }).then(() => {
      setRotation(prev => prev + targetAngle);
      setWinner(winnerIdx);
      setWinnerFood(currentSlices[winnerIdx]);
      setSpinning(false);

      // Confetti burst
      const wheelEl = wheelRef.current;
      if (wheelEl) {
        const rect = wheelEl.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { x, y },
          colors: ['#FF6B9D', '#FF8FAB', '#FFB3C6', '#ffffff', '#FF4785'],
        });
      }
    });
  };

  const size = 280;
  const r = size / 2;
  const cx = r;
  const cy = r;

  // Build SVG slices
  const buildSlicePath = (idx) => {
    const startAngle = (idx * sliceAngle - 90) * (Math.PI / 180);
    const endAngle = ((idx + 1) * sliceAngle - 90) * (Math.PI / 180);
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sliceAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  const buildTextPos = (idx) => {
    const midAngle = (idx * sliceAngle + sliceAngle / 2 - 90) * (Math.PI / 180);
    const textR = r * 0.62;
    return {
      x: cx + textR * Math.cos(midAngle),
      y: cy + textR * Math.sin(midAngle),
      rotate: idx * sliceAngle + sliceAngle / 2,
    };
  };

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Pointer triangle */}
      <div className="relative w-[280px]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
          <div style={{
            width: 0, height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop: '20px solid #FF4785',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
          }} />
        </div>

        {/* Wheel */}
        <motion.div ref={wheelRef} animate={controls} style={{ transformOrigin: 'center' }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {slices.map((slice, idx) => {
              const { x, y, rotate } = buildTextPos(idx);
              const isWinner = winner === idx;
              return (
                <g key={idx}>
                  <path
                    d={buildSlicePath(idx)}
                    fill={SLICE_COLORS[idx % SLICE_COLORS.length]}
                    stroke="white"
                    strokeWidth="2"
                    opacity={winner !== null && !isWinner ? 0.6 : 1}
                  />
                  <text
                    x={x} y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${rotate}, ${x}, ${y})`}
                    fontSize={sliceAngle < 40 ? 8 : 10}
                    fontWeight="700"
                    fill="white"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)', pointerEvents: 'none' }}
                  >
                    {slice.ten_mon?.length > 8 ? slice.ten_mon.slice(0, 7) + '…' : slice.ten_mon}
                  </text>
                </g>
              );
            })}
            {/* Center cap */}
            <circle cx={cx} cy={cy} r={22} fill="white" stroke="#FF4785" strokeWidth="3" />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="16">🎯</text>
          </svg>
        </motion.div>
      </div>

      {/* Spin button */}
      <button
        onClick={spin}
        disabled={spinning}
        className={cn(
          "px-8 py-3 rounded-2xl font-bold text-base transition-all",
          spinning
            ? "gradient-primary text-white opacity-60 cursor-not-allowed"
            : "gradient-primary text-white shadow-lg hover:scale-105 active:scale-95"
        )}
      >
        {spinning ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Đang quay...</span> : 'Xoay ngay 🎯'}
      </button>

      {/* Winner reveal */}
      <AnimatePresence>
        {winnerFood && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full liquid-glass rounded-2xl p-4 space-y-3"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center">🎉 Số phận đã chọn!</p>
            <div className="flex gap-3 items-center">
              {winnerFood.anh
                ? <img src={winnerFood.anh} alt={winnerFood.ten_mon} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-16 h-16 rounded-xl gradient-rose flex items-center justify-center flex-shrink-0 text-2xl">🍜</div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base truncate">{winnerFood.ten_mon}</p>
                {winnerFood.dia_chi && <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1"><MapPin size={11}/>{winnerFood.dia_chi}</div>}
                {winnerFood.gia_uoc_tinh && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><DollarSign size={11}/>{winnerFood.gia_uoc_tinh}</div>}
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {[winnerFood.nhiet_do, winnerFood.kieu_an, winnerFood.quoc_tich].filter(Boolean).map(v => (
                    <span key={v} className="text-[10px] px-2 py-0.5 rounded-full liquid-glass-sm">{v}</span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Filter Button ─────────────────────────────────────── */
const FilterBtn = ({ active, onClick, emoji, label }) => (
  <button onClick={onClick}
    className={cn(
      "flex-1 flex flex-col items-center gap-1 py-2.5 rounded-2xl border-2 transition-all duration-200 text-xs font-medium",
      active
        ? "border-primary gradient-primary text-primary-foreground liquid-glow scale-105"
        : "border-transparent liquid-glass-sm text-muted-foreground hover:liquid-glow hover:border-primary/30"
    )}>
    <span className="text-lg">{emoji}</span>
    {label}
  </button>
);

/* ── Round Editor Dialog ───────────────────────────────── */
function RoundEditor({ roundLabel, options, onSave, onClose }) {
  const [items, setItems] = useState(options.map(o => ({ ...o })));
  const [newVal, setNewVal] = useState('');
  const [newEmoji, setNewEmoji] = useState('');

  const handleAdd = () => {
    if (!newVal.trim()) return;
    setItems(prev => [...prev, { value: newVal.trim(), emoji: newEmoji.trim(), label: newVal.trim() }]);
    setNewVal(''); setNewEmoji('');
  };

  const handleRemove = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleChange = (idx, field, val) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val, ...(field === 'value' ? { label: val } : {}) } : it));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl liquid-glass">
        <p className="font-semibold text-base mb-3">Chỉnh sửa: {roundLabel}</p>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input value={it.emoji} onChange={e => handleChange(idx, 'emoji', e.target.value)}
                className="w-14 text-center text-lg px-1" placeholder="😀" />
              <Input value={it.value} onChange={e => handleChange(idx, 'value', e.target.value)}
                className="flex-1 text-sm" />
              <button onClick={() => handleRemove(idx)} className="p-1.5 rounded-lg hover:bg-destructive/10">
                <X size={13} className="text-destructive" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Input value={newEmoji} onChange={e => setNewEmoji(e.target.value)}
            className="w-14 text-center text-lg px-1" placeholder="😀" />
          <Input value={newVal} onChange={e => setNewVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1 text-sm" placeholder="Thêm tuỳ chọn..." />
          <button onClick={handleAdd} className="p-1.5 rounded-lg bg-primary text-primary-foreground">
            <Plus size={13} />
          </button>
        </div>
        <Button onClick={() => { onSave(items); onClose(); }} className="w-full gradient-primary text-white border-0 rounded-xl mt-2">
          Lưu
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/* ── Food Edit Modal ───────────────────────────────────── */
function FoodEditModal({ food, open, onClose, onSave }) {
  const [form, setForm] = useState({ ...food });
  const [saving, setSaving] = useState(false);
  const handle = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'foods', food.id), form);
      toast.success('Đã cập nhật!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi cập nhật món ăn!');
    }
    setSaving(false);
    onSave?.();
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl liquid-glass">
        <p className="font-semibold text-base mb-3">Chỉnh sửa món</p>
        <div className="space-y-2">
          <Input placeholder="Tên món *" value={form.ten_mon} onChange={e => setForm(f => ({...f, ten_mon: e.target.value}))} />
          <div className="grid grid-cols-2 gap-2">
            {[
              { field: 'nhiet_do', placeholder: 'Nhiệt độ', options: ['Nóng hổi', 'Lạnh mát'] },
              { field: 'loai_no', placeholder: 'Độ no', options: ['Ăn no nê', 'Ăn vặt sương sương'] },
              { field: 'kieu_an', placeholder: 'Kiểu ăn', options: ['Nước', 'Khô', 'Cuốn', 'Nướng-Chiên'] },
              { field: 'quoc_tich', placeholder: 'Quốc tịch', options: ['Việt', 'Hàn', 'Nhật', 'Âu', 'Khác'] },
              { field: 'khoang_cach', placeholder: 'Khoảng cách', options: ['Gần nhà', 'Đi xa'] },
              { field: 'ngan_sach', placeholder: 'Ngân sách', options: ['Bình dân', 'Sang chảnh'] },
            ].map(({ field, placeholder, options }) => (
              <Select key={field} value={form[field]} onValueChange={v => setForm(f => ({...f, [field]: v}))}>
                <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
                <SelectContent>
                  {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            ))}
          </div>
          <Input placeholder="Địa chỉ quán" value={form.dia_chi || ''} onChange={e => setForm(f => ({...f, dia_chi: e.target.value}))} />
          <Button onClick={handle} disabled={saving} className="w-full gradient-primary text-white border-0 rounded-xl">
            {saving && <Loader2 size={14} className="animate-spin mr-2" />} Lưu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Food Detail Modal ─────────────────────────────────── */
function FoodDetailModal({ food, open, onClose, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (!food) return null;
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await updateDoc(doc(db, 'foods', food.id), { chot_don: true });
      toast.success(`🍜 Chốt đơn: ${food.ten_mon}!`);
    } catch (error) {
      console.error(error);
      toast.error('Lỗi chốt đơn!');
    }
    setConfirming(false);
    onConfirm?.();
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 liquid-glass">
        {food.anh
          ? <img src={food.anh} alt={food.ten_mon} className="w-full h-48 object-cover" />
          : <div className="w-full h-32 gradient-rose flex items-center justify-center text-5xl">🍜</div>
        }
        <div className="p-4 space-y-3">
          <h3 className="font-display text-xl font-semibold">{food.ten_mon}</h3>
          <div className="space-y-1.5">
            {food.dia_chi && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={13}/>{food.dia_chi}</div>}
            {food.gia_uoc_tinh && <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign size={13}/>{food.gia_uoc_tinh}</div>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {[food.nhiet_do, food.loai_no, food.kieu_an, food.quoc_tich, food.khoang_cach, food.ngan_sach].filter(Boolean).map(v => (
              <span key={v} className="text-xs px-2 py-1 rounded-full liquid-glass-sm">{v}</span>
            ))}
          </div>
          <Button onClick={handleConfirm} disabled={confirming || food.chot_don}
            className={cn("w-full rounded-xl", food.chot_don ? "bg-green-100 text-green-700 border-0" : "gradient-primary text-white border-0")}>
            {food.chot_don ? <><Check size={14} className="mr-1"/>Đã chốt rồi!</> : <><ShoppingCart size={14} className="mr-1"/>Chốt đơn ngay</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Defaults ──────────────────────────────────────────── */
const DEFAULT_ROUNDS = [
  { key: 'nhiet_do', label: 'Vòng 1 — Nhiệt độ', options: [{ value: 'Nóng hổi', emoji: '🔥', label: 'Nóng hổi' }, { value: 'Lạnh mát', emoji: '🧊', label: 'Lạnh mát' }] },
  { key: 'loai_no', label: 'Vòng 2 — Độ no', options: [{ value: 'Ăn no nê', emoji: '🍛', label: 'Ăn no nê' }, { value: 'Ăn vặt sương sương', emoji: '🧁', label: 'Ăn vặt' }] },
  { key: 'kieu_an', label: 'Vòng 3 — Kiểu ăn', options: [{ value: 'Nước', emoji: '🍲', label: 'Nước' }, { value: 'Khô', emoji: '🍱', label: 'Khô' }, { value: 'Cuốn', emoji: '🌯', label: 'Cuốn' }, { value: 'Nướng-Chiên', emoji: '🍖', label: 'Nướng/Chiên' }] },
  { key: 'quoc_tich', label: 'Vòng 4 — Quốc tịch', options: [{ value: 'Việt', emoji: '🇻🇳', label: 'Món Việt' }, { value: 'Hàn', emoji: '🇰🇷', label: 'Món Hàn' }, { value: 'Nhật', emoji: '🇯🇵', label: 'Món Nhật' }, { value: 'Âu', emoji: '🇮🇹', label: 'Món Âu' }, { value: 'Khác', emoji: '', label: 'Khác' }] },
  { key: 'khoang_cach', label: 'Vòng 5 — Khoảng cách', options: [{ value: 'Gần nhà', emoji: '🏠', label: 'Gần (<2km)' }, { value: 'Đi xa', emoji: '🚗', label: 'Đi xa (>2km)' }] },
  { key: 'ngan_sach', label: 'Vòng 6 — Ngân sách', options: [{ value: 'Bình dân', emoji: '💰', label: 'Bình dân' }, { value: 'Sang chảnh', emoji: '💎', label: 'Sang chảnh' }] },
];

/* ── Main Component ────────────────────────────────────── */
export default function FoodDecider({ foods, onConfirm, onRefresh }) {
  const [view, setView] = useState('filter'); // 'filter' | 'wheel'
  const [filters, setFilters] = useState({});
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [selected, setSelected] = useState(null);
  const [editFood, setEditFood] = useState(null);
  const [editRound, setEditRound] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: f[key] === val ? null : val }));
  const resetFilters = () => setFilters({});

  const filtered = foods.filter(food => {
    return rounds.every(r => !filters[r.key] || food[r.key] === filters[r.key]);
  });

  const chosen = foods.filter(f => f.chot_don);

  const handleUncheck = async (id, e) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'foods', id), { chot_don: false });
      toast.success('Đã bỏ chọn');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi bỏ chọn!');
    }
    onRefresh?.();
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'foods', id));
      toast.success('Đã xóa món');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi xóa món!');
    }
    setDeleting(null);
    onRefresh?.();
  };

  const handleSaveRound = (roundKey, newOptions) => {
    setRounds(prev => prev.map(r => r.key === roundKey ? { ...r, options: newOptions } : r));
  };

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-2 liquid-glass-sm p-1 rounded-2xl">
        <button
          onClick={() => setView('filter')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all',
            view === 'filter' ? 'gradient-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          🎛️ Bộ lọc
        </button>
        <button
          onClick={() => setView('wheel')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all',
            view === 'wheel' ? 'gradient-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          🎡 Vòng quay
        </button>
      </div>

      <AnimatePresence mode="wait">
        {view === 'wheel' ? (
          <motion.div key="wheel" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <LuckyWheel foods={foods} />
          </motion.div>
        ) : (
          <motion.div key="filter" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-5">
            {/* Đã chọn section (horizontal swipe) */}
            {chosen.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">✅ Đã chọn ({chosen.length})</p>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {chosen.map(food => (
                    <div key={food.id}
                      className="flex-shrink-0 w-32 liquid-glass liquid-glass-interactive rounded-2xl p-2 space-y-1.5 cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setSelected(food)}>
                      {food.anh
                        ? <img src={food.anh} alt={food.ten_mon} className="w-full h-20 rounded-xl object-cover" />
                        : <div className="w-full h-20 rounded-xl gradient-rose flex items-center justify-center text-2xl">🍜</div>
                      }
                      <p className="text-xs font-semibold truncate text-center">{food.ten_mon}</p>
                      <button
                        onClick={e => handleUncheck(food.id, e)}
                        className="w-full flex items-center justify-center gap-1 py-0.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors">
                        <X size={9} className="text-destructive" />
                        <span className="text-[10px] text-destructive font-medium">Bỏ chọn</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rounds */}
            {rounds.map((round) => (
              <div key={round.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{round.label}</p>
                  <button onClick={() => setEditRound(round)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                    <Pencil size={10} /> Sửa
                  </button>
                </div>
                <div className={cn("grid gap-2",
                  round.options.length <= 2 ? "grid-cols-2"
                    : round.options.length === 3 ? "grid-cols-3"
                      : "grid-cols-2")}>
                  {round.options.map(o => (
                    <FilterBtn key={o.value} active={filters[round.key] === o.value}
                      onClick={() => setFilter(round.key, o.value)}
                      emoji={o.emoji} label={o.label} />
                  ))}
                </div>
              </div>
            ))}

            {Object.values(filters).some(Boolean) && (
              <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                <RefreshCw size={11} /> Reset bộ lọc
              </button>
            )}

            {/* Results */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{filtered.length} món gợi ý</p>
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground">
                    <p className="text-3xl mb-2">🥺</p>
                    <p className="text-sm">Không tìm thấy món nào phù hợp</p>
                  </motion.div>
                ) : filtered.map(food => (
                  <motion.div key={food.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="liquid-glass liquid-glass-interactive rounded-2xl p-3 flex items-center gap-3 cursor-pointer"
                    onClick={() => setSelected(food)}>
                    {food.anh
                      ? <img src={food.anh} alt={food.ten_mon} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                      : <div className="w-14 h-14 rounded-xl gradient-rose flex items-center justify-center flex-shrink-0 text-2xl">🍜</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{food.ten_mon}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {[food.nhiet_do, food.kieu_an, food.quoc_tich].filter(Boolean).map(v => (
                          <span key={v} className="text-xs px-2 py-0.5 rounded-full liquid-glass-sm text-secondary-foreground">{v}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {food.chot_don && <Check size={14} className="text-green-500" />}
                      <button onClick={e => { e.stopPropagation(); setEditFood(food); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
                        <Pencil size={12} className="text-muted-foreground" />
                      </button>
                      <button onClick={e => handleDelete(food.id, e)} disabled={deleting === food.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors">
                        {deleting === food.id ? <Loader2 size={12} className="animate-spin text-destructive" /> : <Trash2 size={12} className="text-destructive" />}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FoodDetailModal food={selected} open={!!selected} onClose={() => setSelected(null)} onConfirm={onConfirm} />
      {editFood && <FoodEditModal food={editFood} open={!!editFood} onClose={() => setEditFood(null)} onSave={onRefresh} />}
      {editRound && (
        <RoundEditor
          roundLabel={editRound.label}
          options={editRound.options}
          onSave={(newOpts) => handleSaveRound(editRound.key, newOpts)}
          onClose={() => setEditRound(null)}
        />
      )}
    </div>
  );
}
