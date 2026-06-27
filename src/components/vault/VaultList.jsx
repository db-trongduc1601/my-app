import { useState } from 'react';
import { ExternalLink, Gift, Sparkles, Ruler, Plus, X, Loader2, Pencil, Trash2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../../firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DEFAULT_CATEGORIES = ['Wishlist', 'Mỹ phẩm', 'Size đồ', 'Skincare'];

const catIcon = (cat) => {
  if (cat === 'Wishlist') return { Icon: Gift, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/20' };
  if (cat === 'Mỹ phẩm') return { Icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' };
  if (cat === 'Size đồ' || cat === 'Skincare') return { Icon: Ruler, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' };
  return { Icon: Gift, color: 'text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20' };
};

const EMPTY_FORM = {
  ten_mon_do: '', phan_loai: 'Wishlist', chi_tiet: '', link_mua: '', anh: '', da_mua: false,
  gia_muc_tieu: '', da_tiet_kiem: 0,
};

function ItemForm({ initial, categories, onSave, onClose, title }) {
  const [form, setForm] = useState(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [customCat, setCustomCat] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleSave = async () => {
    if (!form.ten_mon_do) return;
    setSaving(true);
    const saveData = {
      ...form,
      gia_muc_tieu: form.gia_muc_tieu ? Number(form.gia_muc_tieu) : null,
      da_tiet_kiem: Number(form.da_tiet_kiem) || 0,
    };
    await onSave(saveData);
    setSaving(false);
    onClose();
  };

  const allCats = [...new Set([...DEFAULT_CATEGORIES, ...categories])];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl liquid-glass">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <Input placeholder="Tên món đồ *" value={form.ten_mon_do} onChange={e => setForm(f => ({...f, ten_mon_do: e.target.value}))} />
          {showCustom ? (
            <div className="flex gap-2">
              <Input placeholder="Tên danh mục mới..." value={customCat} onChange={e => setCustomCat(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => { if (customCat) { setForm(f => ({...f, phan_loai: customCat})); setShowCustom(false); } }}>OK</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCustom(false)}><X size={14}/></Button>
            </div>
          ) : (
            <Select value={form.phan_loai} onValueChange={v => { if (v === '__custom__') setShowCustom(true); else setForm(f => ({...f, phan_loai: v})); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allCats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                <SelectItem value="__custom__">✏️ Tạo mục mới...</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Textarea placeholder="Chi tiết (mã màu son, size giày, loại da...)" rows={2} value={form.chi_tiet} onChange={e => setForm(f => ({...f, chi_tiet: e.target.value}))} className="resize-none text-sm" />
          <Input placeholder="Link mua (tuỳ chọn)" value={form.link_mua} onChange={e => setForm(f => ({...f, link_mua: e.target.value}))} />
          <Input placeholder="URL ảnh (tuỳ chọn)" value={form.anh} onChange={e => setForm(f => ({...f, anh: e.target.value}))} />
          {/* Savings jar fields */}
          <div className="border-t border-border pt-2 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">🍯 Tiết kiệm (tuỳ chọn)</p>
            <Input
              type="number"
              placeholder="Mục tiêu (VND) - để trống nếu không tiết kiệm"
              value={form.gia_muc_tieu}
              onChange={e => setForm(f => ({...f, gia_muc_tieu: e.target.value}))}
            />
          </div>
          <Button onClick={handleSave} disabled={saving || !form.ten_mon_do} className="w-full gradient-primary text-white border-0 rounded-xl">
            {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Lưu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Savings Jar SVG ───────────────────────────────── */
function SavingsJar({ target, saved, onAdd10k, onAdd50k, onMarkBought, isBought }) {
  const pct = Math.min(1, (saved || 0) / target);
  const isFull = pct >= 1;
  const fillH = 56 * pct; // max fill height inside jar body
  const fillY = 18 + (56 - fillH); // y position of fill top inside jar

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <svg width="52" height="80" viewBox="0 0 52 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Jar lid */}
        <rect x="12" y="2" width="28" height="9" rx="4"
          fill={isFull ? '#F59E0B' : '#94A3B8'}
          style={isFull ? { filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.7))' } : {}}
        />
        {/* Jar body outline */}
        <rect x="6" y="11" width="40" height="62" rx="10" stroke="#94A3B8" strokeWidth="2.5" fill="none" />
        {/* Water fill */}
        <clipPath id={`jar-clip-${target}`}>
          <rect x="8.5" y="13.5" width="35" height="57" rx="8" />
        </clipPath>
        <g clipPath={`url(#jar-clip-${target})`}>
          <motion.rect
            x="8"
            width="36"
            rx="4"
            fill={isFull
              ? 'url(#gold-fill)'
              : 'url(#water-fill)'}
            initial={{ y: 70, height: 0 }}
            animate={{ y: fillY, height: fillH }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          {/* Wave effect on top of fill - only when not full */}
          {!isFull && pct > 0 && (
            <motion.path
              d={`M8,${fillY} q9,-4 18,0 t18,0 v4 H8 Z`}
              fill="url(#water-fill)"
              animate={{ d: [
                `M8,${fillY} q9,-4 18,0 t18,0 v4 H8 Z`,
                `M8,${fillY} q9,4 18,0 t18,0 v4 H8 Z`,
                `M8,${fillY} q9,-4 18,0 t18,0 v4 H8 Z`,
              ]}}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            />
          )}
        </g>
        {/* Gradient defs */}
        <defs>
          <linearGradient id="water-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="gold-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>
      {/* Amount text */}
      <p className="text-[10px] text-center font-semibold text-muted-foreground leading-tight">
        {(saved || 0).toLocaleString('vi-VN')}đ
        <br />
        <span className="text-[9px] font-normal">/ {target.toLocaleString('vi-VN')}đ</span>
      </p>
      {/* Action buttons */}
      {isFull ? (
        isBought ? null : (
          <button
            onClick={onMarkBought}
            className="text-[9px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold border border-amber-300/50 hover:bg-amber-200 transition-colors whitespace-nowrap"
          >
            ✔ Mua ngay!
          </button>
        )
      ) : (
        <div className="flex gap-1">
          <button
            onClick={onAdd10k}
            className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-semibold border border-sky-200/50 hover:bg-sky-200 transition-colors"
          >
            +10k
          </button>
          <button
            onClick={onAdd50k}
            className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold border border-blue-200/50 hover:bg-blue-200 transition-colors"
          >
            +50k
          </button>
        </div>
      )}
    </div>
  );
}

function VaultItem({ item, onEdit, onDelete, onTogglePurchased, onAddSavings }) {
  const [deleting, setDeleting] = useState(false);
  const { Icon, color, bg } = catIcon(item.phan_loai);
  const hasSavings = item.gia_muc_tieu && item.gia_muc_tieu > 0;
  const isFull = hasSavings && (item.da_tiet_kiem || 0) >= item.gia_muc_tieu;

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(item.id);
    setDeleting(false);
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={cn("liquid-glass liquid-glass-interactive rounded-2xl p-3 flex gap-3 items-start transition-opacity", item.da_mua && "opacity-50")}>

      {/* Left side: jar or icon */}
      {hasSavings ? (
        <SavingsJar
          target={item.gia_muc_tieu}
          saved={item.da_tiet_kiem || 0}
          isBought={item.da_mua}
          onAdd10k={() => onAddSavings(item.id, 10000)}
          onAdd50k={() => onAddSavings(item.id, 50000)}
          onMarkBought={() => onTogglePurchased(item)}
        />
      ) : (
        item.anh
          ? <img src={item.anh} alt={item.ten_mon_do} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          : <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", bg)}>
              <Icon size={18} className={color} />
            </div>
      )}

      <div className="flex-1 min-w-0">
        <p className={cn("font-semibold text-sm truncate", item.da_mua && "line-through text-muted-foreground")}>{item.ten_mon_do}</p>
        {item.chi_tiet && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.chi_tiet}</p>}
        {item.link_mua && (
          <a href={item.link_mua} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline">
            <ExternalLink size={10} /> Xem sản phẩm
          </a>
        )}
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        {!hasSavings && (
          <button onClick={() => onTogglePurchased(item)} className={cn("w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors",
            item.da_mua ? "bg-green-500 border-green-500" : "border-border")}>
            {item.da_mua && <Check size={12} className="text-white" />}
          </button>
        )}
        <button onClick={() => onEdit(item)} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
          <Pencil size={12} className="text-muted-foreground" />
        </button>
        <button onClick={handleDelete} disabled={deleting} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-destructive/10 transition-colors">
          {deleting ? <Loader2 size={11} className="animate-spin text-destructive" /> : <Trash2 size={11} className="text-destructive" />}
        </button>
      </div>
    </motion.div>
  );
}

export default function VaultList({ items, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [toastedFull, setToastedFull] = useState(new Set());

  const customCategories = [...new Set(items.map(i => i.phan_loai).filter(c => !DEFAULT_CATEGORIES.includes(c)))];
  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...customCategories])];
  const grouped = allCategories.reduce((acc, cat) => { acc[cat] = items.filter(i => i.phan_loai === cat); return acc; }, {});

  const handleAdd = async (formData) => {
    try {
      await addDoc(collection(db, 'vault_items'), formData);
      toast.success('💕 Đã thêm vào Vault!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi thêm đồ!');
    }
    onRefresh?.();
  };
  const handleEdit = async (formData) => {
    try {
      const { id, ...data } = formData;
      await updateDoc(doc(db, 'vault_items', id), data);
      toast.success('Đã cập nhật!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi sửa đồ!');
    }
    onRefresh?.();
  };
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'vault_items', id));
      toast.success('Đã xóa');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xóa đồ!');
    }
    onRefresh?.();
  };
  const handleTogglePurchased = async (item) => {
    try {
      await updateDoc(doc(db, 'vault_items', item.id), { da_mua: !item.da_mua });
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi thay đổi trạng thái!');
    }
    onRefresh?.();
  };

  const handleAddSavings = async (id, amount) => {
    try {
      await updateDoc(doc(db, 'vault_items', id), { da_tiet_kiem: increment(amount) });
      // Check if now full
      const item = items.find(i => i.id === id);
      if (item && item.gia_muc_tieu) {
        const newSaved = (item.da_tiet_kiem || 0) + amount;
        if (newSaved >= item.gia_muc_tieu && !toastedFull.has(id)) {
          toast.success(`Đã đủ tiền mua rồi! 🛍️`);
          setToastedFull(prev => new Set([...prev, id]));
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi cộng tiết kiệm!');
    }
    onRefresh?.();
  };

  return (
    <div className="space-y-5">
      <button onClick={() => setShowAdd(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-secondary/50 transition-colors">
        <Plus size={16} /> Thêm món đồ mới
      </button>

      {showAdd && <ItemForm categories={customCategories} onSave={handleAdd} onClose={() => setShowAdd(false)} title="Thêm vào Vault 💕" />}
      {editItem && <ItemForm initial={editItem} categories={customCategories} onSave={handleEdit} onClose={() => setEditItem(null)} title="Chỉnh sửa" />}

      {allCategories.map(cat => {
        const catItems = grouped[cat] || [];
        if (catItems.length === 0) return null;
        const { Icon, color, bg } = catIcon(cat);
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-1.5 rounded-lg", bg)}><Icon size={13} className={color} /></div>
              <span className="font-semibold text-sm">{cat}</span>
              <span className="text-xs text-muted-foreground liquid-glass-sm px-2 py-0.5 rounded-full">{catItems.length}</span>
            </div>
            <div className="space-y-2 ml-1">
              {catItems.map(item => (
                <VaultItem
                  key={item.id}
                  item={item}
                  onEdit={setEditItem}
                  onDelete={handleDelete}
                  onTogglePurchased={handleTogglePurchased}
                  onAddSavings={handleAddSavings}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}