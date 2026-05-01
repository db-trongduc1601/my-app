import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import VaultList from '@/components/vault/VaultList';
import { Heart } from 'lucide-react';

export default function Vault() {
  const { data: items = [], refetch } = useQuery({
    queryKey: ['vault'],
    queryFn: () => base44.entities.QuynhVault.list('phan_loai')
  });

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="font-display text-2xl font-semibold">Quỳnh ơi mình mua gì thế</h1>
          <Heart size={20} className="text-primary" fill="currentColor" />
        </div>
        <p className="text-xs text-muted-foreground">muốn gì thì ghi vô đâyy</p>
      </div>

      <VaultList items={items} onRefresh={refetch} />
    </div>);

}