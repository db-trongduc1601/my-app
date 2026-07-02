import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * Floating global invite cards (Listen Together + Caro) shown above the
 * bottom nav. Presentational: the parent owns the invite state and passes
 * setters so it can clear an invite once accepted/declined.
 */
export default function GlobalInviteBanners({ globalInvite, caroInvite, setGlobalInvite, setCaroInvite }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      {/* Global Listen Together Invite Card (Floating) */}
      <AnimatePresence>
        {globalInvite && location.pathname !== '/' && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-4 right-4 z-[9999] mx-auto max-w-sm"
          >
            <div className="liquid-glass border-primary/40 p-4 rounded-3xl shadow-2xl flex flex-col gap-3 bg-[#181116]/85 backdrop-blur-xl text-white rim-light">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 animate-pulse text-lg">
                  🎧
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    Lời mời nghe chung <span className="text-xs">🎧</span>
                  </p>
                  <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                    <span className="font-bold text-foreground">{globalInvite.host_name}</span> muốn rủ bạn cùng nghe bài <span className="text-primary font-medium">{globalInvite.track?.ten_bai}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'listening_sessions', globalInvite.id), {
                        status: 'active',
                        updated_at: new Date()
                      });
                      setGlobalInvite(null);
                      navigate('/', { state: { openEntertainment: true, entertainmentTab: 'music' } });
                    } catch(e) {}
                  }}
                  className="flex-1 py-2.5 rounded-2xl text-white font-bold text-sm gradient-primary shadow-lg hover:opacity-90 active:scale-95 transition-all text-center"
                >
                  Tham gia ngay
                </button>
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'listening_sessions', globalInvite.id), {
                        status: 'declined',
                        updated_at: new Date()
                      });
                      setGlobalInvite(null);
                    } catch(e) {}
                  }}
                  className="flex-1 py-2.5 rounded-2xl text-muted-foreground hover:bg-white/10 text-sm font-semibold bg-white/5 active:scale-95 transition-all text-center"
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Caro Invite Card (Floating) */}
      <AnimatePresence>
        {caroInvite && location.pathname !== '/games' && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-4 right-4 z-[9999] mx-auto max-w-sm"
          >
            <div className="liquid-glass border-cyan-500/40 p-4 rounded-3xl shadow-2xl flex flex-col gap-3 bg-[#181116]/85 backdrop-blur-xl text-white rim-light">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 animate-pulse text-lg">
                  ❌
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    Lời mời đấu cờ XO <span className="text-xs">🎮</span>
                  </p>
                  <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                    <span className="font-bold text-foreground">{caroInvite.host_name}</span> muốn rủ bạn cùng đấu một ván cờ Caro 3x3!
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'caro_games', 'couple_caro'), {
                        status: 'playing',
                        updatedAt: new Date()
                      });
                      setCaroInvite(null);
                      navigate('/games');
                    } catch(e) {}
                  }}
                  className="flex-1 py-2.5 rounded-2xl text-white font-bold text-sm bg-cyan-500 shadow-lg hover:opacity-90 active:scale-95 transition-all text-center"
                >
                  Chiến luôn ⚔️
                </button>
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'caro_games', 'couple_caro'), {
                        status: 'declined',
                        updatedAt: new Date()
                      });
                      setCaroInvite(null);
                    } catch(e) {}
                  }}
                  className="flex-1 py-2.5 rounded-2xl text-muted-foreground hover:bg-white/10 text-sm font-semibold bg-white/5 active:scale-95 transition-all text-center"
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
