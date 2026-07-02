import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Image as ImageIcon, X, Mic } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import { toast } from 'sonner';

export default function ChatInput({ 
  onSend, 
  onTyping, 
  isTyping, 
  placeholder = 'Nhắn gì đó...', 
  disabled = false,
  typingName = 'Ai đó',
  replyTo,
  onCancelReply
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Clear typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleChange = (e) => {
    setText(e.target.value);
    
    // Typing indicator logic
    if (onTyping && !disabled) {
      if (!typingTimeoutRef.current) {
        // First keystroke
        onTyping(true);
      } else {
        // Clear previous timeout if user is still typing
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to set typing to false after 2s of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
        typingTimeoutRef.current = null;
      }, 2000);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || disabled || sending) return;
    setSending(true);
    
    // Immediately stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (onTyping) onTyping(false);

    try {
      await onSend(text.trim());
      setText('');
      // Keep focus on input after sending for fast typing
      setTimeout(() => inputRef.current?.focus(), 10);
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error("Video quá lớn! Vui lòng chọn video dưới 25MB.");
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSending(true);
      try {
        const fileName = `videos/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        await onSend('', null, url);
      } catch (error) {
        console.error("Lỗi upload video:", error);
        toast.error("Lỗi upload video!");
      } finally {
        setSending(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }

    setSending(true);
    try {
      const imageBitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;
      let width = imageBitmap.width;
      let height = imageBitmap.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageBitmap, 0, 0, width, height);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      
      const fileName = `images/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      await onSend('', url); 
    } catch (error) {
      console.error("Lỗi upload ảnh:", error);
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mp4;codecs=mp4a.40.2'];
      let options = {};
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          options.mimeType = t;
          break;
        }
      }
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      toast.error("Không thể truy cập microphone!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const mimeType = mediaRecorderRef.current.mimeType;
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        
        setSending(true);
        try {
          const fileName = `voice/${Date.now()}.${ext}`;
          const storageRef = ref(storage, fileName);
          await uploadBytes(storageRef, blob);
          const url = await getDownloadURL(storageRef);
          await onSend('', null, null, url);
        } catch (error) {
          console.error("Voice error:", error);
          toast.error("Lỗi gửi tin nhắn thoại!");
        } finally {
          setSending(false);
        }
        
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col flex-shrink-0">
      {/* Reply Preview */}
      {replyTo && (
        <div className="px-3 py-2 bg-secondary/30 border-t border-border flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-2 border-l-2 border-primary/50 pl-2">
            <span className="text-[10px] font-semibold opacity-80 block">Đang trả lời {replyTo.resolvedSenderName || replyTo.senderName}</span>
            <p className="text-xs truncate opacity-90">{replyTo.content}</p>
          </div>
          <button 
            onClick={onCancelReply}
            className="p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X size={14} className="opacity-70" />
          </button>
        </div>
      )}

      {/* Typing Indicator above input */}
      {isTyping && !replyTo && (
        <div className="px-4 py-1 text-[10px] text-muted-foreground flex items-center gap-1 italic animate-pulse">
          {typingName} đang nhập
          <span className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      )}

      {/* Input Form */}
      <div className="px-3 py-3 flex gap-2 flex-shrink-0 bg-white/5 border-t border-white/10 rounded-none items-center">
        <input 
          type="file" 
          accept="image/*,video/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileSelect} 
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending || isRecording}
          className="p-2 rounded-xl hover:bg-black/5 text-muted-foreground transition-colors disabled:opacity-50"
        >
          <ImageIcon size={20} />
        </button>

        {isRecording ? (
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-destructive font-medium flex items-center justify-center animate-pulse">
            Đang ghi âm... Thả ra để gửi
          </div>
        ) : (
          <input
            ref={inputRef}
            value={text}
            onChange={handleChange}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground disabled:opacity-50 transition-all"
          />
        )}
        
        {!text.trim() ? (
          <button
            onPointerDown={(e) => { e.preventDefault(); startRecording(); }}
            onPointerUp={(e) => { e.preventDefault(); stopRecording(); }}
            onPointerLeave={(e) => { e.preventDefault(); stopRecording(); }}
            disabled={disabled || sending}
            className="w-9 h-9 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0 hover:bg-secondary/80 transition-colors"
          >
            <Mic size={14} className={isRecording ? "text-destructive animate-pulse" : ""} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || sending}
            className="w-9 h-9 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0 hover:opacity-90 transition-opacity"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
