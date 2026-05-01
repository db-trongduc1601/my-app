import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import LocketCard from '@/components/home/LocketCard';
import DualClock from '@/components/home/DualClock';
import { Heart } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: photos = [], refetch } = useQuery({
    queryKey: ['locket'],
    queryFn: () => base44.entities.Locket.list('-created_date', 20)
  });

  return (
    <div className="px-4 pt-2 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground leading-tight">Đức & Quỳnh 💕

          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">không gian riêng của mình</p>
        </div>
        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-md">
          <Heart size={18} className="text-white" fill="white" />
        </div>
      </div>

      {/* Locket — passes all photos so it can render memories */}
      <LocketCard
        latestPhoto={photos[0] || null}
        allPhotos={photos}
        onUploaded={refetch}
        onDeleted={refetch}
        currentUser={user} />
      

      {/* Dual Clock */}
      <DualClock />
    </div>);

}