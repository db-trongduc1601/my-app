import { useState, useRef } from 'react';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { storage, db } from '../../firebase';
import { toast } from 'sonner';
import { X, Camera, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function ProfileEditorModal({ open, onClose, currentUser, onProfileUpdated }) {
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || '');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  if (!open) return null;

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      const imageBitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      
      // Calculate crop to make it square
      const size = Math.min(imageBitmap.width, imageBitmap.height);
      const startX = (imageBitmap.width - size) / 2;
      const startY = (imageBitmap.height - size) / 2;

      // Max 512px
      const MAX_SIZE = 512;
      const finalSize = Math.min(size, MAX_SIZE);

      canvas.width = finalSize;
      canvas.height = finalSize;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageBitmap, startX, startY, size, size, 0, 0, finalSize, finalSize);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      
      // Upload to avatars/{uid}.jpg
      const storageRef = ref(storage, `avatars/${currentUser.uid}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      
      setPhotoURL(url);
      toast.success('Đã tải ảnh lên! Nhấn Lưu để hoàn tất.');
    } catch (error) {
      console.error("Lỗi nén/tải ảnh:", error);
      toast.error('Không thể xử lý ảnh này.');
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error('Vui lòng nhập tên hiển thị!');
      return;
    }
    
    const changes = {};
    if (displayName.trim() !== currentUser.displayName) {
      changes.displayName = displayName.trim();
    }
    if (photoURL !== currentUser.photoURL) {
      changes.photoURL = photoURL;
    }

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await updateProfile(currentUser, changes);
      await currentUser.reload();
      
      // Cập nhật tài liệu user_profiles trên Firestore để bạn bè cùng thấy
      try {
        const q = query(collection(db, 'user_profiles'), where('email', '==', currentUser.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const profileDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, 'user_profiles', profileDoc.id), {
            display_name: displayName.trim(),
            photo_url: photoURL
          });
        }
      } catch (dbErr) {
        console.error("Lỗi cập nhật user_profiles:", dbErr);
      }
      
      toast.success('Đã lưu thông tin cá nhân! 💖');
      if (onProfileUpdated) {
        // Trả về bản sao mới của user để trigger React re-render
        onProfileUpdated({ ...currentUser }); 
      }
      onClose();
    } catch (error) {
      console.error("Lỗi cập nhật profile:", error);
      toast.error('Có lỗi xảy ra khi lưu thông tin!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="liquid-glass-heavy w-full max-w-sm rounded-3xl p-5 shadow-2xl pointer-events-auto flex flex-col relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-lg">Hồ sơ cá nhân 👤</h3>
            <button onClick={onClose} disabled={saving} className="p-1.5 rounded-full hover:bg-white/20 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Avatar Area */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="relative group cursor-pointer" onClick={() => !saving && fileInputRef.current?.click()}>
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20 shadow-lg bg-secondary/50 flex items-center justify-center">
                {photoURL ? (
                  <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-muted-foreground">{displayName[0]?.toUpperCase() || '?'}</span>
                )}
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[2px]">
                <Camera size={24} />
              </div>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageSelect} 
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center uppercase tracking-wider font-semibold">
              Nhấn vào ảnh để đổi Avatar
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest ml-1 block mb-1.5">
                Tên hiển thị / Nickname
              </label>
              <Input 
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Nhập tên gọi thân mật..."
                className="bg-black/10 border-white/10 h-12 text-center font-medium rounded-2xl"
                disabled={saving}
              />
            </div>

            <Button 
              onClick={handleSave} 
              disabled={saving || !displayName.trim()}
              className="w-full h-12 rounded-2xl gradient-primary text-white font-semibold shadow-lg text-base"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : "Lưu thay đổi"}
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
