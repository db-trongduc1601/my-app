import { useState, useEffect, useRef } from 'react';
import { Star, Plus, Loader2, Zap, Pencil, Trash2, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
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
      <DialogContent className="max-w-xs rounded-2xl liquid-glass">
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

/* ── Wood Stamp Button ────────────────────────────── */
function WoodStamp({ onStamp, isCompleted, disabled }) {
  return (
    <motion.button
      onClick={onStamp}
      disabled={disabled}
      whileTap={!isCompleted && !disabled ? {
        scale: 0.75,
        y: 4,
        transition: { duration: 0.1, ease: 'easeIn' }
      } : {}}
      className="flex-shrink-0 relative"
      style={{ width: 36, height: 36 }}
      aria-label={isCompleted ? 'Bỏ đánh dấu' : 'Đóng dấu hoàn thành'}
    >
      {/* Wood handle */}
      <div style={{
        width: 36, height: 36,
        borderRadius: '50%',
        background: isCompleted
          ? 'radial-gradient(circle at 35% 35%, #8B5E3C, #5C3D1E)'
          : 'radial-gradient(circle at 35% 35%, #C4956A, #8B6544)',
        border: '2px solid rgba(0,0,0,0.25)',
        boxShadow: isCompleted
          ? 'inset 0 2px 4px rgba(255,255,255,0.2), 0 2px 6px rgba(0,0,0,0.4)'
          : 'inset 0 2px 4px rgba(255,255,255,0.3), 0 3px 8px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'wait' : 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Wood grain lines */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
          borderRadius: '50%',
        }} />
        {disabled
          ? <Loader2 size={14} className="animate-spin text-white/80" style={{ position: 'relative' }} />
          : <span style={{ fontSize: 16, position: 'relative' }}>{isCompleted ? '✅' : '🪵'}</span>
        }
      </div>
    </motion.button>
  );
}

/* ── Ink Stamp Mark ───────────────────────────────── */
function StampMark({ name }) {
  if (!name) return null;
  const displayText = `${name.toUpperCase()} ĐÃ LÀM`;
  const rotation = -6 + Math.random() * 4; // -6 to -2 deg, stable per render
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.3 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.25 }}
      style={{
        transform: `rotate(${rotation}deg)`,
        border: '2.5px solid rgba(220, 38, 38, 0.75)',
        borderRadius: '6px',
        padding: '2px 8px',
        color: 'rgba(220, 38, 38, 0.85)',
        fontWeight: 800,
        fontSize: 9,
        letterSpacing: '0.08em',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        textShadow: '0 0 4px rgba(220,38,38,0.3)',
        boxShadow: 'inset 0 0 6px rgba(220,38,38,0.15)',
        flexShrink: 0,
      }}
    >
      {displayText}
    </motion.div>
  );
}

const todayStr = () => new Date().toISOString().slice(0, 10);

// Play a woody thump sound via Web Audio API (lazy, iOS-safe)
const audioCtxRef = { current: null };
function playThump() {
  try {
    // Create lazily on first call
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    // Resume synchronously inside user gesture call stack (iOS Safari requirement)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    // Low-frequency oscillator burst → woody thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (e) {
    // Fail silently — audio is enhancement only
  }
}

