import { useState } from 'react';
import { Bell, Plus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function ReminderFormDialog({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { ten_nhac_nho: '', gio_nhac: '08:00' });
  const [saving, setSaving] = useState(false);
  const handle = async () => {
    if (!form.ten_nhac_nho) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xs rounded-2xl liquid-glass">
        <DialogHeader><DialogTitle>{initial ? 'Sửa nhắc nhở' : 'Thêm nhắc nhở'}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <Input placeholder="Tên nhắc nhở..." value={form.ten_nhac_nho} onChange={e => setForm(f => ({...f, ten_nhac_nho: e.target.value}))} />
          <Input type="time" value={form.gio_nhac} onChange={e => setForm(f => ({...f, gio_nhac: e.target.value}))} />
          <Button onClick={handle} disabled={saving} className="w-full gradient-primary text-white border-0 rounded-xl">
            {saving && <Loader2 size={14} className="animate-spin mr-2"/>} Lưu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RemindersList({ reminders, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editReminder, setEditReminder] = useState(null);
  // Optimistic UI: track local toggling state
  const [localState, setLocalState] = useState({});
  const [deleting, setDeleting] = useState(null);

  const getActive = (r) => localState[r.id] !== undefined ? localState[r.id] : r.kich_hoat;

  const handleToggle = async (r) => {
    const newVal = !getActive(r);
    // Optimistic update immediately
    setLocalState(s => ({...s, [r.id]: newVal}));
    try {
      await updateDoc(doc(db, 'reminders', r.id), { kich_hoat: newVal });
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi cập nhật nhắc nhở!');
      // revert optimistic UI
      setLocalState(s => ({...s, [r.id]: !newVal}));
    }
    onUpdate?.();
  };

  const handleAdd = async (formData) => {
    try {
      await addDoc(collection(db, 'reminders'), { ...formData, kich_hoat: true });
      toast.success('⏰ Đã thêm nhắc nhở!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi thêm nhắc nhở!');
    }
    onUpdate?.();
  };

  const handleEdit = async (formData) => {
    try {
      const { id, ...data } = formData;
      await updateDoc(doc(db, 'reminders', id), data);
      toast.success('Đã cập nhật!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi cập nhật nhắc nhở!');
    }
    onUpdate?.();
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'reminders', id));
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xóa nhắc nhở!');
    }
    setDeleting(null);
    onUpdate?.();
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-secondary/50 transition-colors">
        <Plus size={14} /> Thêm nhắc nhở
      </button>

      {showForm && <ReminderFormDialog onSave={handleAdd} onClose={() => setShowForm(false)} />}
      {editReminder && <ReminderFormDialog initial={editReminder} onSave={handleEdit} onClose={() => setEditReminder(null)} />}

      <div className="space-y-2">
        <AnimatePresence>
          {reminders.map(r => {
            const active = getActive(r);
            return (
              <motion.div key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="liquid-glass liquid-glass-interactive rounded-2xl p-3 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                  active ? "liquid-glass-sm" : "liquid-glass-sm opacity-60")}>
                  <Bell size={15} className={active ? "text-primary" : "text-muted-foreground"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", !active && "text-muted-foreground")}>{r.ten_nhac_nho}</p>
                  <p className="text-xs text-muted-foreground">{r.gio_nhac}</p>
                </div>
                <Switch checked={active} onCheckedChange={() => handleToggle(r)} />
                <button onClick={() => setEditReminder(r)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id} className="text-muted-foreground hover:text-destructive transition-colors">
                  {deleting === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {reminders.length === 0 && <p className="text-center text-sm text-muted-foreground py-3">Chưa có nhắc nhở nào 🔔</p>}
      </div>
    </div>
  );
}