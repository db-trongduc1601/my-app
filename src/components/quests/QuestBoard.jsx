import { useState, useEffect } from 'react';
import { Star, Plus, Loader2, Zap, Pencil, Trash2, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function QuestFormDialog({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { ten_nhiem_vu: '', diem_exp: 10 });
  const [saving, setSaving] = useState(false);
  const handle = async () => {
    if (!form.ten_nhiem_vu) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xs rounded-2xl">
        <DialogHeader><DialogTitle>{initial ? 'Sửa nhiệm vụ' : 'Thêm nhiệm vụ'}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <Input placeholder="Tên nhiệm vụ..." value={form.ten_nhiem_vu} onChange={e => setForm(f => ({...f, ten_nhiem_vu: e.target.value}))} />
          <div className="flex items-center gap-2">
            <Input type="number" value={form.diem_exp} onChange={e => setForm(f => ({...f, diem_exp: Number(e.target.value)}))} className="w-24" />
            <span className="text-xs text-muted-foreground">điểm EXP</span>
          </div>
          <Button onClick={handle} disabled={saving} className="w-full gradient-primary text-white border-0 rounded-xl">
            {saving && <Loader2 size={14} className="animate-spin mr-2"/>} Lưu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function QuestBoard({ quests, onUpdate, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [editQuest, setEditQuest] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [streak, setStreak] = useState(0);
  const [streakRecord, setStreakRecord] = useState(null);

  const totalExp = quests.filter(q => q.da_xong).reduce((s, q) => s + (q.diem_exp || 0), 0);
  const maxExp = quests.reduce((s, q) => s + (q.diem_exp || 0), 0);
  const progress = maxExp > 0 ? (totalExp / maxExp) * 100 : 0;

  useEffect(() => {
    if (!currentUser) return;
    loadStreak();
  }, [currentUser]);

  const loadStreak = async () => {
    const records = await base44.entities.StreakData.list();
    const mine = records.find(r => r.user_email === currentUser?.email);
    if (mine) {
      setStreak(mine.streak_count || 0);
      setStreakRecord(mine);
    }
  };

  const handleToggle = async (quest) => {
    setToggling(quest.id);
    const completing = !quest.da_xong;
    await base44.entities.QuestBoard.update(quest.id, { da_xong: completing });

    if (completing) {
      toast.success(`⭐ +${quest.diem_exp} EXP!`);
      // Anti-cheat: only add streak once per day
      const today = todayStr();
      if (streakRecord) {
        if (streakRecord.last_claimed_date !== today) {
          // New day — increment streak
          const newStreak = (streakRecord.streak_count || 0) + 1;
          await base44.entities.StreakData.update(streakRecord.id, {
            streak_count: newStreak,
            last_claimed_date: today,
          });
          setStreak(newStreak);
          setStreakRecord(prev => ({ ...prev, streak_count: newStreak, last_claimed_date: today }));
          toast.success(`🔥 Streak ${newStreak} ngày!`);
        }
        // else: already claimed today, no change
      } else if (currentUser) {
        // First ever streak
        const rec = await base44.entities.StreakData.create({
          user_email: currentUser.email,
          streak_count: 1,
          last_claimed_date: today,
        });
        setStreak(1);
        setStreakRecord(rec);
        toast.success('🔥 Streak 1 ngày!');
      }
    }

    setToggling(null);
    onUpdate?.();
  };

  const handleAdd = async (form) => {
    await base44.entities.QuestBoard.create({ ...form, da_xong: false });
    toast.success('Quest mới!');
    onUpdate?.();
  };

  const handleEdit = async (form) => {
    await base44.entities.QuestBoard.update(form.id, form);
    toast.success('Đã cập nhật!');
    onUpdate?.();
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    await base44.entities.QuestBoard.delete(id);
    setDeleting(null);
    onUpdate?.();
  };

  return (
    <div className="space-y-4">
      {/* Streak + EXP Bar */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-orange-500" />
            <span className="text-sm font-semibold">Streak</span>
          </div>
          <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full">
            <span className="text-lg">🔥</span>
            <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{streak} ngày</span>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><Zap size={15} className="text-yellow-500" /><span className="text-sm font-semibold">Tổng EXP</span></div>
            <span className="text-sm font-bold text-primary">{totalExp} / {maxExp} XP</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div className="h-full gradient-primary rounded-full" initial={{ width: 0 }}
              animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
          </div>
        </div>
      </div>

      <button onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-secondary/50 transition-colors">
        <Plus size={14} /> Thêm nhiệm vụ
      </button>

      {showForm && <QuestFormDialog onSave={handleAdd} onClose={() => setShowForm(false)} />}
      {editQuest && <QuestFormDialog initial={editQuest} onSave={handleEdit} onClose={() => setEditQuest(null)} />}

      <div className="space-y-2">
        <AnimatePresence>
          {quests.map(quest => (
            <motion.div key={quest.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className={cn("glass-card rounded-2xl p-3 flex items-center gap-3", quest.da_xong && "opacity-60")}>
              <button onClick={() => handleToggle(quest)} disabled={toggling === quest.id}
                className={cn("w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all",
                  quest.da_xong ? "bg-primary border-primary" : "border-border")}>
                {toggling === quest.id
                  ? <Loader2 size={12} className="animate-spin text-primary-foreground" />
                  : quest.da_xong ? <Star size={11} className="text-primary-foreground fill-current" /> : null}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", quest.da_xong && "line-through text-muted-foreground")}>{quest.ten_nhiem_vu}</p>
              </div>
              <span className={cn("text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0",
                quest.da_xong ? "bg-primary/10 text-primary" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400")}>
                +{quest.diem_exp} XP
              </span>
              <button onClick={() => setEditQuest(quest)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <Pencil size={13} />
              </button>
              <button onClick={() => handleDelete(quest.id)} disabled={deleting === quest.id} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                {deleting === quest.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {quests.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Chưa có nhiệm vụ nào 🌸</p>}
      </div>
    </div>
  );
}