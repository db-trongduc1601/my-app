import { useState, useRef } from 'react';
import { Music, Plus, Loader2, Link2, Upload, Trash2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, storage } from '../../firebase';
import { collection, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function getYoutubeEmbed(url) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function TrackCard({ track, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const embedUrl = getYoutubeEmbed(track.url);
  const isUpload = track.loai === 'upload';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // If file was uploaded to Firebase storage, delete it as well
      if (track.url && track.url.includes('firebasestorage')) {
        const fileRef = ref(storage, track.url);
        await deleteObject(fileRef).catch(() => {});
      }
      await deleteDoc(doc(db, 'music_tracks', track.id));
      toast.success('Đã xóa');
      onDelete?.();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xóa bài hát!');
    }
    setDeleting(false);
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="liquid-glass liquid-glass-interactive rounded-2xl overflow-hidden">
      {embedUrl && (
        <div className="aspect-video w-full">
          <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
        </div>
      )}
      {isUpload && (
        <div className="px-4 pt-4">
          <audio controls className="w-full" src={track.url}>Your browser does not support audio.</audio>
        </div>
      )}
      <div className="p-3 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{track.ten_bai}</p>
          {track.nghe_si && <p className="text-xs text-muted-foreground">{track.nghe_si}</p>}
          {track.ghi_chu && <p className="text-xs text-muted-foreground italic mt-0.5">"{track.ghi_chu}"</p>}
          {!embedUrl && !isUpload && track.url && (
            <a href={track.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline">
              <ExternalLink size={10} /> Mở link
            </a>
          )}
        </div>
        <button onClick={handleDelete} disabled={deleting} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5">
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </motion.div>
  );
}

export default function MusicTab({ tracks, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState('link'); // 'link' | 'upload'
  const [form, setForm] = useState({ ten_bai: '', nghe_si: '', url: '', ghi_chu: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const handleSave = async () => {
    if (!form.ten_bai) return;
    setSaving(true);
    try {
      let url = form.url;
      if (mode === 'upload' && file) {
        const fileExt = file.name ? file.name.split('.').pop() : 'mp3';
        const fileName = `music_tracks/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, file);
        url = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, 'music_tracks'), {
        ...form,
        url,
        loai: mode,
        created_date: new Date().toISOString()
      });
      toast.success('🎵 Đã thêm bài hát!');
      setForm({ ten_bai: '', nghe_si: '', url: '', ghi_chu: '' });
      setFile(null);
      setShowForm(false);
      onRefresh?.();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi lưu bài hát!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(v => !v)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-secondary/50 transition-colors">
        <Plus size={15} /> Thêm bài hát
      </button>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="liquid-glass rounded-2xl p-4 space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setMode('link')}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all",
                  mode === 'link' ? "bg-primary text-primary-foreground" : "liquid-glass-sm text-muted-foreground")}>
                <Link2 size={14} /> Dán link
              </button>
              <button onClick={() => setMode('upload')}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all",
                  mode === 'upload' ? "bg-primary text-primary-foreground" : "liquid-glass-sm text-muted-foreground")}>
                <Upload size={14} /> Upload file
              </button>
            </div>
            <Input placeholder="Tên bài hát *" value={form.ten_bai} onChange={e => setForm(f => ({...f, ten_bai: e.target.value}))} />
            <Input placeholder="Ca sĩ / nghệ sĩ" value={form.nghe_si} onChange={e => setForm(f => ({...f, nghe_si: e.target.value}))} />
            {mode === 'link' ? (
              <Input placeholder="Link YouTube / SoundCloud..." value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))} />
            ) : (
              <div>
                <button onClick={() => fileRef.current.click()}
                  className="w-full border-2 border-dashed border-primary/30 rounded-xl py-5 flex flex-col items-center gap-1.5 hover:bg-secondary/50 transition-colors text-sm text-muted-foreground">
                  <Upload size={20} className="text-primary/50" />
                  {file ? file.name : 'Chọn file audio / video'}
                </button>
                <input ref={fileRef} type="file" accept="audio/*,video/*" className="hidden" onChange={e => setFile(e.target.files[0])} />
              </div>
            )}
            <Input placeholder="Ghi chú vibe... (tuỳ chọn)" value={form.ghi_chu} onChange={e => setForm(f => ({...f, ghi_chu: e.target.value}))} />
            <Button onClick={handleSave} disabled={saving || !form.ten_bai || (mode === 'link' && !form.url) || (mode === 'upload' && !file)}
              className="w-full gradient-primary text-white border-0 rounded-xl">
              {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Thêm vào playlist
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {tracks.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Music size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Playlist trống rỗng 🎵</p>
          </div>
        ) : (
          tracks.map(t => <TrackCard key={t.id} track={t} onDelete={onRefresh} />)
        )}
      </div>
    </div>
  );
}