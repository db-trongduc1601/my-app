import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
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
import { useProfiles } from '../hooks/useProfiles';
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
  Compass,
  BookOpen,
  Route
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

// Haversine distance calculator to filter out GPS jitter
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

// Distance helper (defensive check)
const calculatePathDistance = (coords) => {
  if (!coords || !Array.isArray(coords) || coords.length < 2) return '0.00';
  let totalMeters = 0;
  try {
    for (let i = 1; i < coords.length; i++) {
      const p1 = coords[i - 1];
      const p2 = coords[i];
      if (p1 && p2 && typeof p1.lat === 'number' && typeof p1.lng === 'number' && typeof p2.lat === 'number' && typeof p2.lng === 'number') {
        totalMeters += getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
      }
    }
  } catch (e) {
    console.error("Error calculating path distance:", e);
  }
  return (totalMeters / 1000).toFixed(2);
};

// Duration formatter
const formatDuration = (secs) => {
  if (!secs || isNaN(secs)) return 'Không rõ';
  if (secs < 60) return `${secs} giây`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins} phút ${remainingSecs > 0 ? `${remainingSecs}s` : ''}`;
};

// Sub-component to capture Leaflet map instance safely from context
function MapInstanceCapture({ setMap }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      setMap(map);
    }
  }, [map, setMap]);
  return null;
}

export default function LoveMap() {
  const currentUser = auth.currentUser;
  const [map, setMap] = useState(null);
  const [memories, setMemories] = useState([]);
  const { profiles } = useProfiles();
  const [selectedMemory, setSelectedMemory] = useState(null);
  
  // Realtime location states
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [partnerLocation, setPartnerLocation] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const watchIdRef = useRef(null);

  // Love Journey states
  const [isRecordingJourney, setIsRecordingJourney] = useState(false);
  const [journeyCoords, setJourneyCoords] = useState([]);
  const [savedJourneys, setSavedJourneys] = useState([]);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [showJourneyDialog, setShowJourneyDialog] = useState(false);
  const [journeyTitle, setJourneyTitle] = useState('');
  const [journeyNotes, setJourneyNotes] = useState('');
  const [journeyDate, setJourneyDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [journeyDuration, setJourneyDuration] = useState(0);
  const [savingJourney, setSavingJourney] = useState(false);
  const journeyWatchIdRef = useRef(null);
  const journeyStartTimeRef = useRef(null);

  // Journey Relive states
  const [isReliving, setIsReliving] = useState(false);
  const [reliveIndex, setReliveIndex] = useState(0);

  // Form Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [clickCoords, setClickCoords] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState('💖');
  const [noteText, setNoteText] = useState('');
  const [memoryDate, setMemoryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Directory list states
  const [showListDialog, setShowListDialog] = useState(false);
  const [activeListTab, setActiveListTab] = useState('memories'); // 'memories' or 'journeys'

  // Polaroid fullscreen states
  const [zoomImage, setZoomImage] = useState(null);

  // Fetch memories in real time chronologically
  useEffect(() => {
    const q = query(collection(db, 'love_memories'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const mems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMemories(mems);
    });
    return () => unsub();
  }, []);

  // Fetch saved love journeys
  useEffect(() => {
    const q = query(collection(db, 'love_journeys'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const jns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSavedJourneys(jns);
    });
    return () => unsub();
  }, []);

  // Clean up watches on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      if (journeyWatchIdRef.current) navigator.geolocation.clearWatch(journeyWatchIdRef.current);
    };
  }, []);

  // Location sharing real-time synchronization
  useEffect(() => {
    if (!currentUser || !currentUser.email) return;
    const myEmailLower = currentUser.email.toLowerCase();
    const partnerEmail = Object.keys(profiles).find(email => email !== myEmailLower);
    
    if (!partnerEmail) return;

    // Listen to partner's location updates
    const unsubLoc = onSnapshot(doc(db, 'user_locations', partnerEmail), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
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
    };
  }, [profiles, currentUser]);

  const focusOnLocation = (lat, lng, zoom = 15) => {
    if (map) {
      try {
        map.setView([lat, lng], zoom);
      } catch (e) {
        console.error("setView failed:", e);
      }
    }
  };

  const handleLocUpdate = (position) => {
    if (!position || !position.coords) return;
    const { latitude, longitude } = position.coords;
    setMyLocation({ lat: latitude, lng: longitude });
    if (currentUser && currentUser.email) {
      setDoc(doc(db, 'user_locations', currentUser.email.toLowerCase()), {
        email: currentUser.email,
        latitude,
        longitude,
        status: 'active',
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    }
  };

  // Turn ON / OFF realtime location tracking
  const toggleLocationSharing = () => {
    if (isSharingLocation) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsSharingLocation(false);
      setMyLocation(null);
      if (currentUser && currentUser.email) {
        setDoc(doc(db, 'user_locations', currentUser.email.toLowerCase()), {
          status: 'inactive',
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
      toast.info("Đã tắt định vị thực tế.");
    } else {
      if (!('geolocation' in navigator)) {
        toast.error("Trình duyệt không hỗ trợ định vị!");
        return;
      }

      setIsSharingLocation(true);
      toast.success("Đang kích hoạt định vị thực tế...");

      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleLocUpdate(position);
          if (position && position.coords) {
            focusOnLocation(position.coords.latitude, position.coords.longitude, 12);
          }
        }, 
        (err) => console.error(err), 
        { enableHighAccuracy: true }
      );

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

  // Mark current position and open memory form with timeout protection
  const handleMarkCurrentLocation = () => {
    if (isSharingLocation && myLocation) {
      setClickCoords(myLocation);
      setSelectedEmoji('💖');
      setNoteText('');
      setPhotoFile(null);
      setMemoryDate(new Date().toISOString().split('T')[0]);
      setShowAddDialog(true);
      focusOnLocation(myLocation.lat, myLocation.lng, 15);
      return;
    }

    if (!('geolocation' in navigator)) {
      toast.error("Trình duyệt không hỗ trợ định vị!");
      return;
    }
    
    toast.success("Đang xác định vị trí hiện tại...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!position || !position.coords) return;
        const { latitude, longitude } = position.coords;
        setClickCoords({ lat: latitude, lng: longitude });
        setSelectedEmoji('💖');
        setNoteText('');
        setPhotoFile(null);
        setMemoryDate(new Date().toISOString().split('T')[0]);
        setShowAddDialog(true);
        focusOnLocation(latitude, longitude, 15);
      },
      (err) => {
        console.error(err);
        toast.error("Lấy vị trí thất bại. Hãy chắc chắn đã bật GPS trên thiết bị!");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // ── Love Journey Handlers ────────────────────────────────────────────────
  const startRecordingJourney = () => {
    if (!('geolocation' in navigator)) {
      toast.error("Trình duyệt không hỗ trợ định vị!");
      return;
    }

    setIsRecordingJourney(true);
    setJourneyCoords([]);
    journeyStartTimeRef.current = Date.now(); // Capture start time
    toast.success("Bắt đầu ghi lại hành trình tình yêu! 👣");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!position || !position.coords) return;
        const pt = { lat: position.coords.latitude, lng: position.coords.longitude };
        setJourneyCoords([pt]);
        focusOnLocation(pt.lat, pt.lng, 15);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    journeyWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!position || !position.coords) return;
        const { latitude, longitude } = position.coords;
        setJourneyCoords(prev => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const dist = getDistance(last.lat, last.lng, latitude, longitude);
            if (dist < 10) return prev; // Lọc nếu di chuyển dưới 10m
          }
          return [...prev, { lat: latitude, lng: longitude }];
        });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const stopRecordingJourney = () => {
    if (journeyWatchIdRef.current) {
      navigator.geolocation.clearWatch(journeyWatchIdRef.current);
      journeyWatchIdRef.current = null;
    }
    setIsRecordingJourney(false);

    if (journeyCoords.length < 2) {
      toast.info("Hành trình di chuyển quá ngắn để lưu lại!");
      setJourneyCoords([]);
      return;
    }

    // Calculate duration in seconds
    const elapsedSecs = journeyStartTimeRef.current 
      ? Math.round((Date.now() - journeyStartTimeRef.current) / 1000)
      : 0;
    setJourneyDuration(elapsedSecs);

    setJourneyTitle('');
    setJourneyNotes('');
    setJourneyDate(new Date().toISOString().split('T')[0]);
    setShowJourneyDialog(true);
  };

  const handleSaveJourney = async (e) => {
    e.preventDefault();
    if (!journeyTitle.trim() || journeyCoords.length < 2 || !currentUser || !currentUser.email) return;

    setSavingJourney(true);
    try {
      await addDoc(collection(db, 'love_journeys'), {
        createdBy: currentUser.email.toLowerCase(),
        title: journeyTitle.trim(),
        notes: journeyNotes.trim(),
        date: journeyDate,
        coords: journeyCoords,
        duration: journeyDuration,
        createdAt: serverTimestamp()
      });
      toast.success("Đã lưu trữ lộ trình kỷ niệm! 🗺️");
      setShowJourneyDialog(false);
      setJourneyCoords([]);
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu lộ trình hành trình!");
    } finally {
      setSavingJourney(false);
    }
  };

  const handleDeleteJourney = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa hành trình này không?")) return;
    try {
      await deleteDoc(doc(db, 'love_journeys', id));
      setSelectedJourney(null);
      toast.success("Đã xóa hành trình.");
    } catch (err) {
      console.error(err);
      toast.error("Không thể xóa hành trình!");
    }
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

  // ── Journey Relive Animation ticker ──────────────────────────────────────
  useEffect(() => {
    if (isReliving && selectedJourney && Array.isArray(selectedJourney.coords) && selectedJourney.coords.length > 0) {
      const coords = selectedJourney.coords;
      setReliveIndex(0);
      
      const startPt = coords[0];
      if (startPt && typeof startPt.lat === 'number' && typeof startPt.lng === 'number') {
        focusOnLocation(startPt.lat, startPt.lng, 15);
      }

      let cur = 0;
      const interval = setInterval(() => {
        cur++;
        if (cur >= coords.length) {
          clearInterval(interval);
          setIsReliving(false);
          toast.success("Đã hoàn thành tua lại hành trình! 💕");
        } else {
          setReliveIndex(cur);
          const nextPt = coords[cur];
          if (nextPt && typeof nextPt.lat === 'number' && typeof nextPt.lng === 'number') {
            focusOnLocation(nextPt.lat, nextPt.lng, 15);
          }
        }
      }, 700); // Step every 700ms

      return () => clearInterval(interval);
    }
  }, [isReliving, selectedJourney, map]);

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
              : `<span class="marker-emoji">${emoji || '📍'}</span>`
            }
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40]
    });
  };

  // Build custom icon for own location marker (pink pulse)
  const createMyLocationIcon = (email) => {
    const profile = profiles[email?.toLowerCase()];
    const avatarUrl = profile?.photo_url;

    return L.divIcon({
      className: 'love-map-my-marker',
      html: `
        <div class="my-pulse-wrapper">
          <div class="my-pulse-ring"></div>
          <div class="my-avatar-container animate-bounce">
            ${avatarUrl 
              ? `<img src="${avatarUrl}" class="my-avatar" />` 
              : `<span class="my-emoji">🧭</span>`
            }
          </div>
        </div>
      `,
      iconSize: [46, 46],
      iconAnchor: [23, 46]
    });
  };

  // Build custom icon for partner's live position (blue pulse)
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

  // Icon for start and end route markers
  const createStartEndIcon = (emoji) => {
    return L.divIcon({
      className: 'love-map-emoji-marker',
      html: `<div class="w-8 h-8 rounded-full bg-white/95 shadow border border-slate-100 flex items-center justify-center text-sm">${emoji}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  // Icon for relive avatar
  const createReliveIcon = () => {
    return L.divIcon({
      className: 'love-map-relive-marker',
      html: `
        <div class="relive-pulse-wrapper">
          <div class="relive-pulse-ring"></div>
          <div class="relive-avatar-container animate-bounce">
            <span class="relive-emoji">👩‍❤️‍👨</span>
          </div>
        </div>
      `,
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    });
  };

  // Filter valid memory coordinates safely
  const pathPositions = memories
    .filter(m => m && typeof m.latitude === 'number' && typeof m.longitude === 'number')
    .map(m => [m.latitude, m.longitude]);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full relative love-map-container no-scrollbar overflow-hidden">
      {/* Map Header Controls */}
      <div className="absolute top-4 left-4 right-4 z-[999] flex items-center justify-between pointer-events-none font-display">
        <div className="liquid-glass rim-light px-4 py-2 flex items-center gap-2 pointer-events-auto shadow-lg">
          <MapPin className="text-primary w-4 h-4" />
          <span className="font-semibold text-xs text-foreground text-glow">Love Map</span>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* List memories & journeys button */}
          <button
            onClick={() => setShowListDialog(true)}
            className="liquid-glass rim-light p-2.5 rounded-full text-muted-foreground hover:text-foreground transition-all duration-300 shadow-lg active:scale-95 bg-[#181116]/80 backdrop-blur-md"
            title="Danh sách kỷ niệm"
          >
            <BookOpen className="w-4 h-4" />
          </button>

          {/* Mark current location button */}
          <button
            onClick={handleMarkCurrentLocation}
            className="liquid-glass rim-light p-2.5 rounded-full text-muted-foreground hover:text-foreground transition-all duration-300 shadow-lg active:scale-95 bg-[#181116]/80 backdrop-blur-md"
            title="Ghim vị trí hiện tại"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Realtime Love Journey tracking button (blue / red animated) */}
          <button
            onClick={isRecordingJourney ? stopRecordingJourney : startRecordingJourney}
            className={cn(
              "liquid-glass rim-light p-2.5 rounded-full transition-all duration-300 shadow-lg active:scale-95",
              isRecordingJourney 
                ? "bg-red-500 hover:bg-red-600 text-white border-transparent animate-pulse" 
                : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
            )}
            title={isRecordingJourney ? "Kết thúc hành trình" : "Ghi lại hành trình"}
          >
            <Route className="w-4 h-4" />
          </button>

          {/* Location sharing toggle */}
          <button
            onClick={toggleLocationSharing}
            className={cn(
              "liquid-glass rim-light p-2.5 rounded-full transition-all duration-300 shadow-lg active:scale-95",
              isSharingLocation 
                ? "gradient-primary text-white border-transparent liquid-glow" 
                : "text-muted-foreground hover:text-foreground bg-[#181116]/80 backdrop-blur-md"
            )}
            title={isSharingLocation ? "Tắt định vị" : "Bật định vị"}
          >
            <Navigation className={cn("w-4 h-4", isSharingLocation && "animate-pulse")} />
          </button>
        </div>
      </div>

      {/* Instructions Overlay */}
      <div className="absolute bottom-4 left-4 z-[999] pointer-events-none max-w-[220px]">
        <div className="liquid-glass rim-light p-2 text-[10px] text-muted-foreground leading-normal pointer-events-auto">
          {isRecordingJourney ? (
            <span className="text-red-400 font-bold animate-pulse">👣 Đang ghi nhận hành trình di chuyển...</span>
          ) : (
            <span>💡 **Mẹo**: Nhấn nút màu xanh dương để bắt đầu vẽ hành trình đi chơi cùng nhau.</span>
          )}
        </div>
      </div>

      {/* Leaflet Map */}
      <div className="flex-1 w-full h-full relative z-0 rounded-3xl overflow-hidden shadow-inner border border-white/20">
        <MapContainer 
          center={[16.047079, 108.206230]} 
          zoom={6} 
          doubleClickZoom={false}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Capture map instance */}
          <MapInstanceCapture setMap={setMap} />

          {/* Pastel/Voyager CartoDB Map Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

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

          {/* Saved Selected Love Journey Path */}
          {selectedJourney && Array.isArray(selectedJourney.coords) && selectedJourney.coords.length > 1 && (
            <>
              <Polyline
                positions={selectedJourney.coords.filter(c => c && typeof c.lat === 'number' && typeof c.lng === 'number').map(c => [c.lat, c.lng])}
                pathOptions={{
                  color: '#06b6d4',
                  weight: 4,
                  className: 'love-journey-path'
                }}
              />
              {selectedJourney.coords[0] && typeof selectedJourney.coords[0].lat === 'number' && (
                <Marker 
                  position={[selectedJourney.coords[0].lat, selectedJourney.coords[0].lng]}
                  icon={createStartEndIcon('🟢')}
                />
              )}
              {selectedJourney.coords[selectedJourney.coords.length - 1] && typeof selectedJourney.coords[selectedJourney.coords.length - 1].lat === 'number' && (
                <Marker 
                  position={[selectedJourney.coords[selectedJourney.coords.length - 1].lat, selectedJourney.coords[selectedJourney.coords.length - 1].lng]}
                  icon={createStartEndIcon('🏁')}
                />
              )}
            </>
          )}

          {/* Journey Relive Avatar Marker Animation */}
          {isReliving && selectedJourney && Array.isArray(selectedJourney.coords) && reliveIndex < selectedJourney.coords.length && selectedJourney.coords[reliveIndex] && typeof selectedJourney.coords[reliveIndex].lat === 'number' && (
            <Marker 
              position={[selectedJourney.coords[reliveIndex].lat, selectedJourney.coords[reliveIndex].lng]}
              icon={createReliveIcon()}
            />
          )}

          {/* Active Recording Love Journey Path */}
          {isRecordingJourney && Array.isArray(journeyCoords) && journeyCoords.length > 1 && (
            <>
              <Polyline
                positions={journeyCoords.filter(c => c && typeof c.lat === 'number' && typeof c.lng === 'number').map(c => [c.lat, c.lng])}
                pathOptions={{
                  color: '#ef4444',
                  dashArray: '4, 8',
                  weight: 4,
                  className: 'love-journey-path-active'
                }}
              />
              {journeyCoords[0] && typeof journeyCoords[0].lat === 'number' && (
                <Marker 
                  position={[journeyCoords[0].lat, journeyCoords[0].lng]}
                  icon={createStartEndIcon('👣')}
                />
              )}
            </>
          )}

          {/* Memory Pins */}
          {memories.map((m) => (
            m && typeof m.latitude === 'number' && typeof m.longitude === 'number' && (
              <Marker
                key={m.id}
                position={[m.latitude, m.longitude]}
                icon={createMemoryIcon(m.createdBy, m.emoji)}
                eventHandlers={{
                  click: () => {
                    setSelectedMemory(m);
                    setSelectedJourney(null);
                  }
                }}
              />
            )
          ))}

          {/* currentUser Own Realtime Position Pin */}
          {isSharingLocation && myLocation && typeof myLocation.lat === 'number' && typeof myLocation.lng === 'number' && (
            <Marker
              position={[myLocation.lat, myLocation.lng]}
              icon={createMyLocationIcon(currentUser?.email || '')}
            />
          )}

          {/* Partner Realtime Position Pin */}
          {partnerLocation && typeof partnerLocation.lat === 'number' && typeof partnerLocation.lng === 'number' && (
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
            className="absolute bottom-4 left-4 right-4 z-[999] max-w-sm mx-auto font-body"
          >
            <div className="bg-white text-slate-800 p-4 rounded-xl shadow-2xl relative border border-slate-100 flex flex-col gap-3">
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
                      {selectedMemory.date ? selectedMemory.date.split('-').reverse().join('/') : ''}
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

        {/* Selected Journey Path popover details */}
        {selectedJourney && !selectedMemory && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-4 left-4 right-4 z-[999] max-w-sm mx-auto font-body"
          >
            <div className="bg-white text-slate-800 p-4 rounded-xl shadow-2xl relative border border-slate-100 flex flex-col gap-2.5 text-left">
              <button 
                onClick={() => {
                  setSelectedJourney(null);
                  setIsReliving(false);
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={12} className="text-slate-500" />
              </button>
              
              <div className="flex items-center gap-1.5 text-slate-400">
                <Calendar size={11} />
                <span className="text-[10px] font-semibold tracking-wider">
                  {selectedJourney.date ? selectedJourney.date.split('-').reverse().join('/') : ''}
                </span>
              </div>
              
              <h4 className="font-bold text-sm text-slate-800 mt-0.5">🗺️ {selectedJourney.title}</h4>
              {selectedJourney.notes && <p className="text-xs text-slate-600 italic">"{selectedJourney.notes}"</p>}
              
              {/* Journey info pills */}
              <div className="flex gap-2 mt-1">
                <span className="text-[9px] bg-cyan-50 text-cyan-600 border border-cyan-100 px-2 py-0.5 rounded-full font-bold">
                  Quãng đường: {calculatePathDistance(selectedJourney.coords)} km
                </span>
                {selectedJourney.duration && (
                  <span className="text-[9px] bg-slate-50 text-slate-600 border border-slate-100 px-2 py-0.5 rounded-full font-bold">
                    Thời gian: {formatDuration(selectedJourney.duration)}
                  </span>
                )}
              </div>

              {/* Relive Action Button */}
              <button
                disabled={isReliving}
                onClick={() => setIsReliving(true)}
                className={cn(
                  "w-full py-2 rounded-xl text-white font-bold text-xs shadow flex items-center justify-center gap-1.5 transition-all mt-1 active:scale-95",
                  isReliving 
                    ? "bg-slate-300 cursor-not-allowed text-slate-500" 
                    : "bg-cyan-500 hover:bg-cyan-600"
                )}
              >
                {isReliving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Đang tua lại lộ trình di chuyển...
                  </>
                ) : (
                  <>
                    ▶️ Tua lại hành trình di chuyển
                  </>
                )}
              </button>

              <div className="flex items-center justify-between mt-1.5 pt-2 border-t border-slate-100">
                <span className="text-[9px] text-slate-400">
                  Ghi bởi: {profiles[selectedJourney.createdBy]?.display_name?.split(' ')[0] || selectedJourney.createdBy.split('@')[0]}
                </span>
                {selectedJourney.createdBy === currentUser?.email?.toLowerCase() && (
                  <button
                    onClick={() => handleDeleteJourney(selectedJourney.id)}
                    className="text-[9px] text-red-500 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <Trash2 size={10} /> Xóa hành trình
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Directory Dialog Overlay (Memories / Journeys) */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent className="w-[95%] max-w-sm rounded-3xl p-5 liquid-glass-heavy border-none text-foreground max-h-[75vh] overflow-y-auto font-display">
          <DialogHeader className="pb-2 border-b border-white/10 flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <BookOpen className="text-primary w-4.5 h-4.5" /> Danh mục tình yêu
            </DialogTitle>
          </DialogHeader>

          {/* Directory Tabs */}
          <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10 mt-3">
            <button
              onClick={() => setActiveListTab('memories')}
              className={cn(
                "flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all",
                activeListTab === 'memories'
                  ? "gradient-primary text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Địa điểm ({memories.length})
            </button>
            <button
              onClick={() => setActiveListTab('journeys')}
              className={cn(
                "flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all",
                activeListTab === 'journeys'
                  ? "gradient-primary text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Hành trình ({savedJourneys.length})
            </button>
          </div>

          {/* Tabs Content */}
          <div className="space-y-3 mt-4">
            {activeListTab === 'memories' ? (
              memories.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Chưa có địa điểm kỷ niệm nào.</p>
              ) : (
                [...memories].reverse().map(mem => (
                  <div 
                    key={mem.id}
                    onClick={() => {
                      setShowListDialog(false);
                      if (typeof mem.latitude === 'number' && typeof mem.longitude === 'number') {
                        focusOnLocation(mem.latitude, mem.longitude, 15);
                      }
                      setSelectedMemory(mem);
                      setSelectedJourney(null);
                    }}
                    className="flex gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer items-start active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
                      {mem.emoji || '📍'}
                    </div>
                    <div className="flex-1 min-w-0 text-left font-body">
                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-relaxed">"{mem.notes || ''}"</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] text-muted-foreground">
                          {mem.date ? mem.date.split('-').reverse().join('/') : ''}
                        </span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                          {profiles[mem.createdBy]?.display_name?.split(' ')[0] || mem.createdBy.split('@')[0]}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              savedJourneys.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Chưa có hành trình di chuyển nào.</p>
              ) : (
                savedJourneys.map(jn => (
                  <div
                    key={jn.id}
                    onClick={() => {
                      setShowListDialog(false);
                      if (Array.isArray(jn.coords) && jn.coords.length > 0 && jn.coords[0] && typeof jn.coords[0].lat === 'number') {
                        focusOnLocation(jn.coords[0].lat, jn.coords[0].lng, 13);
                      }
                      setSelectedJourney(jn);
                      setSelectedMemory(null);
                    }}
                    className="flex gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer items-start active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-lg flex-shrink-0">
                      🗺️
                    </div>
                    <div className="flex-1 min-w-0 text-left font-body">
                      <p className="text-xs font-bold text-foreground truncate">{jn.title}</p>
                      <div className="flex gap-1.5 mt-1">
                        <span className="text-[9px] bg-cyan-500/15 text-cyan-400 px-1.5 py-0.2 rounded-md font-semibold">
                          {calculatePathDistance(jn.coords)} km
                        </span>
                        {jn.duration && (
                          <span className="text-[9px] bg-white/5 text-muted-foreground px-1.5 py-0.2 rounded-md font-semibold flex items-center gap-0.5">
                            ⏱️ {formatDuration(jn.duration)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] text-muted-foreground">
                          {jn.date ? jn.date.split('-').reverse().join('/') : ''}
                        </span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold">
                          {profiles[jn.createdBy]?.display_name?.split(' ')[0] || jn.createdBy.split('@')[0]}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Memory Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="w-[90%] max-w-sm rounded-3xl p-5 liquid-glass-heavy border-none text-foreground font-display">
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
                className="w-full rounded-xl liquid-glass-sm bg-transparent border-transparent text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-primary leading-normal resize-none font-body"
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

      {/* Save Journey Dialog (Shown AFTER finishing journey) */}
      <Dialog open={showJourneyDialog} onOpenChange={setShowJourneyDialog}>
        <DialogContent className="w-[90%] max-w-sm rounded-3xl p-5 liquid-glass-heavy border-none text-foreground font-display">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-cyan-400">
              🗺️ Lưu hành trình mới
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveJourney} className="space-y-4 mt-2">
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs leading-relaxed text-cyan-300">
              ✨ Hoàn thành hành trình! Hệ thống đã ghi nhận **{journeyCoords.length} điểm mốc** di chuyển của hai bạn. Hãy đặt tên để lưu lại nhé!
            </div>

            {/* Title input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Tên hành trình</label>
              <Input
                required
                value={journeyTitle}
                onChange={e => setJourneyTitle(e.target.value)}
                placeholder="Ví dụ: Phượt Ba Vì ngày mưa, Đi dạo Hồ Tây..."
                className="liquid-glass-sm bg-transparent border-transparent h-9 text-xs"
              />
            </div>

            {/* Date selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Ngày diễn ra</label>
              <Input
                type="date"
                required
                value={journeyDate}
                onChange={e => setJourneyDate(e.target.value)}
                className="liquid-glass-sm bg-transparent border-transparent h-9 text-xs"
              />
            </div>

            {/* Notes input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Cảm nghĩ/Ghi chú</label>
              <textarea
                rows={3}
                value={journeyNotes}
                onChange={e => setJourneyNotes(e.target.value)}
                placeholder="Ví dụ: Đường đi hơi ướt nhưng rất vui, mua được quả ngô nướng siêu ngon..."
                className="w-full rounded-xl liquid-glass-sm bg-transparent border-transparent text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 leading-normal resize-none font-body"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={savingJourney}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white h-9 rounded-xl text-xs font-bold shadow-lg"
              >
                {savingJourney ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Đang lưu...
                  </span>
                ) : 'Lưu lộ trình 🗺️'}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowJourneyDialog(false);
                  setJourneyCoords([]);
                }}
                className="flex-1 h-9 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-muted-foreground border-transparent"
              >
                Hủy bỏ
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
