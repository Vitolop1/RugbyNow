"use client";

import { getBroadcastLogo, type BroadcastProvider } from "@/lib/broadcasts";

type Props = {
  provider: BroadcastProvider;
  compact?: boolean;
};

export default function BroadcastPill({ provider, compact = false }: Props) {
  const content = (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white/90 ${
        compact ? "text-[10px]" : "text-xs"
      }`}
    >
      <img
        src={getBroadcastLogo(provider.id)}
        alt={provider.label}
        className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0 rounded-sm object-contain`}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
      <span className="font-semibold">{provider.label}</span>
    </span>
  );

  if (!provider.href) return content;

  return (
    <a href={provider.href} target="_blank" rel="noreferrer" className="hover:opacity-90">
      {content}
    </a>
  );
}
