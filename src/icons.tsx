import type { CSSProperties } from "react";

const paths = {
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6m0-6-10 10" />
      <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5.1 8a7.5 7.5 0 0 1 12.4-3L20 8M4 16l2.5 3A7.5 7.5 0 0 0 19 16" />
    </>
  ),
  bookmark: <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4-6 4Z" />,
  fire: (
    <path d="M13 3c1 5-4 5-3 9 2 0 4-2 4-4 4 3 5 6 3 10-3 5-11 3-12-2-1-5 5-7 8-13Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v.1" />
    </>
  ),
  bars: (
    <>
      <path d="M5 20v-5m7 5V9m7 11V3" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  plug: (
    <>
      <path d="m8 3 4 4m4-4 4 4M7 8l3-3 9 9-3 3a5 5 0 0 1-7-7Zm2 9-5 5M5 6l13 13" />
    </>
  ),
  heart: <path d="M12 21 4 13C-3 6 7-2 12 6c5-8 15 0 8 7Z" />,
};

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: keyof typeof paths;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

export function Hand({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="64"
      height="72"
      viewBox="0 0 88 100"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M29 54V20c0-8 10-8 10 0v24-31c0-8 11-8 11 0v30-24c0-8 11-8 11 0v29-17c0-8 11-8 11 0v35c0 20-10 29-27 29-12 0-20-6-25-16L9 59c-5-8 3-14 9-8l11 12V54Z"
        fill="currentColor"
        stroke="#10130f"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M39 45v12m11-13v13m11-10v12M30 66c9-3 20 3 20 14"
        stroke="#10130f"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CoinAvatar({
  symbol,
  size = 42,
}: {
  symbol: string;
  size?: number;
}) {
  const known = [
    "PEPE",
    "WIF",
    "BONK",
    "DOGE",
    "BRETT",
    "POPCAT",
    "FLOKI",
    "MOG",
  ].includes(symbol);
  return known ? (
    <img
      className="coin-avatar"
      src={`./assets/${symbol.toLowerCase()}.svg`}
      alt=""
      width={size}
      height={size}
    />
  ) : (
    <span
      className="coin-avatar generic-avatar"
      style={{ "--avatar-size": `${size}px` } as CSSProperties}
    >
      {symbol.slice(0, 2)}
    </span>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, i) => `${i * 9.1},${31 - (value / max) * 27}`)
    .join(" ");
  return (
    <svg
      className="sparkline"
      width="104"
      height="36"
      viewBox="0 0 104 36"
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={`0,35 ${points} 100,35`}
        fill="currentColor"
        opacity=".07"
      />
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
