import { GRADIENTS } from '@/config/constants';
import { cn } from '@/lib/utils';
import {
  File, Users, User, GraduationCap, Heart, Coffee, Music, Code, Camera, Sparkles, Gamepad2,
  Briefcase, Building, ShieldCheck, BadgeCheck, Globe, Laptop,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ width?: number | string; height?: number | string; className?: string }>> = {
  file: File,
  users: Users,
  user: User,
  graduation: GraduationCap,
  heart: Heart,
  coffee: Coffee,
  music: Music,
  code: Code,
  camera: Camera,
  sparkles: Sparkles,
  gamepad: Gamepad2,
  briefcase: Briefcase,
  building: Building,
  shield: ShieldCheck,
  badge: BadgeCheck,
  globe: Globe,
  laptop: Laptop,
};

export function TirakLogo({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="Tirak Chat">
      <rect width="64" height="64" rx="16" fill="#1A2648" />
      <path
        d="M 32,12 C 41.94,12 50,20.06 50,30 C 50,39.94 41.94,48 32,48 C 28.2,48 24.7,46.8 21.8,44.8 L 13.5,47.5 C 12.6,47.8 11.7,46.9 12,46 L 14.7,37.7 C 14.2,35.3 14,32.7 14,30 C 14,20.06 22.06,12 32,12 Z"
        fill="none"
        stroke="#FF686B"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 32,24.5 C 32,24.5 29.5,19.5 25,19.5 C 21,19.5 18,22.5 18,27 C 18,31.5 24.5,37 32,41.5 C 39.5,37 46,31.5 46,27 C 46,22.5 43,19.5 39,19.5 C 34.5,19.5 32,24.5 32,24.5 Z"
        fill="none"
        stroke="#FF686B"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getMonogram(name: string): string {
  if (!name || !name.trim()) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /^[a-zA-Z]+$/.test(parts[0]) && /^[a-zA-Z]+$/.test(parts[1])) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return name.trim().charAt(0).toUpperCase();
}

interface AvatarProps {
  name: string;
  colorKey?: string;
  emoji?: string;
  avatarUrl?: string;
  size?: number;
  online?: boolean;
  showStatus?: boolean;
  ring?: boolean;
  className?: string;
}

export function Avatar({ name, colorKey = 'navy', emoji, avatarUrl, size = 48, online, showStatus, ring, className }: AvatarProps) {
  const monogram = getMonogram(name);
  const IconComponent = emoji && ICON_MAP[emoji] ? ICON_MAP[emoji] : null;

  return (
    <div className={cn('relative shrink-0 rounded-full select-none outline-none overflow-hidden', className)} style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className={cn(
            'h-full w-full rounded-full object-cover select-none shadow-sm',
            ring && 'ring-2 ring-offset-2 ring-[hsl(var(--coral))] ring-offset-background',
          )}
        />
      ) : (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center rounded-full font-display font-semibold text-white select-none shadow-sm overflow-hidden',
            ring && 'ring-2 ring-offset-2 ring-[hsl(var(--coral))] ring-offset-background',
          )}
          style={{ background: GRADIENTS[colorKey] ?? GRADIENTS.navy, fontSize: size * 0.42 }}
        >
          {IconComponent ? (
            <IconComponent width={size * 0.52} height={size * 0.52} className="text-white" />
          ) : (
            <span>{monogram}</span>
          )}
        </div>
      )}
      {showStatus && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-background shadow-xs z-10',
            online ? 'bg-online' : 'bg-muted-foreground/50',
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
