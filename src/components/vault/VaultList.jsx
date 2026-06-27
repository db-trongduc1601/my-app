import { useState } from 'react';
import { ExternalLink, Gift, Sparkles, Ruler, Plus, X, Loader2, Pencil, Trash2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../../firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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

const EMPTY_FORM = { ten_mon_do: '', phan_loai: 'Wishlist', chi_tiet: '', link_mua: '', anh: '', da_mua: false };

function ItemForm({ initial, categories, onSave, onClose, title }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [customCat, setCustomCat] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleSave = async () => {
    if (!form.ten_mon_do) return;
    setSaving(true);
    await onSave(form);
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
          <Button onClick={handleSave} disabled={saving || !form.ten_mon_do} className="w-full gradient-primary text-white border-0 rounded-xl">
            {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Lưu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VaultItem({ item, onEdit, onDelete, onTogglePurchased }) {
  const [deleting, setDeleting] = useState(false);
  const { Icon, color, bg } = catIcon(item.phan_loai);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(item.id);
    setDeleting(false);
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={cn("liquid-glass liquid-glass-interactive rounded-2xl p-3 flex gap-3 items-start transition-opacity", item.da_mua && "opacity-50")}>
      {item.anh
        ? <img src={item.anh} alt={item.ten_mon_do} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
        : <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", bg)}>
            <Icon size={18} className={color} />
          </div>
      }
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
        <button onClick={() => onTogglePurchased(item)} className={cn("w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors",
          item.da_mua ? "bg-green-500 border-green-500" : "border-border")}>
          {item.da_mua && <Check size={12} className="text-white" />}
        </button>
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
                <VaultItem key={item.id} item={item} onEdit={setEditItem} onDelete={handleDelete} onTogglePurchased={handleTogglePurchased} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}