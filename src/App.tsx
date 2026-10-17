import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  aggregatePosts,
  COINS,
  makeDemoPosts,
  number,
  parseFeed,
  readStorage,
  timeAgo,
  validateEndpoint,
  writeStorage,
  type Coin,
  type Post,
} from "./data";
import { CoinAvatar, Hand, Icon, Sparkline } from "./icons";

type View = "all" | "hot" | "saved";
type DialogState = "source" | "about" | Coin | null;
const REFRESH_MS = 60_000;

function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    const trigger = document.activeElement as HTMLElement | null;
    element?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = oldOverflow;
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]',
          ),
        ].filter((element) => element.checkVisibility());
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Tutup dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function PostItem({
  post,
  demo,
  compact = false,
}: {
  post: Post;
  demo: boolean;
  compact?: boolean;
}) {
  return (
    <article className={`post ${compact ? "post-compact" : ""}`}>
      <div className="post-meta">
        <span className="author-avatar" aria-hidden="true">
          {post.author.replace("@", "").slice(0, 1).toUpperCase()}
        </span>
        <span className="post-author">@{post.author.replace(/^@/, "")}</span>
        <span className="post-time">{timeAgo(post.createdAt)}</span>
      </div>
      <p>
        {post.text.split(/(\$[A-Za-z][A-Za-z0-9]*)/g).map((part, i) =>
          part.startsWith("$") ? (
            <span className="ticker-text" key={i}>
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </p>
      <div className="post-bottom">
        <span>
          <Icon name="heart" size={14} />
          {number(post.likes)}
        </span>
        <span>
          <Icon name="refresh" size={14} />
          {number(post.reposts)}
        </span>
        {demo ? (
          <span className="example-label">Post contoh</span>
        ) : post.url ? (
          <a href={post.url} target="_blank" rel="noopener noreferrer">
            Buka di X <Icon name="external" size={14} />
          </a>
        ) : (
          <span className="example-label">Tautan tidak tersedia</span>
        )}
      </div>
    </article>
  );
}

export default function App() {
  const [demoPosts] = useState(() => makeDemoPosts());
  const [endpoint, setEndpoint] = useState(() => {
    const value = readStorage<unknown>("nyimak-feed", "");
    return typeof value === "string" ? value : "";
  });
  const [posts, setPosts] = useState<Post[]>(() => (endpoint ? [] : demoPosts));
  const [saved, setSaved] = useState<string[]>(() => {
    const value = readStorage<unknown>("nyimak-saved", []);
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  });
  const [auto, setAuto] = useState(true);
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [hours, setHours] = useState(48);
  const [sort, setSort] = useState("mentions");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [feedInput, setFeedInput] = useState(endpoint);
  const [formError, setFormError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(
    endpoint ? null : Date.now(),
  );
  const [clock, setClock] = useState(Date.now());
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const demo = !endpoint;

  const fetchPosts = useCallback(async (url: string): Promise<Post[]> => {
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    const timer = window.setTimeout(() => abort.abort(), 12_000);
    try {
      const response = await fetch(url, {
        signal: abort.signal,
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok)
        throw new Error(
          `Feed menjawab HTTP ${response.status}. Periksa sumber dan coba lagi.`,
        );
      if (Number(response.headers.get("content-length")) > 2_000_000)
        throw new Error("Feed terlalu besar. Batasi ukuran hingga 2 MB.");
      const body = await response.text();
      if (new TextEncoder().encode(body).length > 2_000_000)
        throw new Error("Feed terlalu besar. Batasi ukuran hingga 2 MB.");
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        throw new Error(
          "Feed harus berupa JSON. Periksa URL sumber dan coba lagi.",
        );
      }
      return parseFeed(json);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError")
        throw new Error(
          "Sumber belum merespons. Coba lagi atau ganti sumber data.",
        );
      if (err instanceof TypeError)
        throw new Error(
          "Feed tidak dapat diakses. Periksa koneksi dan izin CORS sumber, lalu coba lagi.",
        );
      throw err;
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  const refresh = useCallback(
    async (manual = false) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      try {
        const updated = endpoint
          ? await fetchPosts(validateEndpoint(endpoint))
          : demoPosts;
        if (!mounted.current) return;
        setPosts(updated);
        setLastChecked(Date.now());
        setClock(Date.now());
        setError("");
        if (manual)
          setNotice(
            endpoint
              ? "Feed berhasil diperbarui."
              : "Data contoh diperiksa. Contoh tidak menghasilkan post baru.",
          );
      } catch (err) {
        if (mounted.current)
          setError(
            err instanceof Error ? err.message : "Pembaruan gagal. Coba lagi.",
          );
      } finally {
        if (mounted.current) setLoading(false);
        busy.current = false;
      }
    },
    [endpoint, demoPosts, fetchPosts],
  );

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    mounted.current = true;
    if (endpoint) void refreshRef.current();
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
    // Initial load only. Switching sources loads and validates before committing the source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const clockTimer = window.setInterval(() => setClock(Date.now()), 30_000);
    if (!auto) return () => window.clearInterval(clockTimer);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshRef.current();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [auto]);

  const coins = useMemo(
    () => aggregatePosts(posts, hours, clock),
    [posts, hours, clock],
  );
  const ranked = useMemo(
    () =>
      [...coins].sort(
        (a, b) => b.mentions - a.mentions || b.engagement - a.engagement,
      ),
    [coins],
  );
  const filtered = useMemo(() => {
    const search = query.trim().replace(/^\$/, "").toLowerCase();
    return (view === "hot" ? ranked.slice(0, 4) : coins)
      .filter(
        (coin) =>
          (view !== "saved" || saved.includes(coin.symbol)) &&
          (coin.symbol.toLowerCase().includes(search) ||
            coin.name.toLowerCase().includes(search)),
      )
      .sort((a, b) =>
        sort === "recent"
          ? b.latest - a.latest
          : sort === "engagement"
            ? b.engagement - a.engagement
            : b.mentions - a.mentions || b.engagement - a.engagement,
      );
  }, [coins, ranked, view, query, saved, sort]);
  const matchingPosts = useMemo(
    () =>
      [
        ...new Map(
          coins.flatMap((coin) => coin.posts).map((post) => [post.id, post]),
        ).values(),
      ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [coins],
  );
  const toggleSave = (symbol: string) => {
    const next = saved.includes(symbol)
      ? saved.filter((item) => item !== symbol)
      : [...saved, symbol];
    setSaved(next);
    const persisted = writeStorage("nyimak-saved", next);
    setNotice(
      `${symbol} ${next.includes(symbol) ? "disimpan" : "dihapus dari simpanan"}.${persisted ? "" : " Penyimpanan browser tidak tersedia; simpanan berlaku selama halaman terbuka."}`,
    );
  };
  const resetFilters = () => {
    setQuery("");
    setView("all");
    setHours(48);
    setSort("mentions");
  };
  const openSource = () => {
    setFeedInput(endpoint);
    setFormError("");
    setDialog("source");
  };
  const connectFeed = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    setFormError("");
    let url: string;
    try {
      url = validateEndpoint(feedInput.trim());
    } catch {
      setFormError(
        "Masukkan URL HTTPS publik yang valid, tanpa kata sandi atau fragmen.",
      );
      document.getElementById("feed-url")?.focus();
      return;
    }
    busy.current = true;
    setLoading(true);
    try {
      const updated = await fetchPosts(url);
      if (!mounted.current) return;
      setEndpoint(url);
      setPosts(updated);
      setLastChecked(Date.now());
      setClock(Date.now());
      setError("");
      const persisted = writeStorage("nyimak-feed", url);
      setNotice(
        `Sumber data terhubung.${persisted ? "" : " Sumber hanya tersimpan selama halaman terbuka."}`,
      );
      setDialog(null);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Sumber gagal terhubung. Periksa URL dan coba lagi.",
      );
      document.getElementById("feed-url")?.focus();
    } finally {
      setLoading(false);
      busy.current = false;
    }
  };
  const useDemo = () => {
    controller.current?.abort();
    setEndpoint("");
    setPosts(demoPosts);
    writeStorage("nyimak-feed", "");
    setError("");
    setLastChecked(Date.now());
    setClock(Date.now());
    setDialog(null);
    setNotice("Mode contoh diaktifkan. Semua post adalah ilustrasi.");
  };

  return (
    <>
      <a className="skip-link" href="#radar">
        Langsung ke radar
      </a>
      <header className="header page-width">
        <a
          className="brand"
          href="#"
          aria-label="nyimak, beranda"
          onClick={resetFilters}
        >
          <Hand className="brand-hand" />
          <span>
            nyimak<span className="brand-dot">.</span>
          </span>
        </a>
        <nav className="nav" aria-label="Navigasi utama">
          <a
            href="#radar"
            className={view !== "saved" ? "active" : ""}
            onClick={() => setView("all")}
          >
            Radar
          </a>
          <a
            href="#radar"
            className={view === "saved" ? "active" : ""}
            onClick={() => setView("saved")}
          >
            Tersimpan
            {saved.length > 0 && (
              <span className="nav-count">{saved.length}</span>
            )}
          </a>
        </nav>
        <button className="about-button" onClick={() => setDialog("about")}>
          Cara kerja <Icon name="info" size={16} />
        </button>
      </header>
      <main className="page-width">
        <section className="intro" aria-labelledby="intro-title">
          <div className="intro-copy">
            <h1 id="intro-title">
              Yang <span>ramai,</span>
              <br />
              jangan terlewat.
            </h1>
            <p>
              Radar koin meme dari percakapan X,
              <br className="mobile-break" /> 48 jam terakhir.
            </p>
            <div className="intro-filters">
              <span>
                <span className="small-dot" /> Fokus pada percakapan
              </span>
              <span className="keyword">meme</span>
              <span className="keyword">$ticker</span>
            </div>
          </div>
          <div className="radar-art" aria-hidden="true">
            <div className="radar-orbit orbit-one" />
            <div className="radar-orbit orbit-two" />
            <div className="radar-orbit orbit-three" />
            <span className="orbit-dot dot-one" />
            <span className="orbit-dot dot-two" />
            <span className="art-label label-meme">meme</span>
            <Hand className="hero-hand" />
            <span className="art-label label-dollar">$</span>
            <span className="art-cross cross-one">+</span>
            <span className="art-cross cross-two">+</span>
          </div>
        </section>

        <div
          className="summary-strip"
          role="group"
          aria-label="Ringkasan radar"
        >
          <div>
            <span className="summary-icon">
              <Icon name="bars" />
            </span>
            <span>
              <strong>{number(coins.length)}</strong> koin terpantau
            </span>
          </div>
          <div>
            <span className="summary-icon">
              <Icon name="search" />
            </span>
            <span>
              <strong>{number(matchingPosts.length)}</strong> post tersaring
            </span>
          </div>
          <div>
            <span className="summary-icon">
              <Icon name="clock" />
            </span>
            <span className="summary-window">
              <strong>{hours} jam</strong>
              <span>terakhir</span>
            </span>
          </div>
          <span className="summary-note">
            {demo ? "Ringkasan data contoh" : "Ringkasan feed terhubung"}
          </span>
        </div>

        <section
          className="radar-section"
          id="radar"
          aria-labelledby="radar-title"
        >
          <div className="section-heading">
            <div className="section-title">
              <h2 id="radar-title">Radar meme</h2>
              <span className={`source-badge ${demo ? "" : "connected"}`}>
                <span className="small-dot" />
                {demo ? "Data contoh" : "Feed terhubung"}
              </span>
            </div>
            <button className="text-button source-button" onClick={openSource}>
              <Icon name="plug" size={16} />
              <span>Sumber data</span>
              <Icon name="chevron" size={14} />
            </button>
          </div>
          <div className="data-disclosure">
            <Icon name="info" size={16} />
            <p>
              {demo
                ? "Jelajahi dengan data contoh. Hubungkan feed X untuk memantau post sungguhan."
                : "Post dari feed pilihanmu. Popularitas dihitung dari post yang diterima, bukan seluruh X."}
            </p>
          </div>
          <div className="workspace">
            <div className="feed-column">
              <div className="feed-toolbar">
                <div
                  className="view-tabs"
                  role="group"
                  aria-label="Tampilkan koin"
                >
                  <button
                    aria-pressed={view === "all"}
                    className={view === "all" ? "selected" : ""}
                    onClick={() => setView("all")}
                  >
                    Semua koin
                  </button>
                  <button
                    aria-pressed={view === "hot"}
                    className={view === "hot" ? "selected" : ""}
                    onClick={() => setView("hot")}
                  >
                    <Icon name="fire" size={16} />
                    Paling ramai
                  </button>
                  <button
                    aria-label="Tersimpan"
                    aria-pressed={view === "saved"}
                    className={view === "saved" ? "selected" : ""}
                    onClick={() => setView("saved")}
                  >
                    <Icon name="bookmark" size={16} />
                    <span className="saved-tab-label">Tersimpan</span>
                    {saved.length > 0 && (
                      <span className="tab-count">{saved.length}</span>
                    )}
                  </button>
                </div>
                <button
                  className="primary-button refresh-button"
                  onClick={() => void refresh(true)}
                  disabled={loading}
                >
                  <Icon
                    name="refresh"
                    size={16}
                    className={loading ? "refreshing" : ""}
                  />
                  {loading ? "Memeriksa…" : "Perbarui"}
                </button>
              </div>
              <div className="filter-row">
                <label className="search-field">
                  <span className="sr-only">Cari nama atau ticker koin</span>
                  <Icon name="search" size={18} />
                  <input
                    name="coin-search"
                    type="search"
                    autoComplete="off"
                    placeholder="Cari koin atau $ticker…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <kbd aria-hidden="true">⌕</kbd>
                </label>
                <label className="select-field">
                  <span className="sr-only">Jendela waktu</span>
                  <select
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                  >
                    <option value="48">48 jam</option>
                    <option value="24">24 jam</option>
                  </select>
                </label>
                <label className="select-field sort-field">
                  <span className="sr-only">Urutkan koin</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="mentions">Post terbanyak</option>
                    <option value="recent">Post terbaru</option>
                    <option value="engagement">Interaksi terbanyak</option>
                  </select>
                </label>
              </div>
              {error && (
                <div className="error-banner" role="alert">
                  <Icon name="info" />
                  <div>
                    <strong>Pembaruan belum berhasil</strong>
                    <p>
                      {error}
                      {lastChecked ? " Data terakhir tetap ditampilkan." : ""}
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => void refresh(true)}
                  >
                    Coba lagi
                  </button>
                </div>
              )}
              <div className="coin-list" aria-busy={loading}>
                <div className="list-head" aria-hidden="true">
                  <span>Koin</span>
                  <span>Post di X</span>
                  <span>Interaksi</span>
                  <span>Aktivitas {hours}j</span>
                  <span />
                </div>
                {loading && !posts.length ? (
                  <div className="empty-state">
                    <Icon name="refresh" size={30} className="refreshing" />
                    <h3>Memeriksa percakapan…</h3>
                    <p>Feed sedang dimuat. Tunggu sebentar.</p>
                  </div>
                ) : filtered.length ? (
                  filtered.map((coin, i) => (
                    <article className="coin-row" key={coin.symbol}>
                      <div className="coin-cell">
                        <span className="coin-rank">{i + 1}</span>
                        <button
                          className="coin-name-button"
                          onClick={() => setDialog(coin)}
                          aria-label={`Lihat detail ${coin.name}`}
                        >
                          <CoinAvatar symbol={coin.symbol} />
                          <span className="coin-identity">
                            <strong>{coin.name}</strong>
                            <span className="coin-ticker">
                              ${coin.symbol}
                              {i === 0 &&
                                view !== "saved" &&
                                sort === "mentions" && (
                                  <span className="hot-label">
                                    <Icon name="fire" size={12} />
                                    Ramai
                                  </span>
                                )}
                            </span>
                          </span>
                        </button>
                      </div>
                      <div className="metric mentions-metric">
                        <strong>
                          {number(coin.mentions)}
                          <span className="mobile-metric-label"> post</span>
                        </strong>
                        <span>{coin.authors} akun</span>
                      </div>
                      <div className="metric engagement-metric">
                        <strong>{number(coin.engagement)}</strong>
                        <span>suka + repost</span>
                      </div>
                      <div className="activity-cell">
                        <Sparkline values={coin.activity} />
                        <span>{timeAgo(coin.latest, clock)}</span>
                      </div>
                      <div className="row-actions">
                        <button
                          className={`icon-button save-button ${saved.includes(coin.symbol) ? "is-saved" : ""}`}
                          aria-pressed={saved.includes(coin.symbol)}
                          aria-label={`${saved.includes(coin.symbol) ? "Hapus" : "Simpan"} ${coin.name}${saved.includes(coin.symbol) ? " dari simpanan" : ""}`}
                          onClick={() => toggleSave(coin.symbol)}
                        >
                          <Icon name="bookmark" size={18} />
                        </button>
                        <button
                          className="icon-button detail-button"
                          aria-label={`Buka post ${coin.name}`}
                          onClick={() => setDialog(coin)}
                        >
                          <Icon name="chevron" size={16} />
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <Icon
                      name={view === "saved" ? "bookmark" : "search"}
                      size={32}
                    />
                    <h3>
                      {view === "saved" && !query
                        ? saved.length
                          ? "Simpanan belum muncul di feed"
                          : "Belum ada koin tersimpan"
                        : "Belum ada koin yang cocok"}
                    </h3>
                    <p>
                      {view === "saved" && !query
                        ? saved.length
                          ? "Ticker tersimpan belum memiliki post yang cocok. Coba jendela 48 jam atau lihat semua koin."
                          : "Simpan koin lewat ikon penanda untuk memantaunya lagi di sini."
                        : query
                          ? `Tidak ada hasil untuk “${query}”. Coba nama atau ticker lain.`
                          : "Belum ada post dengan kata meme dan $ticker dalam jendela waktu ini."}
                    </p>
                    <button className="secondary-button" onClick={resetFilters}>
                      Lihat semua koin <Icon name="arrow" size={16} />
                    </button>
                  </div>
                )}
                <div className="list-footer">
                  <span>
                    {filtered.length} dari {coins.length} koin ditampilkan
                  </span>
                  <span>
                    <span className="small-dot" />
                    {demo ? "Data ilustrasi" : "Dari feed pilihan"}
                  </span>
                </div>
              </div>
              <div className="update-row">
                <span className="update-time">
                  <Icon name="clock" size={14} />
                  {lastChecked
                    ? `Diperiksa ${new Date(lastChecked).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                    : "Belum diperbarui"}
                </span>
                <button
                  className="auto-button"
                  role="switch"
                  aria-checked={auto}
                  aria-label="Pembaruan otomatis setiap 60 detik"
                  onClick={() => {
                    setAuto(!auto);
                    setNotice(
                      auto
                        ? "Pembaruan otomatis dijeda."
                        : "Pembaruan otomatis aktif setiap 60 detik.",
                    );
                  }}
                >
                  <span className={`switch ${auto ? "switch-on" : ""}`}>
                    <span />
                  </span>
                  Otomatis <span className="auto-interval">· 60 dtk</span>
                </button>
              </div>
            </div>

            <aside
              className="conversation-column"
              aria-labelledby="conversation-title"
            >
              <div className="conversation-heading">
                <h3 id="conversation-title">Di lini masa</h3>
                <span className="x-mark" aria-hidden="true">
                  𝕏
                </span>
              </div>
              <p className="aside-subtitle">
                {demo
                  ? "Cuplikan post contoh terbaru"
                  : "Post terbaru dari feed"}
              </p>
              <div className="posts-feed">
                {matchingPosts.slice(0, 3).map((post) => (
                  <PostItem post={post} demo={demo} key={post.id} compact />
                ))}
                {!matchingPosts.length && (
                  <p className="aside-empty">
                    Post yang cocok akan muncul di sini setelah feed diperbarui.
                  </p>
                )}
              </div>
              <a
                className="x-search"
                href={`https://x.com/search?q=${encodeURIComponent("meme $ min_faves:10")}&f=live`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Jelajahi percakapan di X <Icon name="external" size={15} />
              </a>
            </aside>
          </div>
        </section>
        <div className="note-row">
          <Icon name="info" size={16} />
          <p>
            Ramai bukan rekomendasi beli. Kenali risikonya, lakukan riset
            sendiri.
          </p>
        </div>
      </main>
      <footer className="footer page-width">
        <a className="footer-brand" href="#">
          nyimak.
        </a>
        <p>Sedikit sinyal. Lebih banyak konteks.</p>
        <button className="text-button" onClick={() => setDialog("about")}>
          Tentang radar <Icon name="arrow" size={14} />
        </button>
      </footer>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {notice}
      </div>
      {dialog === "source" && (
        <Dialog
          title="Hubungkan sumber data"
          onClose={() => {
            if (loading) controller.current?.abort();
            setDialog(null);
          }}
        >
          <p className="dialog-intro">
            {demo
              ? "Saat ini kamu melihat post contoh, bukan data langsung dari X."
              : "Radar menggunakan feed publik yang kamu hubungkan."}
          </p>
          <div className="info-block">
            <Icon name="info" size={20} />
            <p>
              Gunakan feed JSON publik dari penyedia data X. Feed diperiksa
              setiap 60 detik saat pembaruan otomatis aktif.
            </p>
          </div>
          <form onSubmit={connectFeed} noValidate>
            <label className="field-label" htmlFor="feed-url">
              URL feed publik
            </label>
            <input
              id="feed-url"
              className="text-input"
              name="feed-url"
              type="url"
              autoComplete="url"
              placeholder="https://domain-kamu.id/feed.json"
              value={feedInput}
              onChange={(e) => setFeedInput(e.target.value)}
              aria-invalid={!!formError}
              aria-describedby={
                formError ? "feed-error feed-help" : "feed-help"
              }
            />
            <p className="field-help" id="feed-help">
              URL HTTPS dengan akses CORS. Jangan masukkan API key atau data
              rahasia. Pengaturan hanya berlaku di browser ini.
            </p>
            {formError && (
              <p className="field-error" id="feed-error" role="alert">
                {formError}
              </p>
            )}
            <button
              className="primary-button connect-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Menghubungkan…" : "Hubungkan feed"}
              <Icon
                name={loading ? "refresh" : "arrow"}
                size={18}
                className={loading ? "refreshing" : ""}
              />
            </button>
          </form>
          <button
            className="secondary-button full-width"
            disabled={loading}
            onClick={useDemo}
          >
            {demo ? "Lanjut jelajahi contoh" : "Gunakan data contoh"}
          </button>
          <details className="feed-format">
            <summary>Format feed yang didukung</summary>
            <p>
              JSON berisi daftar <code>posts</code>. Tiap post memerlukan{" "}
              <code>id</code>, <code>text</code>, <code>author</code>,{" "}
              <code>createdAt</code> (ISO 8601), <code>likes</code>, dan{" "}
              <code>reposts</code>. Tautan post X dapat ditambahkan melalui{" "}
              <code>url</code>.
            </p>
            <p>
              Post lama dan duplikat disaring di browser. Maksimal 20.000 post
              dan 2 MB per feed. Kunci akses X harus tetap berada di server
              penyedia feed.
            </p>
          </details>
        </Dialog>
      )}
      {dialog === "about" && (
        <Dialog
          title="Nyimak, lalu riset sendiri."
          onClose={() => setDialog(null)}
        >
          <div className="about-mark">
            <Hand />
          </div>
          <p className="dialog-intro">
            Nyimak merangkum koin yang disebut dalam percakapan X. Satu tempat
            untuk melihat apa yang sedang ramai.
          </p>
          <ol className="how-list">
            <li>
              <span>1</span>
              <div>
                <h3>Saring percakapannya</h3>
                <p>
                  Hanya post dengan kata “meme” dan ticker seperti $PEPE dalam
                  48 jam terakhir. Filter 24 jam mempersempit waktunya.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Lihat ramainya</h3>
                <p>
                  Urutan awal berdasarkan jumlah post. Interaksi adalah jumlah
                  suka dan repost. Grafik menunjukkan jumlah post per rentang
                  waktu, bukan harga.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Simpan yang menarik</h3>
                <p>
                  Penanda menyimpan ticker di browser ini. Ticker dapat merujuk
                  ke beberapa token; selalu periksa identitas dan kontraknya
                  sendiri.
                </p>
              </div>
            </li>
          </ol>
          <p className="about-disclosure">
            {demo
              ? "Mode contoh aktif. Semua post, akun, dan angka adalah ilustrasi; bukan aktivitas X sungguhan."
              : "Data berasal dari feed yang kamu pilih. Radar tidak menjamin kelengkapan data, keaslian akun, atau keamanan token."}
          </p>
          <button
            className="primary-button full-width"
            onClick={() => {
              setDialog(null);
              document
                .getElementById("radar")
                ?.scrollIntoView({ behavior: "instant" });
            }}
          >
            Mulai nyimak <Icon name="arrow" size={18} />
          </button>
        </Dialog>
      )}
      {dialog && typeof dialog === "object" && (
        <Dialog
          title={`Percakapan $${dialog.symbol}`}
          onClose={() => setDialog(null)}
          wide
        >
          <div className="coin-detail-header">
            <CoinAvatar symbol={dialog.symbol} size={52} />
            <div>
              <h3>{dialog.name}</h3>
              <p>
                {dialog.mentions} post · {dialog.authors} akun · {hours} jam
                terakhir
              </p>
            </div>
            <button
              className={`icon-button save-button ${saved.includes(dialog.symbol) ? "is-saved" : ""}`}
              aria-label={`${saved.includes(dialog.symbol) ? "Hapus" : "Simpan"} ${dialog.name}`}
              aria-pressed={saved.includes(dialog.symbol)}
              onClick={() => toggleSave(dialog.symbol)}
            >
              <Icon name="bookmark" />
            </button>
          </div>
          <p className="detail-disclosure">
            {demo
              ? "Post contoh untuk memperlihatkan cara kerja radar. Semua akun dan interaksi adalah ilustrasi."
              : "Post diurutkan dari yang terbaru. Data dan tautan disediakan oleh feed pilihanmu."}
          </p>
          <div className="detail-posts">
            {dialog.posts.slice(0, 20).map((post) => (
              <PostItem post={post} demo={demo} key={post.id} />
            ))}
          </div>
          {dialog.posts.length > 20 && (
            <p className="field-help">
              Menampilkan 20 post terbaru dari {dialog.posts.length} post.
            </p>
          )}
          <a
            className="secondary-button full-width"
            href={`https://x.com/search?q=${encodeURIComponent(`meme $${dialog.symbol}`)}&f=live`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Cari ${dialog.symbol} di X <Icon name="external" size={16} />
          </a>
          {!COINS[dialog.symbol] && (
            <p className="field-help">
              Nama token ditampilkan sesuai ticker; identitas token belum
              diverifikasi.
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
