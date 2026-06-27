import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { db } from '../../firebase';
import { collection, addDoc, query, onSnapshot, where, or, and, doc, setDoc, updateDoc, FieldPath, writeBatch } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import MessageBubble from '@/components/ui/MessageBubble';
import ChatInput from '@/components/ui/ChatInput';

export default function ChatWindow({ friend, currentUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
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

    return () => {
      unsubscribe();
      unsubTyping();
    };
  }, [friend.friend_email, currentUser.email, channelId]);

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
          senderName: replyTo.sender_email === currentUser.email ? 'Bạn' : (friend.nickname || friend.friend_email.split('@')[0])
        };
      }

      await addDoc(collection(db, 'messages'), msgData);
      setReplyTo(null);
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

  const handleReact = async (messageId, emoji) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), 
        new FieldPath('reactions', currentUser.email), emoji
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
    setReplyTo(msg);
  };

  const displayName = friend.nickname || friend.friend_email.split('@')[0];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <button onClick={onBack} className="p-1 rounded-full hover:bg-secondary transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold">
          {displayName[0]?.toUpperCase()}
        </div>
        <span className="font-semibold text-sm">{displayName}</span>
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

          return (
            <MessageBubble 
              key={m.id} 
              message={m} 
              isMe={isMe} 
              onReact={handleReact}
              onUnsend={handleUnsend}
              onReply={handleReply}
              isFirst={isFirst}
              isLast={isLast}
              onScrollToReplied={handleScrollToMessage}
              showAvatar={showAvatar}
              senderName={!isMe ? displayName : undefined}
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