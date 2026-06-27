import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { db } from '../../firebase';
import { collection, addDoc, query, onSnapshot, where, or, and, doc, setDoc, updateDoc, FieldPath, writeBatch, deleteField } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import MessageBubble from '@/components/ui/MessageBubble';
import ChatInput from '@/components/ui/ChatInput';

export default function ChatWindow({ friend, currentUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [friendPresence, setFriendPresence] = useState(null);
  const [now, setNow] = useState(Date.now());
  const bottomRef = useRef();
  const prevMessagesLengthRef = useRef(0);
  
  const channelId = [currentUser.email, friend.friend_email].sort().join('_');

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      or(
        and(
          where('sender_email', '==', currentUser.email),
          where('receiver_email', '==', friend.friend_email)
        ),
        and(
          where('sender_email', '==', friend.friend_email),
          where('receiver_email', '==', currentUser.email)
        )
      )
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = msgs.sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
      setMessages(sorted.slice(-100));
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      toast.error("Không thể tải tin nhắn. Hãy mở Console kiểm tra xem có thiếu index không nhé!");
    });

    const qTyping = query(collection(db, 'typing_status'), where('channelId', '==', channelId), where('userEmail', '==', friend.friend_email));
    const unsubTyping = onSnapshot(qTyping, (snapshot) => {
      const typingDoc = snapshot.docs[0]?.data();
      setIsFriendTyping(!!typingDoc?.isTyping);
    });

    const qPresence = query(collection(db, 'user_profiles'), where('email', '==', friend.friend_email));
    const unsubPresence = onSnapshot(qPresence, (snapshot) => {
      setFriendPresence(snapshot.docs[0]?.data() || null);
    });

    return () => {
      unsubscribe();
      unsubTyping();
      unsubPresence();
    };
  }, [friend.friend_email, currentUser.email, channelId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(interval);
  }, []);

  // Mark unread messages as read (Optimized with Batch)
  useEffect(() => {
    const unreadMessages = messages.filter(m => m.receiver_email === currentUser.email && m.status !== 'read');
    if (unreadMessages.length === 0) return;

    const markAsRead = async () => {
      try {
        const batch = writeBatch(db);
        unreadMessages.forEach(m => {
          const msgRef = doc(db, 'messages', m.id);
          batch.update(msgRef, { status: 'read' });
        });
        await batch.commit();
      } catch (e) {
        console.error("Lỗi update batch status:", e);
      }
    };
    
    markAsRead();
  }, [messages, currentUser.email]);

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  const handleScrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-primary/20', 'transition-colors', 'duration-500');
      setTimeout(() => el.classList.remove('bg-primary/20'), 1500);
    }
  };

  const handleSend = async (textContent) => {
    try {
      const msgData = {
        sender_email: currentUser.email,
        receiver_email: friend.friend_email,
        content: textContent,
        created_date: new Date().toISOString(),
        status: 'sent'
      };

      if (replyTo) {
        msgData.replyTo = {
          id: replyTo.id,
          content: replyTo.content,
          senderName: replyTo.sender_email === currentUser.email ? 'Bạn' : (friend.nickname || friend.friend_email.split('@')[0]),
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
          receiverEmail: friend.friend_email || friend.email,
          content: textContent
        })
      })
      .then(r => r.json())
      .then(data => console.log("sendNotification response:", data))
      .catch(err => console.error("Lỗi gửi thông báo HTTP:", err));
    } catch (error) {
      console.error(error);
    }
  };

  const updateTypingStatus = async (isTyping) => {
    try {
      await setDoc(doc(db, 'typing_status', `${channelId}_${currentUser.email}`), {
        channelId,
        userEmail: currentUser.email,
        name: currentUser.displayName?.split(' ')[0] || 'Ai đó',
        isTyping,
        updatedAt: new Date().toISOString()
      });
    } catch (e) { }
  };

  const handleReact = async (message, emoji) => {
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
      resolvedSenderName: msg.sender_email === currentUser?.email ? 'Bạn' : (friend.nickname || friend.friend_email.split('@')[0])
    });
  };

  const displayName = friendPresence?.display_name || friend.nickname || friend.friend_email.split('@')[0];
  
  let isOnline = false;
  let lastActiveText = "Chat riêng tư";
  if (friendPresence?.last_active?.toMillis) {
    const lastActiveMs = friendPresence.last_active.toMillis();
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 liquid-glass rim-light flex-shrink-0">
        <button onClick={onBack} className="p-1 rounded-full hover:bg-secondary transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="relative w-8 h-8 flex-shrink-0">
          {friendPresence?.photo_url ? (
            <img src={friendPresence.photo_url} alt={displayName} className="w-full h-full rounded-full object-cover border border-white/20" />
          ) : (
            <div className="w-full h-full rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{displayName}</p>
          {isOnline ? (
            <p className="text-[11px] font-medium text-green-500">Đang hoạt động</p>
          ) : (
            <p className="text-[11px] text-muted-foreground truncate">{lastActiveText}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 flex flex-col">
        {messages.map((m, i) => {
          const isMe = m.sender_email === currentUser.email;
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

          const localProfiles = {
            [currentUser.email.toLowerCase()]: { photo_url: currentUser.photoURL || null, display_name: currentUser.displayName || currentUser.email.split('@')[0] },
            [friend.friend_email.toLowerCase()]: { photo_url: friendPresence?.photo_url || null, display_name: friendPresence?.display_name || friend.friend_email.split('@')[0] }
          };
          const localNicknames = {
            [friend.friend_email.toLowerCase()]: friend.nickname
          };

          return (
            <MessageBubble 
              key={m.id} 
              message={msgObj} 
              isMe={isMe} 
              onReact={handleReact}
              onUnsend={handleUnsend}
              onReply={handleReply}
              isFirst={isFirst}
              isLast={isLast}
              onScrollToReplied={handleScrollToMessage}
              showAvatar={showAvatar}
              senderName={!isMe ? displayName : undefined}
              avatarUrl={!isMe ? friendPresence?.photo_url : undefined}
              profiles={localProfiles}
              friendNicknames={localNicknames}
              currentUserEmail={currentUser.email}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      <ChatInput 
        onSend={handleSend} 
        onTyping={updateTypingStatus}
        isTyping={isFriendTyping}
        typingName={displayName}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        placeholder={`Nhắn cho ${displayName}...`} 
      />
    </div>
  );
}