import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const US_TIMEZONES = [
  { label: 'Springfield, MO', tz: 'America/Chicago' },
  { label: 'New York', tz: 'America/New_York' },
  { label: 'Los Angeles', tz: 'America/Los_Angeles' },
  { label: 'Chicago', tz: 'America/Chicago' },
  { label: 'Denver', tz: 'America/Denver' },
];

function ClockDisplay({ time, label, flag }) {
  return (
    <div className="flex-1 flex flex-col items-center py-3 px-2">
      <span className="text-2xl mb-1">{flag}</span>
      <span className="text-2xl font-display font-semibold text-foreground tabular-nums">{time}</span>
      <span className="text-xs text-muted-foreground mt-1 font-body">{label}</span>
    </div>
  );
}

export default function DualClock() {
  const [tick, setTick] = useState(0);
  const [usCity, setUsCity] = useState({ label: 'Springfield, MO', tz: 'America/Chicago' });
  const [customLabel, setCustomLabel] = useState('Springfield, MO');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const format = (tz) =>
    new Date().toLocaleTimeString('vi-VN', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const vnTime = format('Asia/Ho_Chi_Minh');
  const usTime = format(usCity.tz);

  return (
    <div className="liquid-glass rim-light rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Đồng hồ</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="p-1 rounded-full liquid-glass-sm hover:liquid-glow transition-all">
              <Settings size={14} className="text-muted-foreground" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle>Chỉnh múi giờ Mỹ</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label className="text-sm">Chọn thành phố</Label>
              <div className="grid grid-cols-1 gap-2">
                {US_TIMEZONES.map(tz => (
                  <button
                    key={tz.tz}
                    onClick={() => { setUsCity(tz); setCustomLabel(tz.label); setOpen(false); }}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition-all ${usCity.tz === tz.tz ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-muted'}`}
                  >
                    {tz.label}
                  </button>
                ))}
              </div>
              <div className="pt-2 space-y-2">
                <Label className="text-sm">Hoặc nhập tên tuỳ chỉnh</Label>
                <Input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="Tên hiển thị..." />
                <Button size="sm" className="w-full gradient-primary text-white border-0" onClick={() => { setUsCity(c => ({...c, label: customLabel})); setOpen(false); }}>
                  Lưu
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex items-stretch">
        <ClockDisplay time={vnTime} label="Việt Nam" flag="🇻🇳" />
        <div className="w-px gradient-divider self-stretch my-3" />
        <ClockDisplay time={usTime} label={usCity.label} flag="🇺🇸" />
      </div>
    </div>
  );
}