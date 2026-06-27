import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, getDoc, query, where, onSnapshot } from 'firebase/firestore';
import { X, Copy, Check, UserPlus, Trash2, Loader2, MessageCircle, Pencil, Clock, UserCheck, UserX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ChatWindow from './ChatWindow';
import { useAuth } from '@/lib/AuthContext';

function generateFriendCode(email) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '0123456789';
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  let code = '';
  for (let i = 0; i < 3; i++) code += chars[(hash >> (i * 5)) % chars.length];
  for (let i = 0; i < 3; i++) code += nums[(hash >> (i * 3 + 15)) % nums.length];
  return code;
}

export default function FriendsSidebar({ open, onClose, currentUser }) {
  const [friends, setFriends] = useState([]);         // accepted friends (both directions)
  const [pendingIn, setPendingIn] = useState([]);     // requests sent TO me
  const [pendingOut, setPendingOut] = useState([]);   // requests sent BY me, waiting
  const [codeInput, setCodeInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editNick, setEditNick] = useState('');
  const [chatFriend, setChatFriend] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const { unreadCountBySender } = useAuth();

  const myCode = currentUser ? generateFriendCode(currentUser.email) : '';

  const loadData = async () => {
    if (!currentUser) return;

    try {
      const myEmail = currentUser.email;
      const ownerQuery = query(collection(db, 'friends'), where('owner_email', '==', myEmail));
      const friendQuery = query(collection(db, 'friends'), where('friend_email', '==', myEmail));
      const [ownerSnapshot, friendSnapshot] = await Promise.all([
        getDocs(ownerQuery),
        getDocs(friendQuery),
      ]);
      const allRecords = [
        ...ownerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...friendSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      ];

      // Accepted friends: both directions
      const accepted = allRecords.filter(r => r.status === 'accepted');
      const seen = new Set();
      const deduped = accepted.filter(r => {
        const key = [r.owner_email, r.friend_email].sort().join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setFriends(deduped);

      // Pending incoming: friend_email === me, status=pending
      const incoming = allRecords.filter(r => r.friend_email === myEmail && r.status === 'pending');
      setPendingIn(incoming);

      // Pending outgoing: owner_email === me, status=pending
      const outgoing = allRecords.filter(r => r.owner_email === myEmail && r.status === 'pending');
      setPendingOut(outgoing);
    } catch (error) {
      console.error("Error loading friends data:", error);
    }
  };

  useEffect(() => {
    if (open && currentUser) loadData();
  }, [open, currentUser]);

  useEffect(() => {
    // Real-time listener for profiles (presence)
    const unsub = onSnapshot(collection(db, 'user_profiles'), async (snapshot) => {
      const profiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllProfiles(profiles);
      
      // Auto-register or sync my profile
      if (currentUser && currentUser.email) {
        const mine = profiles.find(p => p.email === currentUser.email);
        const authName = currentUser.displayName || '';
        const authPhoto = currentUser.photoURL || '';
        
        if (!mine) {
          try {
            await addDoc(collection(db, 'user_profiles'), { 
              email: currentUser.email, 
              friend_code: myCode,
              display_name: authName,
              photo_url: authPhoto
            });
          } catch(e) {}
        } else {
          // Sync if out of sync with Auth (for users who created accounts before profile feature)
          if (mine.display_name !== authName || mine.photo_url !== authPhoto) {
            try {
              await updateDoc(doc(db, 'user_profiles', mine.id), {
                display_name: authName,
                photo_url: authPhoto
              });
            } catch(e) {}
          }
        }
      }
    });
    return () => unsub();
  }, [currentUser, myCode]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Đã copy mã kết bạn!');
  };

  const handleSendRequest = async () => {
    if (!codeInput.trim() || !currentUser || adding) return;
    const code = codeInput.trim().toUpperCase();
    if (code === myCode) { toast.error('Không thể kết bạn với chính mình!'); return; }
    const profile = allProfiles.find(p => p.friend_code === code);
    if (!profile) { toast.error('Không tìm thấy người dùng với mã này'); return; }

    setAdding(true);
    try {
      // Check if already friends or pending
      const friendsSnapshot = await getDocs(collection(db, 'friends'));
      const allRecords = friendsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const exists = allRecords.find(r =>
        (r.owner_email === currentUser.email && r.friend_email === profile.email) ||
        (r.owner_email === profile.email && r.friend_email === currentUser.email)
      );
      if (exists) {
        if (exists.status === 'accepted') {
          toast.error('Đã là bạn bè rồi!');
          setAdding(false);
          return;
        }
        if (exists.owner_email === currentUser.email) {
          toast.error('Đã gửi lời mời rồi!');
          setAdding(false);
          return;
        }

        // Incoming pending request exists from the other user, auto-accept it.
        await updateDoc(doc(db, 'friends', exists.id), { status: 'accepted' });

        const mirrorQuery = query(
          collection(db, 'friends'),
          where('owner_email', '==', currentUser.email),
          where('friend_email', '==', profile.email),
          where('status', '==', 'accepted')
        );
        const mirrorSnapshot = await getDocs(mirrorQuery);
        if (mirrorSnapshot.empty) {
          await addDoc(collection(db, 'friends'), {
            owner_email: currentUser.email,
            friend_email: profile.email,
            friend_code: generateFriendCode(profile.email),
            nickname: '',
            status: 'accepted',
            requester_email: profile.email,
          });
        }

        toast.success('✅ Đã chấp nhận lời mời của người kia!');
        setCodeInput('');
        loadData();
        setAdding(false);
        return;
      }

      // Create a pending request entry (owner=me, friend=target, status=pending)
      await addDoc(collection(db, 'friends'), {
        owner_email: currentUser.email,
        friend_email: profile.email,
        friend_code: code,
        nickname: '',
        status: 'pending',
        requester_email: currentUser.email,
      });
      toast.success('📨 Đã gửi lời mời kết bạn!');
      setCodeInput('');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Gửi lời mời thất bại!');
    } finally {
      setAdding(false);
    }
  };

  const handleAccept = async (record) => {
    try {
      // Update the existing record to accepted
      await updateDoc(doc(db, 'friends', record.id), { status: 'accepted' });
      // Also create a mirror entry so the requester also sees the friend
      await addDoc(collection(db, 'friends'), {
        owner_email: currentUser.email,
        friend_email: record.owner_email,
        friend_code: generateFriendCode(record.owner_email),
        nickname: '',
        status: 'accepted',
        requester_email: record.owner_email,
      });
      toast.success('✅ Đã chấp nhận kết bạn!');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi chấp nhận kết bạn!');
    }
  };

  const handleReject = async (record) => {
    try {
      await deleteDoc(doc(db, 'friends', record.id));
      toast.success('Đã từ chối lời mời');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi từ chối lời mời!');
    }
  };

  const removeFriendRecords = async (record) => {
    const friendEmail = record.owner_email === currentUser.email ? record.friend_email : record.owner_email;
    const candidatesQuery = query(
      collection(db, 'friends'),
      where('owner_email', 'in', [currentUser.email, friendEmail])
    );
    const snapshot = await getDocs(candidatesQuery);
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const toDelete = records.filter(r => (
      (r.owner_email === currentUser.email && r.friend_email === friendEmail) ||
      (r.owner_email === friendEmail && r.friend_email === currentUser.email)
    ));

    await Promise.all(toDelete.map(r => deleteDoc(doc(db, 'friends', r.id))));
  };

  const handleDelete = async (recordOrId) => {
    try {
      let record = recordOrId;
      if (typeof recordOrId === 'string') {
        const docRef = doc(db, 'friends', recordOrId);
        const docSnap = await getDoc(docRef);
        record = docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
        if (!record) {
          throw new Error('Không tìm thấy bản ghi bạn bè');
        }
      }

      await removeFriendRecords(record);
      toast.success('Đã xóa bạn');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xóa bạn!');
    }
  };

  const handleSaveNick = async (friend) => {
    try {
      await updateDoc(doc(db, 'friends', friend.id), { nickname: editNick });
      setEditingId(null);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi lưu nickname!');
    }
  };

  const getFriendDisplay = (record) => {
    const otherEmail = record.owner_email === currentUser?.email ? record.friend_email : record.owner_email;
    const friendProfile = allProfiles.find(p => p.email === otherEmail);
    const fallbackName = otherEmail ? otherEmail.split('@')[0] : 'Ẩn danh';
    return {
      email: otherEmail,
      displayName: record.nickname || friendProfile?.display_name || fallbackName,
      photoUrl: friendProfile?.photo_url || null,
      id: record.id,
      nickname: record.nickname,
      friend_code: record.friend_code,
    };
  };

  if (!open) return null;

  return (
    <>
      <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[4px]" onClick={onClose} />
      <motion.div
        initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={chatFriend ?
          'absolute top-16 bottom-0 left-0 right-0 w-full z-50 liquid-glass-heavy rounded-t-3xl border-t border-white/10 shadow-2xl flex flex-col overflow-hidden' :
          'absolute top-0 left-0 h-full w-80 max-w-[85%] z-50 liquid-glass-heavy border-r border-border shadow-2xl flex flex-col'
        }
      >
        <AnimatePresence mode="wait">
          {chatFriend ? (
            <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
              <ChatWindow friend={chatFriend} currentUser={currentUser} onBack={() => setChatFriend(null)} />
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-border liquid-glass rim-light">
                <span className="font-display font-semibold text-lg">Bạn bè 👥</span>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 min-h-0">
                {/* My code */}
                <div className="liquid-glass rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Mã kết bạn của bạn</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 liquid-glass-sm rounded-xl px-3 py-2 font-mono text-lg font-bold tracking-widest text-center text-primary">
                      {myCode}
                    </div>
                    <button onClick={handleCopy}
                      className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 transition-all hover:opacity-90">
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Chia sẻ mã này để kết bạn</p>
                </div>

                {/* Add friend */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Gửi lời mời kết bạn</p>
                  <div className="flex gap-2">
                    <Input
                      value={codeInput}
                      onChange={e => setCodeInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleSendRequest()}
                      placeholder="Nhập mã XXXNNN"
                      maxLength={6}
                      className="font-mono uppercase tracking-widest text-center"
                    />
                    <button onClick={handleSendRequest} disabled={adding || codeInput.length < 6}
                      className="w-10 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 flex-shrink-0">
                      {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    </button>
                  </div>
                </div>

                {/* Incoming requests */}
                {pendingIn.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                      Lời mời nhận được ({pendingIn.length})
                    </p>
                    {pendingIn.map(r => {
                      const name = (r.owner_email || 'Ẩn danh').split('@')[0];
                      return (
                        <div key={r.id} className="liquid-glass liquid-glass-interactive rounded-2xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-sm font-bold text-yellow-700 dark:text-yellow-400 flex-shrink-0">
                              {name[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{name}</p>
                              <p className="text-xs text-muted-foreground">Muốn kết bạn với bạn</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleAccept(r)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity">
                              <UserCheck size={13} /> Chấp nhận
                            </button>
                            <button onClick={() => handleReject(r)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl liquid-glass-sm text-muted-foreground text-xs font-semibold hover:bg-destructive/10 hover:text-destructive transition-colors">
                              <UserX size={13} /> Từ chối
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Outgoing pending requests */}
                {pendingOut.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                      Chờ xác nhận ({pendingOut.length})
                    </p>
                    {pendingOut.map(r => {
                      const name = (r.friend_email || 'Ẩn danh').split('@')[0];
                      return (
                        <div key={r.id} className="liquid-glass liquid-glass-interactive rounded-2xl p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full liquid-glass-sm flex items-center justify-center text-sm font-bold text-muted-foreground flex-shrink-0">
                            {name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock size={10} className="text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">Đang chờ xác nhận...</p>
                            </div>
                          </div>
                          <button onClick={() => handleDelete(r.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors flex-shrink-0">
                            <X size={13} className="text-destructive" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Friends list */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Bạn bè ({friends.length})</p>
                  {friends.length === 0 && pendingIn.length === 0 && pendingOut.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Chưa có bạn bè nào 🌸</p>
                  )}
                  {friends.map(r => {
                    const f = getFriendDisplay(r);
                    const profile = allProfiles.find(p => p.email === f.email);
                    
                    let isOnline = false;
                    let lastActiveText = "";
                    if (profile?.last_active?.toMillis) {
                      const lastActiveMs = profile.last_active.toMillis();
                      const diff = now - lastActiveMs;
                      if (diff < 45000) {
                        isOnline = true;
                      } else {
                        const mins = Math.floor(diff / 60000);
                        if (mins < 60) lastActiveText = `Hoạt động ${mins || 1} phút trước`;
                        else if (mins < 1440) lastActiveText = `Hoạt động ${Math.floor(mins/60)} giờ trước`;
                        else lastActiveText = `Hoạt động ${Math.floor(mins/1440)} ngày trước`;
                      }
                    }

                    const unreadCount = unreadCountBySender?.[f.email?.toLowerCase()] || 0;

                    return (
                      <div key={r.id} className="liquid-glass liquid-glass-interactive rounded-2xl p-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="relative w-9 h-9 flex-shrink-0">
                            {f.photoUrl ? (
                              <img src={f.photoUrl} alt={f.displayName} className="w-full h-full rounded-full object-cover border border-white/20" />
                            ) : (
                              <div className="w-full h-full rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold">
                                {f.displayName[0]?.toUpperCase()}
                              </div>
                            )}
                            {isOnline && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {editingId === r.id ? (
                              <div className="flex gap-1">
                                <Input value={editNick} onChange={e => setEditNick(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleSaveNick(r)}
                                  className="h-7 text-xs rounded-lg" placeholder="Nickname..." autoFocus />
                                <button onClick={() => handleSaveNick(r)} className="text-primary text-xs font-medium px-1">OK</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <p className={cn("font-medium text-sm truncate", unreadCount > 0 && "font-bold text-foreground")}>
                                  {f.displayName}
                                </p>
                                {unreadCount > 0 && (
                                  <span className="min-w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0 px-1">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isOnline ? (
                                <span className="text-[10px] font-semibold text-green-500">Đang hoạt động</span>
                              ) : lastActiveText ? (
                                <span className="text-[10px] text-muted-foreground">{lastActiveText}</span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground truncate">{f.email}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => setChatFriend({ ...r, friend_email: f.email, nickname: f.nickname })}
                              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
                              <MessageCircle size={13} className="text-primary" />
                            </button>
                            <button onClick={() => { setEditingId(editingId === r.id ? null : r.id); setEditNick(r.nickname || ''); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
                              <Pencil size={13} className="text-muted-foreground" />
                            </button>
                            <button onClick={() => handleDelete(r.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors">
                              <Trash2 size={13} className="text-destructive" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}