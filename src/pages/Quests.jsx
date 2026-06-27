import { useQuery } from '@tanstack/react-query';
import { db, auth } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import QuestBoard from '@/components/quests/QuestBoard';
import RemindersList from '@/components/quests/RemindersList';
import { Star, Bell } from 'lucide-react';

export default function Quests() {
  const currentUser = auth.currentUser;

  const { data: quests = [], refetch: refetchQuests } = useQuery({
    queryKey: ['quests'],
    queryFn: async () => {
      const querySnapshot = await getDocs(collection(db, 'quests'));
      return querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.ten_nhiem_vu || '').localeCompare(b.ten_nhiem_vu || ''));
    },
  });

  const { data: reminders = [], refetch: refetchReminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const querySnapshot = await getDocs(collection(db, 'reminders'));
      return querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.gio_nhac || '').localeCompare(b.gio_nhac || ''));
    },
  });

  return (
    <div className="px-4 pt-6 pb-4 space-y-6">
      {/* Quests section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl liquid-glass-sm flex items-center justify-center">
            <Star size={16} className="text-yellow-500" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight">Quest Board ⚔️</h1>
            <p className="text-xs text-muted-foreground">hoàn thành nhiệm vụ để nhận EXP</p>
          </div>
        </div>
        <QuestBoard quests={quests} onUpdate={refetchQuests} currentUser={currentUser} />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 gradient-divider" />
        <span className="text-xs text-muted-foreground">✦</span>
        <div className="flex-1 gradient-divider" />
      </div>

      {/* Reminders section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl liquid-glass-sm flex items-center justify-center">
            <Bell size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-base leading-tight">Nhắc Nhở 🔔</h2>
            <p className="text-xs text-muted-foreground">bật/tắt nhắc nhở hàng ngày</p>
          </div>
        </div>
        <RemindersList reminders={reminders} onUpdate={refetchReminders} />
      </div>
    </div>
  );
}