export default function QuestBoard({ quests, onUpdate, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [editQuest, setEditQuest] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [streak, setStreak] = useState(0);
  const [streakRecord, setStreakRecord] = useState(null);
  const [shakingId, setShakingId] = useState(null);

  const totalExp = quests.filter(q => q.da_xong).reduce((s, q) => s + (q.diem_exp || 0), 0);
  const maxExp = quests.reduce((s, q) => s + (q.diem_exp || 0), 0);
  const progress = maxExp > 0 ? (totalExp / maxExp) * 100 : 0;

  useEffect(() => {
    if (!currentUser) return;
    loadStreak();
  }, [currentUser]);

  const loadStreak = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'streak_data'));
      const mine = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .find(r => r.user_email === currentUser?.email);
      if (mine) {
        setStreak(mine.streak_count || 0);
        setStreakRecord(mine);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggle = async (quest) => {
    setToggling(quest.id);
    const completing = !quest.da_xong;
    const completedBy = completing ? (currentUser?.displayName || currentUser?.email || 'Bạn') : null;
    try {
      // Update with nguoi_hoan_thanh field (null when un-toggling)
      await updateDoc(doc(db, 'quests', quest.id), {
        da_xong: completing,
        nguoi_hoan_thanh: completedBy,
      });

      if (completing) {
        // Play stamp sound
        playThump();
        // Trigger shake
        setShakingId(quest.id);
        setTimeout(() => setShakingId(null), 400);

        toast.success(`⭐ +${quest.diem_exp} EXP!`);
        // Anti-cheat: only add streak once per day
        const today = todayStr();
        if (streakRecord) {
          if (streakRecord.last_claimed_date !== today) {
            const newStreak = (streakRecord.streak_count || 0) + 1;
            await updateDoc(doc(db, 'streak_data', streakRecord.id), {
              streak_count: newStreak,
              last_claimed_date: today,
            });
            setStreak(newStreak);
            setStreakRecord(prev => ({ ...prev, streak_count: newStreak, last_claimed_date: today }));
            toast.success(`🔥 Streak ${newStreak} ngày!`);
          }
        } else if (currentUser) {
          const docRef = await addDoc(collection(db, 'streak_data'), {
            user_email: currentUser.email,
            streak_count: 1,
            last_claimed_date: today,
          });
          const rec = {
            id: docRef.id,
            user_email: currentUser.email,
            streak_count: 1,
            last_claimed_date: today,
          };
          setStreak(1);
          setStreakRecord(rec);
          toast.success('🔥 Streak 1 ngày!');
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi cập nhật trạng thái nhiệm vụ!');
    }
    setToggling(null);
    onUpdate?.();
  };

  const handleAdd = async (formData) => {
    try {
      await addDoc(collection(db, 'quests'), { ...formData, da_xong: false, nguoi_hoan_thanh: null });
      toast.success('Quest mới!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi thêm quest!');
    }
    onUpdate?.();
  };

  const handleEdit = async (formData) => {
    try {
      const { id, ...data } = formData;
      await updateDoc(doc(db, 'quests', id), data);
      toast.success('Đã cập nhật!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi sửa quest!');
    }
    onUpdate?.();
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'quests', id));
    } catch (error) {
      console.error(error);
      toast.error('Lỗi xóa quest!');
    }
    setDeleting(null);
    onUpdate?.();
  };

  return (
    <div className="space-y-4">
      {/* Streak + EXP Bar */}
      <div className="liquid-glass rim-light rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-orange-500" />
            <span className="text-sm font-semibold">Streak</span>
          </div>
          <div className="flex items-center gap-1.5 liquid-glass-sm px-3 py-1 rounded-full">
            <span className="text-lg">🔥</span>
            <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{streak} ngày</span>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><Zap size={15} className="text-yellow-500" /><span className="text-sm font-semibold">Tổng EXP</span></div>
            <span className="text-sm font-bold text-primary">{totalExp} / {maxExp} XP</span>
          </div>
          <div className="w-full h-2 liquid-glass-sm rounded-full overflow-hidden">
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
            <motion.div
              key={quest.id}
              layout
              initial={{ opacity: 0 }}
              animate={shakingId === quest.id ? {
                opacity: 1,
                x: [0, -5, 5, -4, 4, -2, 2, 0],
                transition: { duration: 0.35 }
              } : { opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "liquid-glass liquid-glass-interactive rounded-2xl p-3 flex items-center gap-3",
                quest.da_xong && "opacity-70"
              )}
            >
              {/* Wood Stamp */}
              <WoodStamp
                isCompleted={quest.da_xong}
                disabled={toggling === quest.id}
                onStamp={() => handleToggle(quest)}
              />

              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", quest.da_xong && "line-through text-muted-foreground")}>
                  {quest.ten_nhiem_vu}
                </p>
              </div>

              {/* Ink stamp mark */}
              <AnimatePresence>
                {quest.da_xong && quest.nguoi_hoan_thanh && (
                  <StampMark name={quest.nguoi_hoan_thanh} />
                )}
              </AnimatePresence>

              <span className={cn("text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0",
                quest.da_xong ? "bg-primary/10 text-primary" : "liquid-glass-sm text-yellow-700 dark:text-yellow-400")}>
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