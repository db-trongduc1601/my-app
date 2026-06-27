import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import MusicTab from '@/components/entertainment/MusicTab';
import DateDecider from '@/components/entertainment/DateDecider';
import { Music, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const SUBTABS = [
  { key: 'music', icon: Music, label: 'Âm nhạc 🎵' },
  { key: 'date', icon: MapPin, label: 'Đi chơi 📍' }
];

export default function Entertainment() {
  const [tab, setTab] = useState('music');

  const { data: tracks = [], refetch: refetchTracks } = useQuery({
    queryKey: ['music'],
    queryFn: async () => {
      const querySnapshot = await getDocs(collection(db, 'music_tracks'));
      return querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || '')); // descending sort
    }
  });

  const { data: spots = [], refetch: refetchSpots } = useQuery({
    queryKey: ['datespots'],
    queryFn: async () => {
      const querySnapshot = await getDocs(collection(db, 'date_spots'));
      return querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.ten_dia_diem || '').localeCompare(b.ten_dia_diem || ''));
    }
  });

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Giải Trí 🎉</h1>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 liquid-glass rounded-2xl p-1">
        {SUBTABS.map(({ key, label }) =>
          <button key={key} onClick={() => setTab(key)}
            className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition-all",
              tab === key ? "liquid-glass shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        )}
      </div>

      {tab === 'music' && <MusicTab tracks={tracks} onRefresh={refetchTracks} />}
      {tab === 'date' && <DateDecider spots={spots} onRefresh={refetchSpots} />}
    </div>
  );
}