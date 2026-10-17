export interface Post {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  likes: number;
  reposts: number;
  url?: string;
}

export interface Coin {
  symbol: string;
  name: string;
  posts: Post[];
  mentions: number;
  authors: number;
  engagement: number;
  latest: number;
  activity: number[];
}

export const COINS: Record<
  string,
  { name: string; color: string; art: string }
> = {
  PEPE: { name: "Pepe", color: "#83b657", art: "frog" },
  WIF: { name: "dogwifhat", color: "#d8bea6", art: "hat" },
  BONK: { name: "Bonk", color: "#f5a34b", art: "dog" },
  DOGE: { name: "Dogecoin", color: "#d4bb66", art: "doge" },
  BRETT: { name: "Brett", color: "#81b1ef", art: "face" },
  POPCAT: { name: "Popcat", color: "#e4c9a4", art: "cat" },
  FLOKI: { name: "Floki", color: "#c6ab8e", art: "viking" },
  MOG: { name: "Mog Coin", color: "#efda77", art: "glasses" },
};

// Fictional examples, deliberately identified as such in every feed surface.
// Their timestamps are anchored once per session; refreshing never invents new posts.
export function makeDemoPosts(now = Date.now()): Post[] {
  const sizes = [32, 24, 19, 16, 12, 9, 7, 5];
  const phrases = [
    "Lagi nyimak {coin}. Meme-nya makin kreatif, tapi tetap riset dulu sebelum ikut ramai.",
    "{coin} lewat lagi di lini masa. Koin meme memang nggak pernah sepi cerita.",
    "Komunitas {coin} masih aktif bikin meme hari ini. Ada yang ikut nyimak?",
    "Meme favorit hari ini datang dari komunitas {coin}. Ramai belum tentu layak dibeli.",
  ];
  return Object.keys(COINS).flatMap((symbol, c) =>
    Array.from({ length: sizes[c] }, (_, i) => ({
      id: `demo-${symbol}-${i}`,
      text: phrases[(i + c) % phrases.length].replace("{coin}", `$${symbol}`),
      author: `contoh_${["pengamat", "penyimak", "komunitas", "penjelajah"][(i + c) % 4]}`,
      createdAt: new Date(
        now -
          (i === 0 ? (c + 1) * 7 : 42 + ((i * 57 + c * 83) % 2700)) * 60_000,
      ).toISOString(),
      likes: Math.max(0, 241 - c * 22 - i * 5),
      reposts: Math.max(0, 62 - c * 5 - i * 2),
    })),
  );
}

export function parseFeed(input: unknown): Post[] {
  if (
    !input ||
    typeof input !== "object" ||
    !("posts" in input) ||
    !Array.isArray(input.posts)
  ) {
    throw new Error(
      "Format feed belum sesuai. Gunakan JSON dengan daftar posts.",
    );
  }
  if (input.posts.length > 20_000)
    throw new Error("Feed terlalu besar. Batasi hingga 20.000 post.");
  const seen = new Set<string>();
  return input.posts
    .map((value: unknown) => {
      if (!value || typeof value !== "object")
        throw new Error("Ada post yang tidak valid di feed.");
      const p = value as Record<string, unknown>;
      if (
        typeof p.id !== "string" ||
        !p.id ||
        typeof p.text !== "string" ||
        typeof p.author !== "string" ||
        typeof p.createdAt !== "string" ||
        !Number.isFinite(Date.parse(p.createdAt)) ||
        typeof p.likes !== "number" ||
        !Number.isSafeInteger(p.likes) ||
        p.likes < 0 ||
        typeof p.reposts !== "number" ||
        !Number.isSafeInteger(p.reposts) ||
        p.reposts < 0
      ) {
        throw new Error(
          "Ada post yang tidak lengkap. Periksa format feed dan coba lagi.",
        );
      }
      let url: string | undefined;
      if (typeof p.url === "string") {
        try {
          const link = new URL(p.url);
          if (
            link.protocol === "https:" &&
            /^(www\.)?(x\.com|twitter\.com)$/.test(link.hostname) &&
            /^\/\w+\/status\/\d+\/?$/.test(link.pathname)
          )
            url = link.href;
        } catch {
          /* An unsafe link is omitted; the text remains usable. */
        }
      }
      return {
        id: p.id,
        text: p.text.slice(0, 10_000),
        author: p.author.slice(0, 100),
        createdAt: p.createdAt,
        likes: p.likes,
        reposts: p.reposts,
        url,
      };
    })
    .filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
}

export function aggregatePosts(
  posts: Post[],
  hours = 48,
  now = Date.now(),
): Coin[] {
  const grouped = new Map<string, Post[]>();
  for (const post of posts) {
    const age = now - Date.parse(post.createdAt);
    if (age < 0 || age > hours * 3_600_000 || !/\bmeme\b/i.test(post.text))
      continue;
    const tickers = [
      ...new Set(
        [
          ...post.text.matchAll(
            /\$([A-Za-z][A-Za-z0-9]{0,11})(?![A-Za-z0-9_])/g,
          ),
        ].map((m) => m[1].toUpperCase()),
      ),
    ];
    for (const symbol of tickers) {
      const group = grouped.get(symbol);
      if (group) group.push(post);
      else grouped.set(symbol, [post]);
    }
  }
  return [...grouped.entries()].map(([symbol, items]) => {
    const sorted = items.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    const activity = Array.from({ length: 12 }, () => 0);
    for (const post of sorted) {
      const bin = Math.min(
        11,
        Math.floor(
          (now - Date.parse(post.createdAt)) / ((hours * 3_600_000) / 12),
        ),
      );
      activity[11 - bin]++;
    }
    return {
      symbol,
      name: COINS[symbol]?.name ?? symbol,
      posts: sorted,
      mentions: sorted.length,
      authors: new Set(sorted.map((p) => p.author.toLowerCase())).size,
      engagement: sorted.reduce((sum, p) => sum + p.likes + p.reposts, 0),
      latest: Date.parse(sorted[0].createdAt),
      activity,
    };
  });
}

export function validateEndpoint(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error("Gunakan URL HTTPS publik tanpa kata sandi atau fragmen.");
  }
  return url.href;
}

export const number = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
export function timeAgo(value: number | string, now = Date.now()): string {
  const minutes = Math.max(
    1,
    Math.floor(
      (now - (typeof value === "string" ? Date.parse(value) : value)) / 60_000,
    ),
  );
  return minutes < 60
    ? `${minutes} mnt lalu`
    : `${Math.floor(minutes / 60)} jam lalu`;
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
