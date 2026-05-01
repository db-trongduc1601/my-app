import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Send, Loader2, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { timeAgo } from '@/lib/timeAgo';
import { cn } from '@/lib/utils';

export default function GlobalChat({ open, onClose, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [tick, setTick] = useState(0);
  const bottomRef = useRef();
  const inputRef = useRef();

  // re-render timestamps every second
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const loadMessages = async () => {
    const all = await base44.entities.Message.list('created_date', 100);
    // Global chat: messages where receiver_email === 'global'
    setMessages(all.filter(m => m.receiver_email === 'global'));
  };

  useEffect(() => {
    if (!open) return;
    loadMessages();
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.type === 'create' && event.data.receiver_email === 'global') {
        setMessages(prev => {
          // Skip if we already have this real id (replaced optimistic) or a tmp with same content
          if (prev.some(m => m.id === event.data.id)) return prev;
          return [...prev, event.data];
        });
      }
    });
    return unsub;
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const handleSend = async () => {
    if (!text.trim() || !currentUser) return;
    setSending(true);
    const tmpId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tmpId,
      sender_email: currentUser.email,
      receiver_email: 'global',
      content: text.trim(),
      created_date: new Date().toISOString(),
      _pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    const t = text.trim();
    setText('');
    inputRef.current?.focus();
    const created = await base44.entities.Message.create({
      sender_email: currentUser.email,
      receiver_email: 'global',
      content: t,
    });
    // Replace optimistic with real record (avoids duplicate from subscription)
    setMessages(prev => prev.map(m => m.id === tmpId ? { ...created } : m));
    setSending(false);
  };

  const getDisplayName = (email) => email?.split('@')[0] || 'Ẩn danh';
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
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 left-0 h-full w-80 max-w-[88vw] z-50 bg-background border-r border-border shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
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
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
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
            const showAvatar = !isMe && (prevMsg?.sender_email !== m.sender_email);

            return (
              <div key={m.id} className={cn('flex gap-2 items-end', isMe ? 'justify-end' : 'justify-start')}>
                {/* Avatar for others */}
                {!isMe && (
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-0.5', color,
                    !showAvatar && 'opacity-0')}>
                    {name[0]?.toUpperCase()}
                  </div>
                )}

                <div className={cn('flex flex-col max-w-[72%]', isMe && 'items-end')}>
                  {/* Always show sender name above bubble */}
                  <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                    {isMe ? 'Bạn' : name}
                  </span>
                  <div className={cn(
                    'px-3 py-2 rounded-2xl text-sm break-words',
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-secondary text-foreground rounded-bl-sm',
                    m._pending && 'opacity-60'
                  )}>
                    {m.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                    {timeAgo(m.created_date)}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-border flex gap-2 flex-shrink-0 bg-card/80 backdrop-blur-sm">
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={currentUser ? 'Nhắn gì đó...' : 'Đăng nhập để nhắn tin'}
            disabled={!currentUser}
            className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || !currentUser || sending}
            className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0 hover:opacity-90 transition-opacity"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </motion.div>
    </>
  );
}