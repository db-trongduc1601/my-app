import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import QuestBoard from '@/components/quests/QuestBoard';
import RemindersList from '@/components/quests/RemindersList';
import { Star, Bell } from 'lucide-react';

export default function Quests() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: quests = [], refetch: refetchQuests } = useQuery({
    queryKey: ['quests'],
    queryFn: () => base44.entities.QuestBoard.list('ten_nhiem_vu'),
  });

  const { data: reminders = [], refetch: refetchReminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminders.list('gio_nhac'),
  });

  return (
    <div className="px-4 pt-6 pb-4 space-y-6">
      {/* Quests section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-yellow-100 flex items-center justify-center">
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
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">✦</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Reminders section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
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