import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { X, Copy, Check, UserPlus, Trash2, Loader2, MessageCircle, Pencil, Clock, UserCheck, UserX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import ChatWindow from './ChatWindow';

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

  const myCode = currentUser ? generateFriendCode(currentUser.email) : '';

  const loadData = async () => {
    if (!currentUser) return;

    try {
      // Register own profile if not exists
      const profilesSnapshot = await getDocs(collection(db, 'user_profiles'));
      const profiles = profilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllProfiles(profiles);
      
      const mine = profiles.find(p => p.email === currentUser.email);
      if (!mine) {
        const newProfileRef = await addDoc(collection(db, 'user_profiles'), { email: currentUser.email, friend_code: myCode });
        setAllProfiles(prev => [...prev, { id: newProfileRef.id, email: currentUser.email, friend_code: myCode }]);
      }

      const myEmail = currentUser.email;
      const friendsQuery = query(collection(db, 'friends'), where('owner_email', '==', myEmail));
      const friendsSnapshot = await getDocs(friendsQuery);
      const allRecords = friendsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Accepted friends: I am owner or friend_email, status=accepted
      const accepted = allRecords.filter(r =>
        r.status === 'accepted' && (r.owner_email === myEmail || r.friend_email === myEmail)
      );
      // Deduplicate by pair
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
        toast.error(exists.status === 'accepted' ? 'Đã là bạn bè rồi!' : 'Đã gửi lời mời rồi!');
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
    const q = query(collection(db, 'friends'), where('owner_email', '==', currentUser.email));
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const toDelete = records.filter(r => (
      (r.owner_email === currentUser.email && r.friend_email === friendEmail) ||
      (r.owner_email === friendEmail && r.friend_email === currentUser.email)
    ));

    await Promise.all(toDelete.map(r => deleteDoc(doc(db, 'friends', r.id))));
  };

  const handleDelete = async (record) => {
    try {
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
    return {
      email: otherEmail,
      displayName: record.nickname || (otherEmail ? otherEmail.split('@')[0] : 'Ẩn danh'),
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
        className="absolute top-0 left-0 h-full w-80 max-w-[85%] z-50 liquid-glass-heavy border-r border-border shadow-2xl flex flex-col"
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
                    return (
                      <div key={r.id} className="liquid-glass liquid-glass-interactive rounded-2xl p-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {f.displayName[0]?.toUpperCase()}
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
                              <p className="font-medium text-sm truncate">{f.displayName}</p>
                            )}
                            <p className="text-xs text-muted-foreground truncate">{f.email}</p>
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