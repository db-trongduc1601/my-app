import { useEffect, useState } from 'react';
import { auth, db } from '../firebase'; // Nhập công cụ của chúng ta
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import LocketCard from '@/components/home/LocketCard';
import DualClock from '@/components/home/DualClock';
import { Heart } from 'lucide-react';

export default function Home() {
  // Lấy luôn thông tin user từ Firebase (vì qua cửa mới vào được đây)
  const currentUser = auth.currentUser;
  
  // Nơi chứa danh sách ảnh
  const [photos, setPhotos] = useState([]);

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

  return (
    <div className="px-4 pt-2 pb-4 space-y-5">
      {/* Header (Giữ nguyên 100%) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground leading-tight text-glow">
            Đức & Quỳnh 💕
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">không gian riêng của mình</p>
        </div>
        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-md animate-glow-pulse">
          <Heart size={18} className="text-white" fill="white" />
        </div>
      </div>

      {/* Locket — truyền dữ liệu thật từ Firebase vào */}
      <LocketCard
        latestPhoto={photos[0] || null}
        allPhotos={photos}
        onUploaded={handleDummyRefetch}
        onDeleted={handleDummyRefetch}
        currentUser={currentUser} 
      />

      {/* Dual Clock (Giữ nguyên) */}
      <DualClock />
    </div>
  );
}