import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auth, db } from '../firebase'; // Nhập công cụ của chúng ta
import { collection, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import LocketCard from '@/components/home/LocketCard';
import DualClock from '@/components/home/DualClock';
import MusicTab from '@/components/entertainment/MusicTab';
import DateDecider from '@/components/entertainment/DateDecider';
import { Heart, Music, MapPin, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const ENTERTAINMENT_SUBTABS = [
  { key: 'music', icon: Music, label: 'Âm nhạc 🎵' },
  { key: 'date', icon: MapPin, label: 'Đi chơi 📍' }
];

export default function Home() {
  // Lấy luôn thông tin user từ Firebase (vì qua cửa mới vào được đây)
  const currentUser = auth.currentUser;
  const location = useLocation();

  // Nơi chứa danh sách ảnh
  const [photos, setPhotos] = useState([]);
  const [acceptedEmails, setAcceptedEmails] = useState([]);

  // Section Giải trí — thu/mở
  const [entertainmentOpen, setEntertainmentOpen] = useState(false);
  const [entertainmentTab, setEntertainmentTab] = useState('music');

  // Tự mở section Giải trí khi được điều hướng tới từ lời mời nghe chung
  useEffect(() => {
    if (location.state?.openEntertainment) {
      setEntertainmentOpen(true);
      if (location.state?.entertainmentTab) setEntertainmentTab(location.state.entertainmentTab);
    }
  }, [location.state]);

  const { data: tracks = [], refetch: refetchTracks } = useQuery({
    queryKey: ['music'],
    queryFn: async () => {
      const querySnapshot = await getDocs(collection(db, 'music_tracks'));
      return querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || '')); // descending sort
    },
    enabled: entertainmentOpen,
  });

  const { data: spots = [], refetch: refetchSpots } = useQuery({
    queryKey: ['datespots'],
    queryFn: async () => {
      const querySnapshot = await getDocs(collection(db, 'date_spots'));
      return querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.ten_dia_diem || '').localeCompare(b.ten_dia_diem || ''));
    },
    enabled: entertainmentOpen,
  });

  // Kéo đường ống Real-time từ Firestore để lấy danh sách bạn bè đã đồng ý
  useEffect(() => {
    if (!currentUser) return;
    const myEmail = currentUser.email;

    const q = query(
      collection(db, 'friends'),
      where('status', '==', 'accepted')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emails = new Set();
      const myEmailLower = myEmail.toLowerCase();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.owner_email?.toLowerCase() === myEmailLower) {
          if (data.friend_email) emails.add(data.friend_email.toLowerCase());
        } else if (data.friend_email?.toLowerCase() === myEmailLower) {
          if (data.owner_email) emails.add(data.owner_email.toLowerCase());
        }
      });
      setAcceptedEmails(Array.from(emails));
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Kéo đường ống Real-time từ Firestore
  useEffect(() => {
    // Chỉ định vào đúng "ngăn tủ" tên là locket_photos, lấy 20 tấm mới nhất
    const q = query(
      collection(db, 'locket_photos'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    // Mở đường ống lắng nghe: Có ảnh mới là tự cập nhật ngay
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const photosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPhotos(photosData);
    });

    // Rút ống khi chuyển sang trang khác cho nhẹ máy
    return () => unsubscribe();
  }, []);

  // Thay vì refetch, Firebase tự lo liệu rồi nên truyền hàm rỗng cho nó khỏi báo lỗi
  const handleDummyRefetch = () => {};

  // Lọc ảnh: Chỉ giữ ảnh legacy, ảnh của mình, hoặc ảnh của bạn bè đã đồng ý
  const filteredPhotos = photos.filter(p => {
    if (!p.owner_email) return true; // Legacy/grandfathered
    const owner = p.owner_email.toLowerCase();
    const me = currentUser.email.toLowerCase();
    return owner === me || acceptedEmails.includes(owner);
  });

  return (
    <div className="px-4 pt-2 pb-4 space-y-5">
      {/* Header (Giữ nguyên 100%) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground leading-tight text-glow">
           Xin chào 💕
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">không gian riêng của mình</p>
        </div>
        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-md animate-glow-pulse">
          <Heart size={18} className="text-white" fill="white" />
        </div>
      </div>

      {/* Locket — truyền dữ liệu thật từ Firebase vào */}
      <LocketCard
        latestPhoto={filteredPhotos[0] || null}
        allPhotos={filteredPhotos}
        onUploaded={handleDummyRefetch}
        onDeleted={handleDummyRefetch}
        currentUser={currentUser}
      />

      {/* Dual Clock (Giữ nguyên) */}
      <DualClock />

      {/* Section Giải Trí — thu/mở */}
      <div className="liquid-glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setEntertainmentOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5"
        >
          <span className="font-display text-base font-semibold text-foreground">Giải Trí 🎉</span>
          <ChevronDown
            size={18}
            className={cn("text-muted-foreground transition-transform duration-300", entertainmentOpen && "rotate-180")}
          />
        </button>

        <AnimatePresence initial={false}>
          {entertainmentOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-4">
                {/* Sub-tabs */}
                <div className="flex gap-2 liquid-glass rounded-2xl p-1">
                  {ENTERTAINMENT_SUBTABS.map(({ key, label }) =>
                    <button key={key} onClick={() => setEntertainmentTab(key)}
                      className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition-all",
                        entertainmentTab === key ? "liquid-glass shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                      {label}
                    </button>
                  )}
                </div>

                {entertainmentTab === 'music' && <MusicTab tracks={tracks} onRefresh={refetchTracks} />}
                {entertainmentTab === 'date' && <DateDecider spots={spots} onRefresh={refetchSpots} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
