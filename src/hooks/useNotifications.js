import { useEffect, useRef } from 'react';
import { db, app } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { toast } from '@/components/ui/use-toast';

// Hàm đăng ký và lưu FCM Token lên Firestore
export async function registerFCMToken(currentUser) {
  if (!currentUser || !currentUser.email) return;
  
  try {
    // Chỉ đăng ký nếu trình duyệt hỗ trợ thông báo và người dùng đã cấp quyền
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const messagingSupported = await isSupported();
    if (!messagingSupported) {
      console.log("Trình duyệt không hỗ trợ Firebase Messaging.");
      toast({
        variant: "destructive",
        title: "Không hỗ trợ Push",
        description: "Trình duyệt của bạn không hỗ trợ công nghệ Web Push."
      });
      return;
    }

    const messaging = getMessaging(app);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("Thiếu VITE_FIREBASE_VAPID_KEY trong .env.local!");
      toast({
        variant: "destructive",
        title: "Lỗi cấu hình",
        description: "Ứng dụng chưa được cấu hình mã khóa VAPID Key để gửi đẩy."
      });
      return;
    }

    // Lấy Service Worker đã đăng ký
    const registration = await navigator.serviceWorker.ready;

    // Yêu cầu token từ FCM
    const token = await getToken(messaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      // Lưu Token của thiết bị hiện tại gắn với email của user
      await setDoc(doc(db, 'fcm_tokens', currentUser.email), {
        token: token,
        updated_at: serverTimestamp()
      }, { merge: true });
      console.log("Đã đăng ký FCM Token thành công:", token);
      
      toast({
        title: "Đã đăng ký thiết bị! 📲",
        description: "Hệ thống thông báo đẩy đã sẵn sàng nhận tin nhắn.",
        duration: 5000
      });
    } else {
      console.warn("Không nhận được token FCM thiết bị.");
      toast({
        variant: "destructive",
        title: "Không lấy được Token",
        description: "Không thể cấp mã định danh đẩy cho thiết bị của bạn."
      });
    }
  } catch (error) {
    console.error("Lỗi đăng ký FCM Token:", error);
    toast({
      variant: "destructive",
      title: "Lỗi đăng ký thông báo",
      description: error.message || String(error)
    });
  }
}

export function useNotifications(currentUser) {
  useEffect(() => {
    if (!currentUser) return;

    // Tự động đăng ký/cập nhật FCM Token nếu đã được cấp quyền trước đó
    if ('Notification' in window && Notification.permission === 'granted') {
      registerFCMToken(currentUser);
    }
  }, [currentUser]);
}
