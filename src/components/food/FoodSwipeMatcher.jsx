import { useState, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Heart, X, RefreshCw, MapPin, ShoppingCart } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/* ─── Swipe Card Sub-component ────────────────────────── */
function SwipeCard({ food, onSwipeLeft, onSwipeRight }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0.5, 0.8, 1, 0.8, 0.5]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const dislikeOpacity = useTransform(x, [-80, 0], [1, 0]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 120) {
      onSwipeRight(food);
    } else if (info.offset.x < -120) {
      onSwipeLeft(food);
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.03 }}
      className="absolute inset-0 w-full h-full bg-card border border-border rounded-3xl shadow-xl flex flex-col overflow-hidden cursor-grab active:cursor-grabbing select-none"
    >
      {/* Overlay indicators */}
      <motion.div 
        style={{ opacity: likeOpacity }} 
        className="absolute top-6 left-6 border-4 border-emerald-500 text-emerald-500 font-display text-2xl font-bold px-4 py-1 rounded-xl uppercase tracking-wider rotate-[-12deg] pointer-events-none z-10"
      >
        THÍCH ❤️
      </motion.div>
      <motion.div 
        style={{ opacity: dislikeOpacity }} 
        className="absolute top-6 right-6 border-4 border-rose-500 text-rose-500 font-display text-2xl font-bold px-4 py-1 rounded-xl uppercase tracking-wider rotate-[12deg] pointer-events-none z-10"
      >
        BỎ QUA ❌
      </motion.div>

      {/* Image or fallback */}
      <div className="w-full flex-1 relative bg-secondary overflow-hidden">
        {food.anh ? (
          <img src={food.anh} alt={food.ten_mon} className="w-full h-full object-cover pointer-events-none" />
        ) : (
          <div className="w-full h-full gradient-rose flex items-center justify-center text-7xl select-none">
            🍜
          </div>
        )}
      </div>

      {/* Food Details */}
      <div className="p-5 space-y-2 bg-card relative z-0">
        <h3 className="font-display text-xl font-bold text-foreground leading-snug truncate">{food.ten_mon}</h3>
        
        {food.dia_chi && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={12} className="text-primary flex-shrink-0" />
            <span className="truncate">{food.dia_chi}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1 pt-1">
          {[food.nhiet_do, food.loai_no, food.kieu_an, food.quoc_tich, food.khoang_cach, food.ngan_sach]
            .filter(Boolean)
            .map(tag => (
              <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {tag}
              </span>
            ))
          }
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main FoodSwipeMatcher Component ─────────────────── */
export default function FoodSwipeMatcher({ foods, currentUser, onRefresh }) {
  const [matchFood, setMatchFood] = useState(null);
  const [isResetting, setIsResetting] = useState(false);

  // Lọc các món mà người dùng hiện tại chưa quẹt và món chưa chốt đơn
  const activeFoods = useMemo(() => {
    return foods.filter(food => {
      if (food.chot_don) return false;
      const swipes = food.swipes || {};
      return !swipes[currentUser?.uid];
    });
  }, [foods, currentUser]);

  // Lấy món trên cùng của stack
  const currentCard = activeFoods[0];

  // Danh sách các món mà cả 2 người cùng thích (Match)
  const matches = useMemo(() => {
    return foods.filter(food => {
      const swipes = food.swipes || {};
      const likeUids = Object.keys(swipes).filter(uid => swipes[uid] === 'like');
      return likeUids.length >= 2;
    });
  }, [foods]);

  // Xử lý khi quẹt/chọn Thích hoặc Bỏ qua
  const handleSwipe = async (food, direction) => {
    if (!currentUser || !food) return;

    try {
      const foodRef = doc(db, 'foods', food.id);
      
      // Cập nhật lượt quẹt lên Firestore
      await updateDoc(foodRef, {
        [`swipes.${currentUser.uid}`]: direction
      });

      // Nếu quẹt thích, kiểm tra xem đối phương có thích món này trước đó không
      if (direction === 'like') {
        const otherSwipes = food.swipes || {};
        const otherUids = Object.keys(otherSwipes).filter(uid => uid !== currentUser.uid && otherSwipes[uid] === 'like');
        
        if (otherUids.length > 0) {
          // Trùng khớp!
          setMatchFood(food);
          triggerConfetti();
        }
      }
      
      onRefresh?.();
    } catch (error) {
      console.error('Lỗi khi lưu quẹt:', error);
      toast.error('Lỗi kết nối mạng!');
    }
  };

  // Hiệu ứng pháo hoa khi Match
  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  // Chốt đơn món trùng khớp
  const handleChotDon = async (food) => {
    try {
      const foodRef = doc(db, 'foods', food.id);
      await updateDoc(foodRef, { chot_don: true });
      toast.success(`🍜 Đã chốt đơn: ${food.ten_mon}!`);
      setMatchFood(null);
      onRefresh?.();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi chốt đơn!');
    }
  };

  // Làm mới tất cả lượt quẹt để chơi lại
  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      const promises = foods.map(food => {
        const foodRef = doc(db, 'foods', food.id);
        return updateDoc(foodRef, {
          swipes: {},
          chot_don: false
        });
      });
      await Promise.all(promises);
      toast.success('🎯 Đã bắt đầu lượt quẹt mới!');
      onRefresh?.();
    } catch (error) {
      console.error(error);
      toast.error('Không thể làm mới trò chơi!');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Swipe Arena */}
      <div className="relative w-full max-w-xs mx-auto aspect-[3/4] flex items-center justify-center">
        <AnimatePresence>
          {currentCard ? (
            <div className="absolute inset-0 w-full h-full" key={currentCard.id}>
              <SwipeCard 
                food={currentCard} 
                onSwipeLeft={(f) => handleSwipe(f, 'dislike')}
                onSwipeRight={(f) => handleSwipe(f, 'like')}
              />
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="text-center p-6 space-y-4 bg-card border border-border rounded-3xl shadow-sm flex flex-col items-center justify-center w-full h-full"
            >
              <div className="text-5xl">😴</div>
              <div className="space-y-1">
                <p className="font-semibold text-base">Hết món quẹt rồi!</p>
                <p className="text-xs text-muted-foreground px-4">Đợi đối phương quẹt nốt hoặc thêm món ăn mới nhé.</p>
              </div>
              <Button onClick={handleReset} variant="outline" className="rounded-xl flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <RefreshCw size={13} className={cn(isResetting && "animate-spin")} /> Chơi lại từ đầu
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Action Buttons */}
      {currentCard && (
        <div className="flex justify-center gap-6">
          <button 
            onClick={() => handleSwipe(currentCard, 'dislike')}
            className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-md hover:scale-110 active:scale-95 transition-all"
          >
            <X size={26} />
          </button>
          <button 
            onClick={() => handleSwipe(currentCard, 'like')}
            className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shadow-md hover:scale-110 active:scale-95 transition-all"
          >
            <Heart size={26} fill="currentColor" />
          </button>
        </div>
      )}

      {/* Matches List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            🔥 Món đã trùng khớp ({matches.length})
          </p>
          {matches.length > 0 && (
            <button 
              onClick={handleReset} 
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={11} className={cn(isResetting && "animate-spin")} /> Làm mới
            </button>
          )}
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border rounded-2xl text-xs text-muted-foreground">
            Chưa có món trùng khớp. Cùng quẹt thích để tạo match!
          </div>
        ) : (
          <div className="grid gap-2">
            {matches.map(food => (
              <div key={food.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
                {food.anh ? (
                  <img src={food.anh} alt={food.ten_mon} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl gradient-rose flex items-center justify-center flex-shrink-0 text-xl">🍜</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{food.ten_mon}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{food.dia_chi || 'Không có địa chỉ'}</p>
                </div>
                <Button 
                  onClick={() => handleChotDon(food)}
                  className="gradient-primary text-white border-0 text-xs py-1 h-8 rounded-xl flex items-center gap-1"
                >
                  <ShoppingCart size={12} /> Chốt
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match Dialog */}
      <Dialog open={!!matchFood} onOpenChange={() => setMatchFood(null)}>
        <DialogContent className="max-w-xs rounded-3xl p-6 text-center border-0 bg-gradient-to-b from-[#FFF0F5] to-background">
          <div className="space-y-4">
            <div className="text-5xl animate-bounce">🎉</div>
            <div className="space-y-1">
              <h3 className="font-display text-xl font-bold text-primary">Ngon rồi! Trùng khớp!</h3>
              <p className="text-xs text-muted-foreground">Cả hai đều muốn thưởng thức:</p>
            </div>
            
            <div className="p-3 bg-card border border-primary/20 rounded-2xl shadow-sm space-y-2">
              {matchFood?.anh ? (
                <img src={matchFood.anh} alt={matchFood.ten_mon} className="w-full h-28 rounded-xl object-cover" />
              ) : (
                <div className="w-full h-24 gradient-rose flex items-center justify-center text-4xl rounded-xl">🍜</div>
              )}
              <p className="font-semibold text-sm">{matchFood?.ten_mon}</p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => handleChotDon(matchFood)} className="w-full gradient-primary text-white border-0 rounded-xl">
                Chốt món này luôn!
              </Button>
              <Button variant="outline" onClick={() => setMatchFood(null)} className="w-full rounded-xl text-xs text-muted-foreground">
                Quẹt tiếp để xem thêm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
