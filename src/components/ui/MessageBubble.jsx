import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/timeAgo';

const EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🙏'];

const MessageBubbleComponent = ({ 
  message, 
  isMe, 
  senderName, 
  showAvatar,
  avatarUrl,
  avatarColor,
  onReply,
  onUnsend,
  onReact,
  isFirst = true,
  isLast = true,
  onScrollToReplied
}) => {
  const [showActions, setShowActions] = useState(false);

  // Group reactions for display
  const reactorEmails = message.reactions ? Object.keys(message.reactions) : [];
  const uniqueReactions = message.reactions ? [...new Set(Object.values(message.reactions))] : [];
  const handleReact = (emoji) => {
    if (onReact) onReact(message.id, emoji);
    setShowActions(false);
  };

  return (
    <div id={`msg-${message.id}`} className={cn('flex gap-2 items-end w-full group', isMe ? 'justify-end' : 'justify-start', isFirst ? 'mt-3' : 'mt-[2px]')}>
      {/* Avatar for others */}
      {!isMe && showAvatar !== undefined && (
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-0.5 overflow-hidden', 
          avatarColor || 'bg-secondary',
          !showAvatar && 'opacity-0'
        )}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            senderName?.[0]?.toUpperCase() || '?'
          )}
        </div>
      )}

      <div className={cn('flex flex-col max-w-[75%]', isMe && 'items-end')}>
        {/* Sender name above bubble */}
        {senderName && isFirst && showAvatar !== undefined && (
          <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
            {isMe ? 'Bạn' : senderName}
          </span>
        )}

        {/* Message Content */}
        <div className={cn("relative", reactorEmails.length > 0 && "mb-3.5")}>
          {/* Reaction Picker Popup */}
          <AnimatePresence>
            {showActions && !message.isDeleted && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn('absolute z-50 flex gap-1 p-1.5 liquid-glass-heavy rim-light rounded-full shadow-xl -top-12', 
                  isMe ? 'right-0' : 'left-0')}
              >
                {EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="w-8 h-8 rounded-full hover:bg-white/20 hover:scale-110 transition-all flex items-center justify-center text-lg"
                  >
                    {emoji}
                  </button>
                ))}
                {(!isMe || isMe) && (
                  <button
                    onClick={() => {
                      if (onReply) onReply(message);
                      setShowActions(false);
                    }}
                    className="w-8 h-8 rounded-full hover:bg-white/20 hover:scale-110 transition-all flex items-center justify-center text-lg"
                    title="Trả lời"
                  >
                    ↩️
                  </button>
                )}
                {isMe && (
                  <button
                    onClick={() => {
                      if (onUnsend) onUnsend(message.id);
                      setShowActions(false);
                    }}
                    className="w-8 h-8 rounded-full hover:bg-red-500/20 text-destructive hover:scale-110 transition-all flex items-center justify-center text-lg"
                    title="Thu hồi tin nhắn"
                  >
                    🗑️
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clickable Bubble */}
          <div 
            onClick={() => setShowActions(!showActions)}
            className={cn(
              'px-4 py-2.5 text-[15px] break-words relative cursor-pointer active:scale-95 transition-transform',
              isMe ? 'gradient-primary text-primary-foreground shadow-sm rounded-l-2xl' : 'bg-secondary text-secondary-foreground shadow-sm rounded-r-2xl border border-black/5 dark:border-white/5',
              isMe ? (
                cn(
                  isFirst ? 'rounded-tr-2xl' : 'rounded-tr-md',
                  isLast ? 'rounded-br-2xl' : 'rounded-br-md'
                )
              ) : (
                cn(
                  isFirst ? 'rounded-tl-2xl' : 'rounded-tl-md',
                  isLast ? 'rounded-bl-2xl' : 'rounded-bl-md'
                )
              ),
              message._pending && 'opacity-60',
              message.isDeleted && 'italic opacity-70 bg-secondary/50 text-muted-foreground gradient-none border-none shadow-none cursor-default active:scale-100 rounded-2xl'
            )}
          >
            {message.isDeleted ? (
              <span className="text-xs">Tin nhắn đã bị thu hồi</span>
            ) : (
              <>
                {message.replyTo && (
                  <div 
                    onClick={(e) => { e.stopPropagation(); onScrollToReplied && onScrollToReplied(message.replyTo.id); }}
                    className="text-xs bg-black/10 rounded p-1.5 mb-1 border-l-2 border-primary/50 text-left cursor-pointer hover:bg-black/20 transition-colors"
                  >
                    <span className="font-semibold block text-[10px] opacity-80">{message.replyTo.senderName}</span>
                    <p className="truncate max-w-[150px] sm:max-w-[200px] text-xs opacity-90">{message.replyTo.content || '[Hình ảnh]'}</p>
                  </div>
                )}
                {message.imageUrl && (
                  <img 
                    src={message.imageUrl} 
                    alt="attachment" 
                    className="max-w-full rounded-lg mb-1 object-cover max-h-[300px]" 
                  />
                )}
                {message.content && <span className="block">{message.content}</span>}
              </>
            )}
          </div>

          {/* Display Reactions */}
          {reactorEmails.length > 0 && !message.isDeleted && (
            <div className={cn(
              "absolute -bottom-4 flex items-center gap-0.5 bg-secondary px-1.5 py-0.5 rounded-full shadow-sm z-10 border-[3px] border-background",
              isMe ? "right-2" : "left-2"
            )}>
              <div className="flex gap-0.5 items-center">
                 {uniqueReactions.slice(0, 3).map((emoji, idx) => (
                   <span key={idx} className="text-[10px]">{emoji}</span>
                 ))}
              </div>
              {reactorEmails.length > 1 && <span className="font-medium text-[9px] px-0.5">{reactorEmails.length}</span>}
              <div className="flex -space-x-1 ml-0.5">
                 {reactorEmails.slice(0, 3).map((email, idx) => (
                   <div key={idx} className="w-3.5 h-3.5 rounded-full bg-secondary flex items-center justify-center text-[7px] font-bold text-white border border-background z-20">
                     {email.split('@')[0][0].toUpperCase()}
                   </div>
                 ))}
              </div>
            </div>
          )}
        </div>

        {/* Time & Status */}
        {isLast && (
          <div className="flex items-center gap-1 mt-0.5 px-1">
            <span className={cn('text-[10px]', isMe ? 'text-primary/70' : 'text-muted-foreground')}>
              {timeAgo(message.created_date)}
            </span>
            {isMe && !message.isDeleted && (
              <span className="text-[10px] text-primary/70">
                {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(MessageBubbleComponent, (prev, next) => {
  return (
    prev.isFirst === next.isFirst &&
    prev.isLast === next.isLast &&
    prev.isMe === next.isMe &&
    prev.showAvatar === next.showAvatar &&
    prev.avatarColor === next.avatarColor &&
    prev.senderName === next.senderName &&
    JSON.stringify(prev.message) === JSON.stringify(next.message)
  );
});
