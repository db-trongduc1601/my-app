import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { timeAgo } from '@/lib/timeAgo';
import { cn } from '@/lib/utils';

export default function ChatWindow({ friend, currentUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef();

  const roomEmails = [currentUser.email, friend.friend_email].sort();

  const loadMessages = async () => {
    const all = await base44.entities.Message.list('created_date', 100);
    const filtered = all.filter(m =>
      (m.sender_email === currentUser.email && m.receiver_email === friend.friend_email) ||
      (m.sender_email === friend.friend_email && m.receiver_email === currentUser.email)
    );
    setMessages(filtered);
  };

  useEffect(() => {
    loadMessages();
    // Real-time subscription
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.type === 'create') {
        const m = event.data;
        if (
          (m.sender_email === currentUser.email && m.receiver_email === friend.friend_email) ||
          (m.sender_email === friend.friend_email && m.receiver_email === currentUser.email)
        ) {
          setMessages(prev => [...prev, m]);
        }
      }
    });
    return unsub;
  }, [friend.friend_email]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender_email: currentUser.email,
      receiver_email: friend.friend_email,
      content: text.trim(),
      created_date: new Date().toISOString(),
      _pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setText('');
    await base44.entities.Message.create({
      sender_email: currentUser.email,
      receiver_email: friend.friend_email,
      content: optimistic.content,
    });
    setSending(false);
  };

  const displayName = friend.nickname || friend.friend_email.split('@')[0];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="p-1 rounded-full hover:bg-secondary transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold">
          {displayName[0]?.toUpperCase()}
        </div>
        <span className="font-semibold text-sm">{displayName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.map(m => {
          const isMe = m.sender_email === currentUser.email;
          return (
            <div key={m.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[75%] px-3 py-2 rounded-2xl text-sm',
                isMe
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-secondary text-foreground rounded-bl-sm',
                m._pending && 'opacity-60'
              )}>
                <p>{m.content}</p>
                <p className={cn('text-[10px] mt-0.5', isMe ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                  {timeAgo(m.created_date)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border flex gap-2">
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Nhắn gì đó..."
          className="rounded-xl text-sm"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 flex-shrink-0"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}