import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, storage, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Plus, 
  Image as ImageIcon, 
  Navigation, 
  X, 
  Calendar, 
  Trash2, 
  Maximize2, 
  Loader2, 
  Compass 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Emoji quick-select options for memories
const EMOJIS = [
  { char: '☕', label: 'Cà phê' },
  { char: '🍽️', label: 'Ăn uống' },
  { char: '🍿', label: 'Rạp phim' },
  { char: '🏡', label: 'Nhà riêng' },
  { char: '🏖️', label: 'Bãi biển' },
  { char: '✈️', label: 'Du lịch' },
  { char: '🌸', label: 'Ngắm cảnh' },
  { char: '💖', label: 'Hẹn hò' }
];

// Inner helper component to capture double clicks on Leaflet map
function MapEvents({ onMapDoubleClick }) {
  useMapEvents({
    dblclick(e) {
      onMapDoubleClick(e.latlng);
    }
  });
  return null;
}

export default function LoveMap() {
  const currentUser = auth.currentUser;
  const [memories, setMemories] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [selectedMemory, setSelectedMemory] = useState(null);
  
  // Realtime location states
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [partnerLocation, setPartnerLocation] = useState(null);
  const watchIdRef = useRef(null);

  // Form Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [clickCoords, setClickCoords] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState('💖');
  const [noteText, setNoteText] = useState('');
  const [memoryDate, setMemoryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Polaroid fullscreen states
  const [zoomImage, setZoomImage] = useState(null);

  // Load user profiles to get display names & avatars
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'user_profiles'), (snap) => {
      const profs = {};
      snap.forEach(d => {
        const data = d.data();
        if (data.email) profs[data.email.toLowerCase()] = data;
      });
      setProfiles(profs);
    });
    return () => unsub();
  }, []);

  // Fetch memories in real time chronologically
  useEffect(() => {
    const q = query(collection(db, 'love_memories'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const mems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMemories(mems);
    });
    return () => unsub();
  }, []);

  // Location sharing real-time synchronization
  useEffect(() => {
    if (!currentUser) return;
    const partnerEmail = Object.keys(profiles).find(email => email !== currentUser.email.toLowerCase());
    
    if (!partnerEmail) return;

    // Listen to partner's location updates
    const unsubLoc = onSnapshot(doc(db, 'user_locations', partnerEmail), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Check if partner shared location and it hasn't expired (2 minutes fallback)
        if (data.status === 'active' && data.updatedAt && (Date.now() - data.updatedAt.toMillis() < 120000)) {
          setPartnerLocation({
            lat: data.latitude,
            lng: data.longitude,
            updatedAt: data.updatedAt.toMillis()
          });
        } else {
          setPartnerLocation(null);
        }
      } else {
        setPartnerLocation(null);
      }
    });

    return () => {
      if (unsubLoc) unsubLoc();
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [profiles, currentUser]);

  // Turn ON / OFF realtime location tracking
  const toggleLocationSharing = () => {
    if (isSharingLocation) {
      // Turn off sharing
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsSharingLocation(false);
      if (currentUser) {
        setDoc(doc(db, 'user_locations', currentUser.email.toLowerCase()), {
          status: 'inactive',
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
      toast.info("Đã tắt định vị thực tế.");
    } else {
      // Turn on sharing
      if (!('geolocation' in navigator)) {
        toast.error("Trình duyệt không hỗ trợ định vị!");
        return;
      }

      setIsSharingLocation(true);
      toast.success("Đang kích hoạt định vị thực tế...");

      const handleLocUpdate = (position) => {
        const { latitude, longitude } = position.coords;
        if (currentUser) {
          setDoc(doc(db, 'user_locations', currentUser.email.toLowerCase()), {
            email: currentUser.email,
            latitude,
            longitude,
            status: 'active',
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
        }
      };

      // Get initial and start watching
      navigator.geolocation.getCurrentPosition(handleLocUpdate, (err) => console.error(err), { enableHighAccuracy: true });
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleLocUpdate,
        (err) => {
          console.error(err);
          toast.error("Không thể cập nhật định vị thực tế.");
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  };

  const handleMapDoubleClick = (latlng) => {
    setClickCoords(latlng);
    setSelectedEmoji('💖');
    setNoteText('');
    setPhotoFile(null);
    setMemoryDate(new Date().toISOString().split('T')[0]);
    setShowAddDialog(true);
  };

  const handleSaveMemory = async (e) => {
    e.preventDefault();
    if (!clickCoords || !noteText.trim()) return;

    setUploading(true);
    let imageUrl = '';

    try {
      if (photoFile) {
        const fileRef = ref(storage, `love_memories/${Date.now()}_${photoFile.name}`);
        const uploadResult = await uploadBytes(fileRef, photoFile);
        imageUrl = await getDownloadURL(uploadResult.ref);
      }

      await addDoc(collection(db, 'love_memories'), {
        createdBy: currentUser.email.toLowerCase(),
        latitude: clickCoords.lat,
        longitude: clickCoords.lng,
        emoji: selectedEmoji,
        notes: noteText.trim(),
        date: memoryDate,
        imageUrl,
        createdAt: serverTimestamp()
      });

      toast.success("Đã ghim kỷ niệm của hai đứa! 💕");
      setShowAddDialog(false);
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi lưu kỷ niệm!");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMemory = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa kỷ niệm này không?")) return;
    try {
      await deleteDoc(doc(db, 'love_memories', id));
      setSelectedMemory(null);
      toast.success("Đã xóa kỷ niệm.");
    } catch (err) {
      console.error(err);
      toast.error("Không thể xóa kỷ niệm này!");
    }
  };

  // Build custom icon for memory pins
  const createMemoryIcon = (createdBy, emoji) => {
    const creatorProfile = profiles[createdBy?.toLowerCase()];
    const avatarUrl = creatorProfile?.photo_url;
    
    return L.divIcon({
      className: 'love-map-custom-marker',
      html: `
        <div class="marker-pulse-wrapper">
          <div class="marker-pulse-ring"></div>
          <div class="marker-avatar-container">
            ${avatarUrl 
              ? `<img src="${avatarUrl}" class="marker-avatar" />` 
              : `<span class="marker-emoji">${emoji}</span>`
            }
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40]
    });
  };

  // Build custom icon for partner's live position
  const createPartnerLocationIcon = (email) => {
    const partnerProfile = profiles[email?.toLowerCase()];
    const avatarUrl = partnerProfile?.photo_url;

    return L.divIcon({
      className: 'love-map-partner-marker',
      html: `
        <div class="partner-pulse-wrapper">
          <div class="partner-pulse-ring"></div>
          <div class="partner-avatar-container animate-bounce">
            ${avatarUrl 
              ? `<img src="${avatarUrl}" class="partner-avatar" />` 
              : `<span class="partner-emoji">🧭</span>`
            }
          </div>
        </div>
      `,
      iconSize: [46, 46],
      iconAnchor: [23, 46]
    });
  };

  // Prepare journey path line coordinates
  const pathPositions = memories.map(m => [m.latitude, m.longitude]);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full relative love-map-container no-scrollbar overflow-hidden">
      {/* Map Header */}
      <div className="absolute top-4 left-4 right-4 z-[999] flex items-center justify-between pointer-events-none">
        <div className="liquid-glass rim-light px-4 py-2 flex items-center gap-2 pointer-events-auto shadow-lg">
          <MapPin className="text-primary w-4 h-4" />
          <span className="font-semibold text-xs text-foreground text-glow">Love Map (Bản Đồ Kỷ Niệm)</span>
        </div>

        {/* Temporary location sharing button */}
        <button
          onClick={toggleLocationSharing}
          className={cn(
            "liquid-glass rim-light p-2.5 rounded-full pointer-events-auto transition-all duration-300 shadow-lg active:scale-95",
            isSharingLocation 
              ? "gradient-primary text-white border-transparent liquid-glow" 
              : "text-muted-foreground hover:text-foreground"
          )}
          title={isSharingLocation ? "Tắt định vị" : "Bật định vị"}
        >
          <Navigation className={cn("w-4 h-4", isSharingLocation && "animate-pulse")} />
        </button>
      </div>

      {/* Instructions Overlay */}
      <div className="absolute bottom-4 left-4 z-[999] pointer-events-none max-w-[200px]">
        <div className="liquid-glass rim-light p-2 text-[10px] text-muted-foreground leading-normal pointer-events-auto">
          💡 **Mẹo**: Nhấp đúp (Double click) vào bất kỳ điểm nào trên bản đồ để ghim kỷ niệm mới của hai đứa.
        </div>
      </div>

      {/* Leaflet Map */}
      <div className="flex-1 w-full h-full relative z-0 rounded-3xl overflow-hidden shadow-inner border border-white/20">
        <MapContainer 
          center={[16.047079, 108.206230]} // Default center to Danang, Vietnam
          zoom={6} 
          doubleClickZoom={false}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Pastel/Voyager CartoDB Map Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {/* Map Double click event handler */}
          <MapEvents onMapDoubleClick={handleMapDoubleClick} />

          {/* Chronological Journey Paths (Love Path) */}
          {pathPositions.length > 1 && (
            <Polyline
              positions={pathPositions}
              pathOptions={{
                color: 'hsl(340, 97%, 64%)',
                dashArray: '8, 8',
                weight: 3,
                className: 'love-path-glow'
              }}
            />
          )}

          {/* Memory Pins */}
          {memories.map((m) => (
            <Marker
              key={m.id}
              position={[m.latitude, m.longitude]}
              icon={createMemoryIcon(m.createdBy, m.emoji)}
              eventHandlers={{
                click: () => {
                  setSelectedMemory(m);
                }
              }}
            />
          ))}

          {/* Partner Realtime Position Pin */}
          {partnerLocation && (
            <Marker
              position={[partnerLocation.lat, partnerLocation.lng]}
              icon={createPartnerLocationIcon(
                Object.keys(profiles).find(email => email !== currentUser?.email?.toLowerCase()) || ''
              )}
            />
          )}
        </MapContainer>
      </div>

      {/* Polaroid Card Popover Panel */}
      <AnimatePresence>
        {selectedMemory && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-4 left-4 right-4 z-[999] max-w-sm mx-auto"
          >
            <div className="bg-white text-slate-800 p-4 rounded-xl shadow-2xl relative border border-slate-100 flex flex-col gap-3 font-body">
              {/* Close Button */}
              <button 
                onClick={() => setSelectedMemory(null)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={12} className="text-slate-500" />
              </button>

              {/* Photo Area / Polaroid style image wrapper */}
              {selectedMemory.imageUrl ? (
                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-50 group border border-slate-100">
                  <img src={selectedMemory.imageUrl} alt="Polaroid Memory" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setZoomImage(selectedMemory.imageUrl)}
                    className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Maximize2 size={12} />
                  </button>
                </div>
              ) : (
                <div className="w-full aspect-[4/3] rounded-lg bg-pink-50 flex items-center justify-center text-4xl border border-pink-100 flex-shrink-0">
                  {selectedMemory.emoji}
                </div>
              )}

              {/* Memory Notes area with Polaroid signature spacing */}
              <div className="text-left px-1 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Calendar size={11} />
                    <span className="text-[10px] font-semibold tracking-wider">
                      {selectedMemory.date.split('-').reverse().join('/')}
                    </span>
                  </div>
                  {/* Delete memory button (only visible to creator) */}
                  {selectedMemory.createdBy === currentUser?.email?.toLowerCase() && (
                    <button 
                      onClick={() => handleDeleteMemory(selectedMemory.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="Xóa kỷ niệm"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                
                {/* Cursive style memory text note */}
                <p className="mt-2 text-sm text-slate-700 italic pr-4 font-display font-medium leading-relaxed">
                  "{selectedMemory.notes}"
                </p>
                <p className="text-[10px] text-right text-slate-400 font-semibold mt-2.5">
                  — Ghim bởi: {profiles[selectedMemory.createdBy]?.display_name?.split(' ')[0] || selectedMemory.createdBy.split('@')[0]}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Memory Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="w-[90%] max-w-sm rounded-3xl p-5 liquid-glass-heavy border-none text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Compass className="text-primary w-5 h-5 animate-spin-slow" /> Ghi dấu kỷ niệm mới
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveMemory} className="space-y-4 mt-2">
            {/* Emoji selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Chọn biểu trưng</label>
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map(item => (
                  <button
                    key={item.char}
                    type="button"
                    onClick={() => setSelectedEmoji(item.char)}
                    className={cn(
                      "w-8 h-8 text-base rounded-xl flex items-center justify-center border transition-all active:scale-90",
                      selectedEmoji === item.char
                        ? "border-primary bg-primary/20 scale-105"
                        : "border-transparent bg-white/5 hover:bg-white/10"
                    )}
                    title={item.label}
                  >
                    {item.char}
                  </button>
                ))}
              </div>
            </div>

            {/* Date selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Ngày diễn ra kỷ niệm</label>
              <Input
                type="date"
                required
                value={memoryDate}
                onChange={e => setMemoryDate(e.target.value)}
                className="liquid-glass-sm bg-transparent border-transparent h-9 text-xs"
              />
            </div>

            {/* Notes textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Tự sự ngắn</label>
              <textarea
                required
                rows={3}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Ví dụ: Lần đầu ăn thử phở cuốn ở đây, Quỳnh ăn liền một lúc 5 cái..."
                className="w-full rounded-xl liquid-glass-sm bg-transparent border-transparent text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-primary leading-normal resize-none"
              />
            </div>

            {/* Photo upload input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Đính kèm hình ảnh (Tùy chọn)</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => document.getElementById('memory-photo-picker').click()}
                  variant="outline"
                  className="h-8 text-xs rounded-xl liquid-glass-sm border-transparent flex gap-1.5 items-center justify-center flex-1 bg-white/5 hover:bg-white/10"
                >
                  <ImageIcon size={13} className="text-primary" /> 
                  {photoFile ? photoFile.name.slice(0, 16) + '...' : 'Chọn ảnh'}
                </Button>
                {photoFile && (
                  <button 
                    type="button" 
                    onClick={() => setPhotoFile(null)}
                    className="p-1.5 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <input
                id="memory-photo-picker"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files[0];
                  if (file) setPhotoFile(file);
                }}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={uploading}
                className="flex-1 gradient-primary text-white h-9 rounded-xl text-xs font-bold shadow-lg"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Đang lưu...
                  </span>
                ) : 'Ghi dấu 📍'}
              </Button>
              <Button
                type="button"
                onClick={() => setShowAddDialog(false)}
                className="flex-1 h-9 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-muted-foreground border-transparent"
              >
                Đóng
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Polaroid image zoomed view */}
      <AnimatePresence>
        {zoomImage && (
          <div 
            onClick={() => setZoomImage(null)}
            className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <div className="relative max-w-full max-h-full">
              <img src={zoomImage} alt="Zoomed Polaroid" className="max-w-full max-h-[90vh] rounded-xl object-contain mx-auto shadow-2xl" />
              <button 
                onClick={() => setZoomImage(null)}
                className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
