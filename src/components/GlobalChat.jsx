import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, setDoc, updateDoc, FieldPath, deleteField, serverTimestamp } from 'firebase/firestore';
import { X, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import MessageBubble from '@/components/ui/MessageBubble';
import ChatInput from '@/components/ui/ChatInput';

export default function GlobalChat({ open, onClose, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [friendNicknames, setFriendNicknames] = useState({});
  const [tick, setTick] = useState(0);
  const bottomRef = useRef();
  const prevMessagesLengthRef = useRef(0);

  // re-render timestamps every minute to reduce lag
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const getMessageTime = (dateVal) => {
    if (!dateVal) return Date.now();
    if (typeof dateVal.toMillis === 'function') return dateVal.toMillis();
    if (dateVal.seconds !== undefined) return dateVal.seconds * 1000 + (dateVal.nanoseconds || 0) / 1000000;
    if (typeof dateVal === 'string') return new Date(dateVal).getTime();
    if (dateVal instanceof Date) return dateVal.getTime();
    return Date.now();
  };

  useEffect(() => {
    if (!open) return;

    const q = query(
      collection(db, 'messages'),
      where('receiver_email', '==', 'global')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => getMessageTime(a.created_date) - getMessageTime(b.created_date));
      
      setMessages(msgs.slice(-100)); // Keep last 100 messages
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
    });

    const qTyping = query(collection(db, 'typing_status'), where('channelId', '==', 'global'), where('isTyping', '==', true));
    const unsubTyping = onSnapshot(qTyping, (snapshot) => {
      const users = snapshot.docs.map(d => d.data()).filter(d => d.userEmail !== currentUser?.email);
      setTypingUsers(users);
    });

    const unsubProfiles = onSnapshot(collection(db, 'user_profiles'), (snap) => {
      const profs = {};
      snap.forEach(doc => {
        if (doc.data().email) {
          profs[doc.data().email.toLowerCase()] = doc.data();
        }
      });
      setProfiles(profs);
    });

    const unsubFriends1 = onSnapshot(query(collection(db, 'friends'), where('owner_email', '==', currentUser?.email || '')), snap => {
      const f = {};
      snap.forEach(doc => {
        if (doc.data().status === 'accepted') {
          f[doc.data().friend_email] = doc.data().nickname;
        }
      });
      setFriendNicknames(prev => ({ ...prev, ...f }));
    });
    
    const unsubFriends2 = onSnapshot(query(collection(db, 'friends'), where('friend_email', '==', currentUser?.email || '')), snap => {
      const f = {};
      snap.forEach(doc => {
        if (doc.data().status === 'accepted') {
          f[doc.data().owner_email] = doc.data().nickname;
        }
      });
      setFriendNicknames(prev => ({ ...prev, ...f }));
    });

    return () => {
      unsubscribe();
      unsubTyping();
      unsubProfiles();
      unsubFriends1();
      unsubFriends2();
    };
  }, [open, currentUser]);

  useEffect(() => {
    if (!open) return;
    if (messages.length > prevMessagesLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, open]);

  const handleScrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-primary/20', 'transition-colors', 'duration-500');
      setTimeout(() => el.classList.remove('bg-primary/20'), 1500);
    }
  };

  const getDisplayName = (email) => {
    if (!email) return 'Ẩn danh';
    const lower = email.toLowerCase();
    return profiles[lower]?.display_name || friendNicknames[lower] || email.split('@')[0];
  };

  const handleSend = async (textContent, imageUrl = null, videoUrl = null, voiceUrl = null) => {
    if (!currentUser) return;

    try {
      const msgData = {
        sender_email: currentUser.email,
        receiver_email: 'global',
        content: textContent,
        created_date: serverTimestamp(),
        ...(imageUrl && { imageUrl }),
        ...(videoUrl && { videoUrl }),
        ...(voiceUrl && { voiceUrl })
      };

      if (replyTo) {
        msgData.replyTo = {
          id: replyTo.id,
          content: replyTo.content,
          senderName: replyTo.sender_email === currentUser.email ? 'Bạn' : getDisplayName(replyTo.sender_email),
          sender_email: replyTo.sender_email
        };
      }

      await addDoc(collection(db, 'messages'), msgData);
      setReplyTo(null);

      // Gửi thông báo đẩy qua Cloud Function HTTPS
      fetch('/api/sendNotification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chat',
          senderEmail: currentUser.email,
          senderName: currentUser.displayName || currentUser.email.split('@')[0],
          receiverEmail: 'global',
          content: textContent
        })
      })
      .then(r => r.json())
      .then(data => console.log("sendNotification Global response:", data))
      .catch(err => console.error("Lỗi gửi thông báo HTTP:", err));
    } catch (error) {
      console.error(error);
    }
  };

  const updateTypingStatus = async (isTyping) => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'typing_status', `global_${currentUser.email}`), {
        channelId: 'global',
        userEmail: currentUser.email,
        name: currentUser.displayName?.split(' ')[0] || 'Ai đó',
        isTyping,
        updatedAt: new Date().toISOString()
      });
    } catch (e) { }
  };

  const handleReact = async (message, emoji) => {
    if (!currentUser) return;
    try {
      const lowerEmail = currentUser.email.toLowerCase();
      const isRemoving = message.reactions && message.reactions[lowerEmail] === emoji;
      await updateDoc(doc(db, 'messages', message.id), 
        new FieldPath('reactions', lowerEmail), isRemoving ? deleteField() : emoji
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnsend = async (messageId) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), {
        isDeleted: true
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleReply = (msg) => {
    setReplyTo({
      ...msg,
      resolvedSenderName: msg.sender_email === currentUser?.email ? 'Bạn' : getDisplayName(msg.sender_email)
    });
  };

  const typingName = typingUsers.length > 0 ? (typingUsers.length === 1 ? typingUsers[0].name : `${typingUsers.length} người`) : '';
  const isTyping = typingUsers.length > 0;

  const getColor = (email) => {
    if (!email) return 'bg-primary';
    const colors = ['bg-pink-400', 'bg-rose-400', 'bg-violet-400', 'bg-blue-400', 'bg-teal-400', 'bg-orange-400'];
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
    return colors[hash % colors.length];
  };

  if (!open) return null;

  return (
    <>
      <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[4px]" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute top-16 bottom-0 left-0 right-0 w-full z-50 liquid-glass-heavy rounded-t-3xl border-t border-white/10 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 liquid-glass rim-light flex-shrink-0 rounded-none">
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
            <MessageCircle size={15} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Chat chung 💬</p>
            <p className="text-xs text-muted-foreground">Tất cả mọi người</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 flex flex-col">
          {messages.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm">Chưa có tin nhắn nào</p>
              <p className="text-xs mt-1">Hãy là người đầu tiên nhắn!</p>
            </div>
          )}
          {messages.map((m, i) => {
            const isMe = m.sender_email === currentUser?.email;
            const name = getDisplayName(m.sender_email);
            const color = getColor(m.sender_email);
            const prevMsg = messages[i - 1];
            const nextMsg = messages[i + 1];
            
            const isFirst = prevMsg?.sender_email !== m.sender_email;
            const isLast = nextMsg?.sender_email !== m.sender_email;
            const showAvatar = !isMe && isLast;

            let msgObj = m;
            if (msgObj.replyTo && !msgObj.replyTo.sender_email) {
              const orig = messages.find(x => x.id === msgObj.replyTo.id);
              if (orig) {
                msgObj = { ...m, replyTo: { ...m.replyTo, sender_email: orig.sender_email } };
              }
            }

            return (
              <MessageBubble
                key={m.id}
                message={msgObj}
                isMe={isMe}
                senderName={!isMe ? name : undefined}
                showAvatar={showAvatar}
                avatarUrl={!isMe ? profiles[m.sender_email]?.photo_url : undefined}
                avatarColor={color}
                onReact={handleReact}
                onUnsend={handleUnsend}
                onReply={handleReply}
                isFirst={isFirst}
                isLast={isLast}
                onScrollToReplied={handleScrollToMessage}
                profiles={profiles}
                friendNicknames={friendNicknames}
                currentUserEmail={currentUser?.email}
              />
            );
          })}
          <div ref={bottomRef} />
        </div>

        <ChatInput 
          onSend={handleSend} 
          onTyping={updateTypingStatus}
          isTyping={isTyping}
          typingName={typingName}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          placeholder={currentUser ? 'Nhắn gì đó...' : 'Đăng nhập để nhắn tin'}
          disabled={!currentUser}
        />
      </motion.div>
    </>
  );
}