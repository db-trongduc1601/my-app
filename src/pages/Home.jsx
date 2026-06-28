import { useEffect, useState } from 'react';
import { auth, db } from '../firebase'; // Nhập công cụ của chúng ta
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import LocketCard from '@/components/home/LocketCard';
import DualClock from '@/components/home/DualClock';
import { Heart } from 'lucide-react';

export default function Home() {
  // Lấy luôn thông tin user từ Firebase (vì qua cửa mới vào được đây)
  const currentUser = auth.currentUser;
  
  // Nơi chứa danh sách ảnh
  const [photos, setPhotos] = useState([]);
  const [acceptedEmails, setAcceptedEmails] = useState([]);

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
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.owner_email === myEmail) {
          emails.add(data.friend_email.toLowerCase());
        } else if (data.friend_email === myEmail) {
          emails.add(data.owner_email.toLowerCase());
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
        latestPhoto={filteredPhotos[0] || null}
        allPhotos={filteredPhotos}
        onUploaded={handleDummyRefetch}
        onDeleted={handleDummyRefetch}
        currentUser={currentUser} 
      />

      {/* Dual Clock (Giữ nguyên) */}
      <DualClock />
    </div>
  );
}