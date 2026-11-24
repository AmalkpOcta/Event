type UserAvatarProps = {
  name: string;
  email?: string;
  size?: number;
  className?: string;
};

function initialsFrom(name: string, email?: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts[0]?.length) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (email?.[0] || "?").toUpperCase();
}

/** Deterministic soft coral tones from a string seed (no external image host). */
function toneFromSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [340, 350, 355, 5, 15];
  const hue = hues[Math.abs(hash) % hues.length];
  return `hsl(${hue} 72% 42%)`;
}

export function UserAvatar({ name, email, size = 36, className = "" }: UserAvatarProps) {
  const initials = initialsFrom(name, email);
  const bg = toneFromSeed(email || name);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.34)),
        background: `linear-gradient(145deg, #f43f5e, ${bg})`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
