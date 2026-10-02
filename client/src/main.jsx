import React, {lazy, Suspense, useEffect, useState, useCallback, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {motion, AnimatePresence, MotionConfig} from 'motion/react';
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  MapPin,
  ShieldCheck,
  Plus,
  X,
  Check,
  KeyRound,
  Calculator,
  Headphones,
  Wallet,
  FlaskConical,
  Contact,
  LayoutGrid,
  MessageCircle,
  Monitor,
  Moon,
  Sun,
  LogOut,
  ChevronDown,
  LoaderCircle,
  CheckCircle2,
  Clock,
  Package,
  Heart,
  Leaf,
  Lock,
  Send,
  Map as MapIcon,
  List,
  LocateFixed,
  ImagePlus,
  Flag,
  Edit3,
  Trash2,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import './styles.css';
import {applyTheme, cycleTheme, getTheme, watchSystemTheme} from './lib/theme.js';

const MapboxMap = lazy(() => import('./MapboxMap.jsx'));
const initialTheme = getTheme();
applyTheme(initialTheme);
const icons = {
  'ID Cards': Contact,
  'Room Keys': KeyRound,
  Calculators: Calculator,
  'Lab Equipment': FlaskConical,
  Earphones: Headphones,
  Wallets: Wallet,
};

const api = async (path, options = {}) => {
  const res = await fetch('/api' + path, {
    ...options,
    headers: {'Content-Type': 'application/json', ...options.headers},
    credentials: 'same-origin',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
};

const post = (p, b, method = 'POST') => api(p, {method, body: JSON.stringify(b)});

const postFormData = async (path, formData, method = 'POST') => {
  const res = await fetch('/api' + path, {
    method,
    body: formData,
    credentials: 'same-origin',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
};

function App() {
  const [user, setUser] = useState(null),
    [meta, setMeta] = useState({venues: [], categories: [], checkpoints: []}),
    [page, setPage] = useState('board'),
    [kind, setKind] = useState('found'),
    [category, setCategory] = useState(''),
    [venue, setVenue] = useState(''),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [items, setItems] = useState([]),
    [mapItems, setMapItems] = useState([]),
    [total, setTotal] = useState(0),
    [num, setNum] = useState(1),
    [stats, setStats] = useState({}),
    [notifs, setNotifs] = useState({total: 0, pendingClaimsCount: 0, activeHandoffsCount: 0}),
    [viewMode, setViewMode] = useState('list'),
    [focusLocation, setFocusLocation] = useState(null),
    [loading, setLoading] = useState(true),
    [mapLoading, setMapLoading] = useState(false),
    [error, setError] = useState(''),
    [mapError, setMapError] = useState(''),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(''),
    [revision, setRevision] = useState(0),
    [theme, setTheme] = useState(initialTheme);

  const notify = useCallback(message => setToast(message), []);
  const refresh = () => setRevision(r => r + 1);

  useEffect(() => watchSystemTheme(() => setTheme(applyTheme)), []);

  useEffect(() => {
    Promise.all([api('/auth/me'), api('/meta')])
      .then(([a, m]) => {
        setUser(a.user);
        setMeta(m);
      })
      .catch(e => setError(e.message));

    const token = new URLSearchParams(location.search).get('verify');
    if (token) {
      post('/auth/verify', {token})
        .then(d => {
          notify(d.message);
          setModal({type: 'auth'});
        })
        .catch(e => notify(e.message));
      history.replaceState({}, '', location.pathname);
    }
  }, [notify]);

  // Notifications summary poll (G-7)
  useEffect(() => {
    if (!user) {
      setNotifs({total: 0, pendingClaimsCount: 0, activeHandoffsCount: 0});
      return;
    }
    const checkNotifs = () => {
      api('/notifications/summary')
        .then(setNotifs)
        .catch(() => {});
    };
    checkNotifs();
    const interval = setInterval(checkNotifs, 12000);
    return () => clearInterval(interval);
  }, [user, revision]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setNum(1);
  }, [kind, category, venue, query]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const p = new URLSearchParams({kind, page: String(num)});
    if (category) p.set('category', category);
    if (venue) p.set('venue', venue);
    if (query) p.set('search', query);

    Promise.all([api('/items?' + p), api('/stats')])
      .then(([d, s]) => {
        if (alive) {
          setItems(d.items);
          setTotal(d.total);
          setStats(s);
        }
      })
      .catch(e => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [kind, category, venue, query, num, revision]);

  useEffect(() => {
    if (viewMode !== 'map') return;
    let alive = true;
    setMapLoading(true);
    setMapError('');
    const p = new URLSearchParams({kind});
    if (category) p.set('category', category);
    if (venue) p.set('venue', venue);
    if (query) p.set('search', query);

    api('/map/items?' + p)
      .then(d => {
        if (alive) setMapItems(d.items);
      })
      .catch(e => {
        if (alive) setMapError(e.message);
      })
      .finally(() => {
        if (alive) setMapLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [viewMode, kind, category, venue, query, revision]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 5500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const needAuth = action => (user ? action() : setModal({type: 'auth'}));

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <header className="header">
          <a className="brand" href="/" aria-label="Reunite home">
            <span className="brand-icon">
              <Leaf size={23} />
            </span>
            reunite<span className="brand-dot">.</span>
            <span className="campus-chip">VIT VELLORE</span>
          </a>
          <nav aria-label="Main navigation">
            <button
              className={page === 'board' ? 'nav-active' : ''}
              onClick={() => setPage('board')}
            >
              Campus board
            </button>
            <button
              className={page === 'dashboard' ? 'nav-active' : ''}
              onClick={() => needAuth(() => setPage('dashboard'))}
            >
              My activity
              {notifs.total > 0 && <span className="nav-badge">{notifs.total}</span>}
            </button>
            {user?.is_admin && (
              <button
                className={page === 'admin' ? 'nav-active' : ''}
                onClick={() => setPage('admin')}
              >
                <ShieldAlert size={15} /> Moderation
              </button>
            )}
            <button onClick={() => setModal({type: 'how'})}>
              How it works <ArrowUpRight size={14} />
            </button>
          </nav>
          <div className="account">
            <button
              className="theme-toggle"
              title={`Theme: ${theme} (click to change)`}
              aria-label={`Colour theme: ${theme}. Activate to switch to ${
                theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
              }.`}
              onClick={() => setTheme(t => cycleTheme(t))}
            >
              {theme === 'system' ? (
                <Monitor size={17} />
              ) : theme === 'light' ? (
                <Sun size={17} />
              ) : (
                <Moon size={17} />
              )}
            </button>
            {user ? (
              <>
                <button
                  className="avatar"
                  title={`${user.name} (${user.email})`}
                  onClick={() => setPage('dashboard')}
                >
                  {user.name.charAt(0)}
                </button>
                <button
                  aria-label="Sign out"
                  onClick={async () => {
                    try {
                      await post('/auth/logout', {});
                      setUser(null);
                      setPage('board');
                      notify('Signed out.');
                    } catch (e) {
                      notify(e.message);
                    }
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button className="outline" onClick={() => setModal({type: 'auth'})}>
                Student sign in <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>

        {page === 'board' ? (
          <main>
            <section className="hero">
              <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.6}}
                className="hero-copy"
              >
                <div className="eyebrow">
                  <span className="live-dot" /> A LITTLE KINDNESS. A BIG DIFFERENCE.
                </div>
                <h1>
                  Lost on campus.<br />
                  <span>Found by community.</span>
                </h1>
                <p>
                  Your calculator. Your keys. Your peace of mind.<br />
                  Let’s get them back where they belong.
                </p>
                <div className="hero-actions">
                  <button
                    className="primary"
                    onClick={() => needAuth(() => setModal({type: 'report', kind: 'lost'}))}
                  >
                    I lost something <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="outline"
                    onClick={() => needAuth(() => setModal({type: 'report', kind: 'found'}))}
                  >
                    <Plus size={18} /> I found something
                  </button>
                </div>
                <div className="hero-trust">
                  <ShieldCheck size={17} /> Student verified <span>·</span> Private by design{' '}
                  <span>·</span> Campus only
                </div>
              </motion.div>
              <motion.div
                className="hero-art"
                initial={{opacity: 0, scale: 0.9, rotate: -3}}
                animate={{opacity: 1, scale: 1, rotate: 0}}
                transition={{duration: 0.8}}
                aria-hidden="true"
              >
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <span className="art-spark spark-one">✳</span>
                <span className="art-spark spark-two">✦</span>
                <div className="float-item float-key">
                  <KeyRound size={47} />
                  <span>ROOM KEYS</span>
                </div>
                <div className="float-item float-id">
                  <div className="id-top">
                    VIT <span>STUDENT</span>
                  </div>
                  <Contact size={53} />
                  <div className="id-lines" />
                  <span>YOUR CAMPUS. YOUR PEOPLE.</span>
                </div>
                <div className="float-item float-ear">
                  <Headphones size={52} />
                  <span>BACK TO YOUR PLAYLIST</span>
                </div>
                <div className="reunited-note">
                  <span>
                    <Check size={19} />
                  </span>
                  <div>
                    Good things find their way back.
                    <small>One campus. Countless connections.</small>
                  </div>
                </div>
                <div className="art-caption">less searching, more reuniting ↗</div>
              </motion.div>
            </section>

            <section className="stats-strip">
              <div>
                <span className="stat-icon">
                  <Heart size={19} />
                </span>
                <strong>{stats.resolved || 0}</strong>
                <span>happy reunions</span>
              </div>
              <div>
                <span className="stat-icon">
                  <Package size={19} />
                </span>
                <strong>{stats.found || 0}</strong>
                <span>items waiting for you</span>
              </div>
              <div>
                <span className="stat-icon">
                  <MapPin size={19} />
                </span>
                <strong>{meta.venues.length || 42}</strong>
                <span>campus landmarks</span>
              </div>
              <div className="stat-message">
                <ShieldCheck size={19} /> Your details stay yours.
              </div>
            </section>

            <Board
              meta={meta}
              kind={kind}
              setKind={setKind}
              category={category}
              setCategory={setCategory}
              venue={venue}
              setVenue={setVenue}
              search={search}
              setSearch={setSearch}
              stats={stats}
              total={total}
              num={num}
              setNum={setNum}
              items={items}
              mapItems={mapItems}
              loading={loading}
              mapLoading={mapLoading}
              error={error}
              mapError={mapError}
              refresh={refresh}
              viewMode={viewMode}
              setViewMode={setViewMode}
              focusLocation={focusLocation}
              pauseMap={modal?.type === 'report' || modal?.type === 'edit'}
              openItem={item => setModal({type: 'item', item})}
            />

            <section className="kindness">
              <div>
                <span className="eyebrow">BE SOMEONE’S GOOD NEWS</span>
                <h2>Found it? Make their day.</h2>
                <p>A small report can mean a whole lot to someone.</p>
              </div>
              <button
                className="primary"
                onClick={() => needAuth(() => setModal({type: 'report', kind: 'found'}))}
              >
                Report a found item <ArrowUpRight size={18} />
              </button>
              <Heart className="kindness-heart" size={125} />
            </section>
          </main>
        ) : page === 'admin' ? (
          <main>
            <AdminModeration
              notify={notify}
              refresh={refresh}
              openItem={item => setModal({type: 'item', item})}
              onBack={() => setPage('board')}
            />
          </main>
        ) : (
          <main>
            <Dashboard
              meta={meta}
              revision={revision}
              refresh={refresh}
              notify={notify}
              openThread={id => setModal({type: 'thread', id})}
              openEdit={item => setModal({type: 'edit', item})}
              report={() => needAuth(() => setModal({type: 'report', kind: 'lost'}))}
            />
          </main>
        )}

        <footer>
          <div className="brand">
            reunite<span className="brand-dot">.</span>
          </div>
          <span>Built for VIT. Powered by looking out for each other.</span>
          <span>Private. Verified. Reunited.</span>
        </footer>

        <AnimatePresence>
          {toast && (
            <motion.div
              className="toast"
              role="status"
              initial={{y: 80, opacity: 0}}
              animate={{y: 0, opacity: 1}}
              exit={{opacity: 0}}
            >
              <CheckCircle2 size={20} />
              {toast}
              <button aria-label="Dismiss notification" onClick={() => setToast('')}>
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {modal && (
            <Modal
              close={() => setModal(null)}
              title={
                {
                  auth: 'Welcome to your campus community',
                  report: 'A little detail goes a long way',
                  edit: 'Edit your campus report',
                  item: modal.item?.title,
                  thread: 'Your private handoff',
                  how: 'From lost to reunited',
                }[modal.type]
              }
            >
              {modal.type === 'auth' ? (
                <Auth
                  onSuccess={u => {
                    setUser(u);
                    setModal(null);
                    notify('Welcome back, ' + u.name.split(' ')[0] + '.');
                  }}
                  notify={notify}
                />
              ) : modal.type === 'report' ? (
                <Report
                  meta={meta}
                  kind={modal.kind}
                  done={m => {
                    setModal(null);
                    refresh();
                    notify(m);
                  }}
                />
              ) : modal.type === 'edit' ? (
                <EditReport
                  item={modal.item}
                  meta={meta}
                  done={m => {
                    setModal(null);
                    refresh();
                    notify(m);
                  }}
                />
              ) : modal.type === 'item' ? (
                <DialogBoundary key={modal.item.id} onClose={() => setModal(null)}>
                  <ItemDetail
                    item={modal.item}
                    user={user}
                    signIn={() => setModal({type: 'auth'})}
                    notify={notify}
                    onViewLocation={() => {
                      const item = modal.item;
                      if (item.latitude != null && item.longitude != null) {
                        setFocusLocation({
                          latitude: Number(item.latitude),
                          longitude: Number(item.longitude),
                        });
                      }
                      setModal(null);
                      setPage('board');
                      setViewMode('map');
                    }}
                    done={m => {
                      setModal(null);
                      refresh();
                      notify(m);
                    }}
                  />
                </DialogBoundary>
              ) : modal.type === 'thread' ? (
                <Thread
                  id={modal.id}
                  meta={meta}
                  notify={notify}
                  refresh={refresh}
                  close={() => setModal(null)}
                />
              ) : (
                <div className="how-steps">
                  {[
                    [
                      Search,
                      '01',
                      'Report or discover',
                      'Tag an official campus venue and choose the exact spot on the map.',
                    ],
                    [
                      ShieldCheck,
                      '02',
                      'Verify, privately',
                      'Answer the reporter’s custom challenge. Only the reporter reviews your response.',
                    ],
                    [
                      MessageCircle,
                      '03',
                      'Meet and reunite',
                      'After approval, coordinate at a staffed campus checkpoint in your anonymous thread. Mark it resolved after the return.',
                    ],
                  ].map(([Icon, n, t, p]) => (
                    <div key={n}>
                      <Icon />
                      <span>{n}</span>
                      <h3>{t}</h3>
                      <p>{p}</p>
                    </div>
                  ))}
                </div>
              )}
            </Modal>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function Board({
  meta,
  kind,
  setKind,
  category,
  setCategory,
  venue,
  setVenue,
  search,
  setSearch,
  stats,
  total,
  num,
  setNum,
  items,
  mapItems,
  loading,
  mapLoading,
  error,
  mapError,
  refresh,
  viewMode,
  setViewMode,
  focusLocation,
  pauseMap,
  openItem,
}) {
  return (
    <section className="board" id="board">
      <div className="section-head">
        <div className="section-heading">
          <span className="eyebrow">THE CAMPUS NOTICEBOARD</span>
          <h2>Find it on the map.</h2>
          <p>Browse the campus, see where it was last seen, and send a private claim.</p>
        </div>
        <div className="board-status">
          <span className="live-dot" /> Live on campus
        </div>
      </div>
      <div className="toolbar">
        <div className="feed-tabs" role="tablist" aria-label="Listing type">
          <button
            role="tab"
            aria-selected={kind === 'found'}
            className={kind === 'found' ? 'selected' : ''}
            onClick={() => setKind('found')}
          >
            Found items <span>{stats.found || 0}</span>
          </button>
          <button
            role="tab"
            aria-selected={kind === 'lost'}
            className={kind === 'lost' ? 'selected' : ''}
            onClick={() => setKind('lost')}
          >
            Lost items <span>{stats.lost || 0}</span>
          </button>
        </div>
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search items"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by item or detail…"
          />
        </label>
        <label className="venue-filter">
          <MapPin size={16} />
          <select
            aria-label="Campus location"
            value={venue}
            onChange={e => setVenue(e.target.value)}
          >
            <option value="">All campus locations</option>
            {meta.venues.map(v => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <div className="view-toggle" role="group" aria-label="Board view">
          <button
            aria-pressed={viewMode === 'list'}
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
          >
            <List size={16} />
            List
          </button>
          <button
            aria-pressed={viewMode === 'map'}
            className={viewMode === 'map' ? 'active' : ''}
            onClick={() => setViewMode('map')}
          >
            <MapIcon size={16} />
            Map
          </button>
        </div>
      </div>
      <div className="categories">
        <button className={!category ? 'active' : ''} onClick={() => setCategory('')}>
          <LayoutGrid size={15} /> All items
        </button>
        {meta.categories.map(c => {
          const Icon = icons[c] || Package;
          return (
            <button
              key={c}
              className={category === c ? 'active' : ''}
              onClick={() => setCategory(c)}
            >
              <Icon size={16} />
              {c}
            </button>
          );
        })}
      </div>
      <div className="results-label">
        <span>
          {viewMode === 'map'
            ? `${mapItems.length} mapped ${kind} ${mapItems.length === 1 ? 'item' : 'items'}`
            : loading
              ? 'Finding items…'
              : `${total} ${kind} ${total === 1 ? 'item' : 'items'} on the board`}
        </span>
        <span>
          {viewMode === 'map' ? (
            <>
              <LocateFixed size={13} /> Live location is optional
            </>
          ) : (
            <>
              Newest first <ChevronDown size={13} />
            </>
          )}
        </span>
      </div>
      {error && viewMode === 'list' ? (
        <div className="empty" role="alert">
          <h3>We couldn’t load the board</h3>
          <p>{error}</p>
          <button className="primary" onClick={refresh}>
            Try again
          </button>
        </div>
      ) : viewMode === 'map' ? (
        <motion.div
          className="map-workspace"
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
        >
          <div className="map-shell map-shell-main">
            {pauseMap ? (
              <div className="map-fallback">Map paused while you place a report pin…</div>
            ) : (
              <MapErrorBoundary>
                <Suspense fallback={<div className="map-fallback">Loading the campus map…</div>}>
                  <MapboxMap
                    mode="browse"
                    items={mapItems}
                    focusLocation={focusLocation}
                    onItemSelect={openItem}
                    className="map-main"
                  />
                </Suspense>
              </MapErrorBoundary>
            )}
            <div className="map-glass-chip map-campus-label">
              <span className="live-dot" /> VIT Vellore <span className="map-separator">·</span>{' '}
              {mapItems.length} live pins
            </div>
            <div className="map-glass-chip map-privacy-label">
              <LocateFixed size={14} /> Your live location stays on this device
            </div>
          </div>
          <aside className="map-results">
            <div className="map-results-head">
              <div>
                <span className="eyebrow">ON THE MAP</span>
                <h3>{kind === 'found' ? 'Found nearby' : 'Lost nearby'}</h3>
              </div>
              <span className="map-count">{mapItems.length}</span>
            </div>
            {mapLoading ? (
              <div className="map-result-loading">
                <div />
                <div />
                <div />
              </div>
            ) : mapError ? (
              <div className="map-empty">
                <p>{mapError}</p>
                <button className="outline" onClick={refresh}>
                  Try again
                </button>
              </div>
            ) : mapItems.length ? (
              <div className="map-result-list">
                {mapItems.slice(0, 8).map(item => (
                  <MapResult key={item.id} item={item} onClick={() => openItem(item)} />
                ))}
              </div>
            ) : (
              <div className="map-empty">
                <MapPin size={25} />
                <strong>No pinned items yet</strong>
                <p>Try another filter or switch to the list for older reports without a map pin.</p>
              </div>
            )}
            <div className="map-footer-note">
              <ShieldCheck size={16} /> Map pins show item locations, not student locations.
            </div>
          </aside>
        </motion.div>
      ) : loading ? (
        <div className="item-grid">
          {Array.from({length: 6}, (_, i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      ) : items.length ? (
        <motion.div layout className="item-grid">
          <AnimatePresence mode="popLayout">
            {items.map((item, i) => (
              <ItemCard key={item.id} item={item} index={i} onClick={() => openItem(item)} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="empty">
          <Search size={35} />
          <h3>No items here just yet.</h3>
          <p>Try another category or location, or post your own report.</p>
          <button
            className="outline"
            onClick={() => {
              setCategory('');
              setVenue('');
              setSearch('');
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      {viewMode === 'list' && total > 12 && (
        <div className="pagination">
          <button
            className="outline"
            disabled={num === 1}
            onClick={() => setNum(n => n - 1)}
          >
            Previous
          </button>
          <span>
            Page {num} of {Math.ceil(total / 12)}
          </span>
          <button
            className="outline"
            disabled={num * 12 >= total}
            onClick={() => setNum(n => n + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

function MapResult({item, onClick}) {
  const Icon = icons[item.category] || Package;
  return (
    <button className="map-result" onClick={onClick}>
      <span className={'map-result-icon ' + item.kind}>
        <Icon size={17} />
      </span>
      <span className="map-result-copy">
        <small>
          {item.kind === 'found' ? 'FOUND' : 'LOST'} · {item.category}
        </small>
        <strong>{item.title}</strong>
        <span>
          <MapPin size={13} />
          {item.venue}
        </span>
      </span>
      <ArrowUpRight size={16} />
    </button>
  );
}

function ItemCard({item, index, onClick}) {
  const Icon = icons[item.category] || Package;
  return (
    <motion.button
      layout
      initial={{opacity: 0, y: 24}}
      animate={{opacity: 1, y: 0}}
      exit={{opacity: 0, scale: 0.95}}
      transition={{delay: index * 0.05}}
      onClick={onClick}
      className="item-card"
    >
      <div className={'item-visual visual-' + item.category.replaceAll(' ', '-').toLowerCase()}>
        <span className={'badge ' + item.kind}>
          <span />
          {item.kind === 'found' ? 'Found' : 'Lost'}
        </span>
        {item.has_photo ? (
          <img
            className="item-card-photo"
            src={`/api/items/${item.id}/photo`}
            alt=""
            loading="lazy"
          />
        ) : (
          <Icon className="object-icon" strokeWidth={1.3} size={88} />
        )}
        <span className="visual-label">{item.category.toUpperCase()}</span>
        <span className="visual-ring" />
      </div>
      <div className="card-body">
        <div className="card-category">
          {item.category}
          <span>
            {new Date(item.occurred_on + 'T00:00:00').toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <div className="card-bottom">
          <span>
            <MapPin size={14} />
            {item.venue}
          </span>
          <span className="card-arrow">
            <ArrowUpRight size={18} />
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function Modal({title, close, children}) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const key = e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const a = ref.current.querySelectorAll('button:not(:disabled),input,textarea,select,a[href]');
        if (!a.length) return;
        const first = a[0],
          last = a[a.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [close]);

  return (
    <motion.div
      className="modal-backdrop"
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
      onClick={e => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <motion.section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        initial={{y: 30, scale: 0.96}}
        animate={{y: 0, scale: 1}}
        exit={{y: 30, opacity: 0}}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">VIT REUNITE</span>
            <h2>{title}</h2>
          </div>
          <button className="close" aria-label="Close dialog" onClick={close}>
            <X />
          </button>
        </div>
        {children}
      </motion.section>
    </motion.div>
  );
}

function Form({children, onSubmit, label = 'Submit', busy, setBusy, error, setError, canSubmit = true}) {
  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const formData = new FormData(e.currentTarget);
        try {
          await onSubmit(Object.fromEntries(formData), formData);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <button className="primary form-submit" disabled={busy || !canSubmit}>
        {busy ? <LoaderCircle className="spin" size={17} /> : null}
        {busy ? 'Please wait…' : label}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}

class DialogBoundary extends React.Component {
  state = {failed: false};
  static getDerivedStateFromError() {
    return {failed: true};
  }
  componentDidCatch(error) {
    console.error('Item detail failed to render.', error);
  }
  render() {
    return this.state.failed ? (
      <div className="empty dialog-recovery" role="alert">
        <ShieldCheck size={27} />
        <h3>This item could not be opened.</h3>
        <p>Your place on the board is safe. Close this card and open it again.</p>
        <button className="outline" onClick={this.props.onClose}>
          Close item
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

class MapErrorBoundary extends React.Component {
  state = {failed: false, error: ''};
  static getDerivedStateFromError(e) {
    return {failed: true, error: e?.message || 'Map could not load'};
  }
  componentDidCatch(error) {
    console.error('MapboxMap failed to render.', error);
  }
  render() {
    return this.state.failed ? (
      <div
        className="map-fallback"
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MapPin size={22} />
        <span>Map could not load</span>
        <small style={{opacity: 0.7, textAlign: 'center'}}>{this.state.error}</small>
      </div>
    ) : (
      this.props.children
    );
  }
}

function PhotoField({label = 'Add a photo', hint = 'JPEG, PNG, or WebP · up to 5 MB', privatePhoto = false}) {
  const [preview, setPreview] = useState(''),
    [error, setError] = useState('');
  const input = useRef(null),
    previewRef = useRef('');

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    []
  );

  const clear = () => {
    if (input.current) input.current.value = '';
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = '';
    setPreview('');
    setError('');
  };

  const choose = e => {
    const file = e.target.files?.[0];
    setError('');
    if (!file) {
      clear();
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      clear();
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      clear();
      setError('Photos must be 5 MB or smaller.');
      return;
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = URL.createObjectURL(file);
    setPreview(previewRef.current);
  };

  return (
    <div className={'photo-upload ' + (privatePhoto ? 'photo-upload-private' : '')}>
      <div className="photo-upload-label">
        <span>{label}</span>
        <small>{hint}</small>
      </div>
      <div className="photo-picker-area">
        {preview && (
          <div className="photo-preview">
            <img src={preview} alt="Selected photo preview" />
            <button type="button" className="outline" onClick={clear}>
              Remove photo
            </button>
          </div>
        )}
        <label className="photo-picker">
          <input
            ref={input}
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={choose}
          />
          <ImagePlus size={20} />
          <span>{preview ? 'Replace photo' : 'Choose photo'}</span>
          <small>{preview ? 'Selected and ready to upload' : 'No photo selected'}</small>
        </label>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function Field({label, ...props}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

// Authentication with sign-in, signup, forgot password & reset password (G-10)
function Auth({onSuccess, notify}) {
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  return (
    <>
      <div className="privacy-note">
        <ShieldCheck size={20} /> VIT email verification. Your personal details never appear on the board.
      </div>

      <div className="feed-tabs auth-tabs">
        <button
          className={tab === 'login' ? 'selected' : ''}
          onClick={() => {
            setTab('login');
            setError('');
          }}
        >
          Sign in
        </button>
        <button
          className={tab === 'register' ? 'selected' : ''}
          onClick={() => {
            setTab('register');
            setError('');
          }}
        >
          Create account
        </button>
      </div>

      {message ? (
        <div className="empty">
          <CheckCircle2 size={32} />
          <h3>Check your email</h3>
          <p>{message}</p>
          <button
            className="outline"
            onClick={() => {
              setMessage('');
              setTab('login');
            }}
          >
            Back to sign in
          </button>
        </div>
      ) : tab === 'forgot' ? (
        <div>
          <h3>Forgot your password?</h3>
          <p className="small-note">
            Enter your registered VIT student email. If registered, we will dispatch a password reset link.
          </p>
          <Form
            busy={busy}
            setBusy={setBusy}
            error={error}
            setError={setError}
            label="Send reset link"
            onSubmit={async v => {
              const res = await post('/auth/forgot-password', v);
              setMessage(res.message);
            }}
          >
            <Field
              label="VIT email address"
              name="email"
              type="email"
              placeholder="you@vitstudent.ac.in"
              required
              autoComplete="email"
            />
          </Form>
          <div className="auth-sub-actions">
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setTab('reset');
                setError('');
              }}
            >
              Have a reset token? Enter it here
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setTab('login');
                setError('');
              }}
            >
              Back to sign in
            </button>
          </div>
        </div>
      ) : tab === 'reset' ? (
        <div>
          <h3>Set a new password</h3>
          <p className="small-note">Enter your 64-character reset token and your new strong password.</p>
          <Form
            busy={busy}
            setBusy={setBusy}
            error={error}
            setError={setError}
            label="Update password"
            onSubmit={async v => {
              const res = await post('/auth/reset-password', v);
              notify(res.message);
              setTab('login');
            }}
          >
            <Field
              label="Reset token (from email / console)"
              name="token"
              placeholder="64-character token"
              required
              pattern="[a-f0-9]{64}"
            />
            <Field
              label="New password · at least 10 characters"
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
            />
          </Form>
          <div className="auth-sub-actions">
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setTab('login');
                setError('');
              }}
            >
              Back to sign in
            </button>
          </div>
        </div>
      ) : (
        <Form
          busy={busy}
          setBusy={setBusy}
          error={error}
          setError={setError}
          label={tab === 'register' ? 'Create student account' : 'Sign in'}
          onSubmit={async v => {
            if (tab === 'register') {
              const d = await post('/auth/register', v);
              setMessage(d.message);
            } else {
              const d = await post('/auth/login', v);
              onSuccess(d.user);
            }
          }}
        >
          {tab === 'register' && (
            <>
              <Field label="Your name" name="name" required minLength={2} maxLength={70} autoComplete="name" />
              <Field
                label="Registration number (private)"
                name="registration"
                placeholder="24BIT1234"
                required
                pattern="[0-9]{2}[A-Za-z]{3}[0-9]{4,5}"
              />
            </>
          )}
          <Field
            label="VIT email address"
            name="email"
            type="email"
            placeholder="you@vitstudent.ac.in"
            required
            autoComplete="email"
          />
          <Field
            label={tab === 'register' ? 'Password · at least 10 characters' : 'Password'}
            name="password"
            type="password"
            required
            minLength={tab === 'register' ? 10 : 1}
            maxLength={128}
            autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
          />
          {tab === 'login' && (
            <div className="auth-forgot-row">
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  setTab('forgot');
                  setError('');
                }}
              >
                Forgot your password?
              </button>
            </div>
          )}
        </Form>
      )}

      <p className="small-note">
        Local demo: student@vitstudent.ac.in or finder@vitstudent.ac.in
        <br />
        Password: CampusDemo2026! · requires <code>npm run db:seed</code>
      </p>
    </>
  );
}

// Report Creation with optional secret clue for finders (G-8)
function Report({meta, kind, done}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [pin, setPin] = useState(null),
    [selectedKind, setSelectedKind] = useState(kind);

  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const coords = pin ? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}` : '';

  return (
    <>
      <div className="privacy-note">
        <Lock size={19} /> Share only the item’s location. The map never follows or stores your movement.
      </div>
      <Form
        busy={busy}
        setBusy={setBusy}
        error={error}
        setError={setError}
        canSubmit={Boolean(pin)}
        label="Publish campus report"
        onSubmit={async (_v, formData) => done((await postFormData('/items', formData)).message)}
      >
        <div className="report-step">
          <span>01 · THE ITEM</span>
          <h3>What went missing?</h3>
        </div>
        <label className="field">
          <span>Report type</span>
          <select
            name="kind"
            value={selectedKind}
            onChange={e => setSelectedKind(e.target.value)}
          >
            <option value="lost">I lost an item</option>
            <option value="found">I found an item</option>
          </select>
        </label>
        <Field
          label="Short item name"
          name="title"
          placeholder="e.g. Black Casio scientific calculator"
          required
          minLength={5}
          maxLength={100}
        />
        <div className="form-row">
          <label className="field">
            <span>Category</span>
            <select name="category" required>
              {meta.categories.map(v => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <Field
            label="Date lost / found"
            name="occurred_on"
            type="date"
            defaultValue={today}
            max={today}
            required
          />
        </div>
        <div className="report-step report-step-location">
          <span>02 · THE LOCATION</span>
          <h3>Pin the spot on campus</h3>
          <p>Choose the official landmark, then tap or drag the map pin to where you last saw it.</p>
        </div>
        <label className="field">
          <span>Campus landmark</span>
          <select name="venue" required>
            {meta.venues.map(v => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <div className="report-map">
          <MapErrorBoundary>
            <Suspense fallback={<div className="map-fallback">Loading the campus map…</div>}>
              <MapboxMap mode="picker" location={pin} onLocationChange={setPin} />
            </Suspense>
          </MapErrorBoundary>
          <div className="map-picker-hint">
            <MapPin size={15} /> Tap the map or drag the pin to refine the spot
          </div>
        </div>
        <div className={'pin-status ' + (pin ? 'is-set' : '')}>
          {pin ? (
            <>
              <CheckCircle2 size={17} />
              <span>Location pinned</span>
              <code>{coords}</code>
            </>
          ) : (
            <>
              <LocateFixed size={17} />
              <span>Location required</span>
              <small>Use the crosshair to locate yourself, or tap the map.</small>
            </>
          )}
        </div>
        <input type="hidden" name="latitude" value={pin?.latitude ?? ''} />
        <input type="hidden" name="longitude" value={pin?.longitude ?? ''} />

        <div className="report-step">
          <span>03 · KEEP IT SAFE</span>
          <h3>Add public details and a private check</h3>
        </div>
        <label className="field">
          <span>Public description</span>
          <textarea
            name="description"
            rows={3}
            placeholder="General appearance. Keep the unique ownership clue private."
            required
            minLength={15}
            maxLength={1000}
          />
        </label>
        <PhotoField label="Item photo (optional, public)" hint="Visible on the campus board · avoid IDs, serial numbers, and faces" />

        <label className="field">
          <span>
            {selectedKind === 'found' ? 'Ownership verification question' : 'Question for the person who finds it'}
          </span>
          <textarea
            name="challenge"
            rows={2}
            placeholder="e.g. What model is it, and what is written on the back?"
            required
            minLength={8}
            maxLength={250}
          />
          <small>The question is visible; the answer stays private. Never post the answer here.</small>
        </label>

        {selectedKind === 'found' && (
          <label className="field">
            <span>Expected answer / secret clue (optional, private to you)</span>
            <input
              type="text"
              name="expected_answer"
              placeholder="e.g. Blue star sticker on back, serial number ending in 42"
              maxLength={500}
            />
            <small>Stored securely for your eyes only to help quickly verify incoming requests.</small>
          </label>
        )}
      </Form>
    </>
  );
}

// Edit Report Component (G-4: Owner Edit)
function EditReport({item, meta, done}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const initialPin =
    item.latitude != null && item.longitude != null
      ? {latitude: Number(item.latitude), longitude: Number(item.longitude)}
      : null;
  const [pin, setPin] = useState(initialPin);

  return (
    <>
      <div className="privacy-note">
        <Edit3 size={18} /> Update your report details. Changes will reflect live on the campus board.
      </div>
      <Form
        busy={busy}
        setBusy={setBusy}
        error={error}
        setError={setError}
        label="Save changes"
        onSubmit={async (_v, formData) => {
          const res = await postFormData('/items/' + item.id, formData, 'PATCH');
          done(res.message);
        }}
      >
        <Field
          label="Short item name"
          name="title"
          defaultValue={item.title}
          required
          minLength={5}
          maxLength={100}
        />
        <div className="form-row">
          <label className="field">
            <span>Category</span>
            <select name="category" defaultValue={item.category} required>
              {meta.categories.map(v => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <Field
            label="Date lost / found"
            name="occurred_on"
            type="date"
            defaultValue={item.occurred_on}
            max={new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <label className="field">
          <span>Campus landmark</span>
          <select name="venue" defaultValue={item.venue} required>
            {meta.venues.map(v => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <div className="report-map">
          <MapErrorBoundary>
            <Suspense fallback={<div className="map-fallback">Loading the campus map…</div>}>
              <MapboxMap mode="picker" location={pin} onLocationChange={setPin} />
            </Suspense>
          </MapErrorBoundary>
          <div className="map-picker-hint">
            <MapPin size={15} /> Tap the map or drag the pin to update location
          </div>
        </div>
        <input type="hidden" name="latitude" value={pin?.latitude ?? ''} />
        <input type="hidden" name="longitude" value={pin?.longitude ?? ''} />

        <label className="field">
          <span>Public description</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={item.description}
            required
            minLength={15}
            maxLength={1000}
          />
        </label>
        <PhotoField
          label="Replace item photo (optional)"
          hint="Leave empty to retain existing photo"
        />
        <label className="field">
          <span>Verification question</span>
          <textarea
            name="challenge"
            rows={2}
            defaultValue={item.challenge}
            required
            minLength={8}
            maxLength={250}
          />
        </label>
        {item.kind === 'found' && (
          <label className="field">
            <span>Expected answer clue (private to you)</span>
            <input
              type="text"
              name="expected_answer"
              defaultValue={item.expected_answer || ''}
              placeholder="e.g. Unique sticker or inscription"
              maxLength={500}
            />
          </label>
        )}
      </Form>
    </>
  );
}

// Item Detail with Abuse Reporting (G-9)
function ItemDetail({item, user, signIn, onViewLocation, done, notify}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [flagOpen, setFlagOpen] = useState(false),
    [flagBusy, setFlagBusy] = useState(false),
    [flagReported, setFlagReported] = useState(false);

  const Icon = icons[item.category] || Package;
  const hasPinnedLocation =
    item.latitude != null &&
    item.longitude != null &&
    Number.isFinite(Number(item.latitude)) &&
    Number.isFinite(Number(item.longitude));

  const handleReportAbuse = async e => {
    e.preventDefault();
    setFlagBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await post('/items/' + item.id + '/reports', Object.fromEntries(fd));
      setFlagReported(true);
      setFlagOpen(false);
      notify('Thank you. This listing has been reported to campus moderators.');
    } catch (err) {
      notify(err.message);
    } finally {
      setFlagBusy(false);
    }
  };

  return (
    <>
      <div className={'detail-visual ' + (item.has_photo ? 'detail-has-photo' : '')}>
        {item.has_photo ? (
          <img src={`/api/items/${item.id}/photo`} alt={`Photo of ${item.title}`} />
        ) : (
          <Icon size={56} strokeWidth={1.35} />
        )}
        <span className={'badge ' + item.kind}>{item.kind === 'found' ? 'Found' : 'Lost'}</span>
      </div>
      <div className="detail-summary">
        <div>
          <span className="eyebrow">{item.category}</span>
          <p>
            <MapPin size={15} />
            {item.venue} · {item.occurred_on}
          </p>
        </div>
      </div>
      <p className="description">{item.description}</p>
      <div className="item-location">
        <div className="item-location-head">
          <span>
            <MapPin size={16} /> Reported item location
          </span>
          {hasPinnedLocation && (
            <small>
              {Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}
            </small>
          )}
        </div>
        <div className="item-location-summary">
          <strong>{item.venue}</strong>
          <span>
            {hasPinnedLocation
              ? 'Exact map pin saved for the last-seen or recovery spot.'
              : 'Campus landmark only; no exact map pin was supplied.'}
          </span>
          {hasPinnedLocation && (
            <button type="button" className="outline" onClick={onViewLocation}>
              View on live map <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="privacy-note">
        <ShieldCheck size={20} /> The reporter’s identity and contact information stay private.
      </div>
      <h3>{item.kind === 'found' ? 'Is this yours?' : 'Have you recovered this item?'}</h3>
      <p className="small-note">
        Answer the verification question. The reporter will privately review your request.
      </p>
      <div className="challenge">
        <Lock size={16} />
        {item.challenge}
      </div>
      {user ? (
        <Form
          busy={busy}
          setBusy={setBusy}
          error={error}
          setError={setError}
          label="Send verification request"
          onSubmit={async (_v, formData) =>
            done((await postFormData(`/items/${item.id}/claims`, formData)).message)
          }
        >
          <label className="field">
            <span>Your private verification answer</span>
            <textarea
              rows={4}
              name="answer"
              required
              minLength={10}
              maxLength={1500}
              placeholder="Share the details only a legitimate owner or finder would know…"
            />
          </label>
          <PhotoField
            label="Ownership photo (optional, private)"
            hint="Only you and the reporter can view this proof"
            privatePhoto
          />
        </Form>
      ) : (
        <button className="primary form-submit" onClick={signIn}>
          Sign in to submit a request <ArrowRight size={17} />
        </button>
      )}

      {/* Flag / Report Abuse (G-9) */}
      <div className="abuse-report-strip">
        {flagReported ? (
          <span className="small-note">
            <CheckCircle2 size={14} /> Listing reported for campus review.
          </span>
        ) : !flagOpen ? (
          <button
            type="button"
            className="text-btn flag-link"
            onClick={() => (user ? setFlagOpen(true) : signIn())}
          >
            <Flag size={13} /> Report listing for spam or policy violation
          </button>
        ) : (
          <form className="flag-form" onSubmit={handleReportAbuse}>
            <h4>Report this listing</h4>
            <label className="field">
              <span>Reason</span>
              <select name="reason" required>
                <option value="spam">Spam or duplicate listing</option>
                <option value="inappropriate">Inappropriate text or image</option>
                <option value="scam">Suspected scam / false claim</option>
                <option value="other">Other campus policy issue</option>
              </select>
            </label>
            <label className="field">
              <span>Optional note for moderators</span>
              <textarea
                name="note"
                rows={2}
                maxLength={500}
                placeholder="Describe why this listing should be reviewed…"
              />
            </label>
            <div className="flag-buttons">
              <button className="outline" type="submit" disabled={flagBusy}>
                {flagBusy ? 'Submitting…' : 'Submit report'}
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={() => setFlagOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

// Dashboard with Cancel Handoff (G-3), Owner Edit/Withdraw (G-4), Secret Clue (G-8)
function Dashboard({revision, refresh, notify, openThread, openEdit, report}) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');

  useEffect(() => {
    let alive = true;
    api('/dashboard')
      .then(d => {
        if (alive) {
          setData(d);
          setError('');
        }
      })
      .catch(e => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [revision]);

  const act = async (id, fn) => {
    setBusy(id);
    try {
      notify((await fn()).message);
      refresh();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="dashboard">
      <div className="section-head">
        <div>
          <span className="eyebrow">YOUR PRIVATE SPACE</span>
          <h1>Every return starts here.</h1>
          <p>Review requests, follow your claims, and coordinate a safe handoff.</p>
        </div>
        <button className="primary" onClick={report}>
          <Plus size={18} />
          New report
        </button>
      </div>
      {error ? (
        <div className="empty" role="alert">
          <p>{error}</p>
          <button onClick={refresh}>Retry</button>
        </div>
      ) : !data ? (
        <div className="skeleton" />
      ) : (
        <>
          <div className="dash-stats">
            {[
              ['Your reports', data.items.length],
              [
                'Awaiting review',
                data.claims.filter(c => c.role === 'reporter' && c.status === 'pending').length,
              ],
              [
                'Approved handoffs',
                data.claims.filter(c => c.status === 'approved' && c.item_status !== 'resolved').length,
              ],
            ].map(([t, n]) => (
              <div key={t}>
                <span>{t}</span>
                <strong>{n}</strong>
              </div>
            ))}
          </div>

          <h2>Verification requests</h2>
          {!data.claims.length ? (
            <div className="empty">
              <ShieldCheck size={30} />
              <h3>Your requests will appear here.</h3>
              <p>Submit a claim on the board, or wait for a request on your report.</p>
            </div>
          ) : (
            data.claims.map(c => (
              <motion.article
                initial={{opacity: 0, y: 10}}
                animate={{opacity: 1, y: 0}}
                className="request-card"
                key={c.id}
              >
                <div className="request-head">
                  <div>
                    <span className="eyebrow">
                      {c.role === 'reporter' ? 'INCOMING REQUEST' : 'YOUR REQUEST'}
                    </span>
                    <h3>{c.title}</h3>
                  </div>
                  <span className={'status status-' + c.status}>
                    {c.item_status === 'resolved' ? 'Resolved' : c.status}
                  </span>
                </div>
                <p className="small-note">Question: {c.challenge}</p>
                <div className="private-answer">
                  <Lock size={15} />
                  <p>{c.answer}</p>
                </div>

                {/* G-8 Expected answer & match hint for finder */}
                {c.role === 'reporter' && c.expected_answer && (
                  <div className="clue-review-card">
                    <div className="clue-review-inner">
                      <span>
                        <Lock size={13} /> Your private clue: <strong>{c.expected_answer}</strong>
                      </span>
                      {c.match_hint && (
                        <span
                          className={
                            'hint-badge ' +
                            (c.match_hint === 'Looks similar' ? 'hint-match' : 'hint-miss')
                          }
                        >
                          {c.match_hint === 'Looks similar'
                            ? '✓ Answers look similar'
                            : '✗ Answers differ'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {c.has_proof_photo && (
                  <div className="proof-photo">
                    <span>
                      <Lock size={14} /> Private photo proof · shared only with you and the reporter
                    </span>
                    <img
                      src={`/api/claims/${c.id}/proof-photo`}
                      alt="Private ownership proof photo"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="request-actions">
                  {c.role === 'reporter' && c.status === 'pending' && (
                    <>
                      <button
                        disabled={busy === c.id}
                        className="primary"
                        onClick={() => act(c.id, () => post('/claims/' + c.id, {status: 'approved'}, 'PATCH'))}
                      >
                        <Check size={17} />
                        Approve
                      </button>
                      <button
                        disabled={busy === c.id}
                        className="outline"
                        onClick={() => act(c.id, () => post('/claims/' + c.id, {status: 'rejected'}, 'PATCH'))}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {c.status === 'approved' && (
                    <>
                      <button className="primary" onClick={() => openThread(c.id)}>
                        <MessageCircle size={17} />
                        Private handoff
                      </button>
                      {/* G-3 Cancel handoff control */}
                      {c.item_status !== 'resolved' && (
                        <button
                          disabled={busy === c.id}
                          className="outline danger-btn"
                          onClick={() => {
                            if (confirm('Cancel this handoff and return the item to the active board?'))
                              act(c.id, () => post('/claims/' + c.id + '/cancel-handoff', {}));
                          }}
                        >
                          Cancel handoff
                        </button>
                      )}
                      {c.item_status !== 'resolved' && (
                        <button
                          disabled={busy === c.id}
                          className="outline"
                          onClick={() => {
                            if (confirm('Confirm that the item has been returned?'))
                              act(c.id, () => post('/items/' + c.item_id + '/resolve', {}));
                          }}
                        >
                          Mark returned <CheckCircle2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                  {c.status === 'pending' && c.role === 'claimant' && (
                    <span className="small-note">
                      <Clock size={15} /> Awaiting the reporter’s review
                    </span>
                  )}
                </div>
              </motion.article>
            ))
          )}

          <h2>Your reports</h2>
          {!data.items.length ? (
            <div className="empty">
              <p>You haven’t posted a report yet.</p>
            </div>
          ) : (
            <div className="report-list">
              {data.items.map(i => (
                <div key={i.id}>
                  <span className="report-symbol">
                    {React.createElement(icons[i.category] || Package, {size: 23})}
                  </span>
                  <div>
                    <h3>{i.title}</h3>
                    <p>
                      {i.venue} · {i.kind}
                    </p>
                  </div>
                  <span className={'status status-' + i.status}>{i.status}</span>
                  <div className="report-row-actions">
                    {/* G-4 Owner Edit and Withdraw Controls */}
                    {i.status === 'active' && (
                      <>
                        <button
                          disabled={busy === i.id}
                          className="outline"
                          onClick={() => openEdit(i)}
                        >
                          <Edit3 size={14} /> Edit
                        </button>
                        <button
                          disabled={busy === i.id}
                          className="outline danger-btn"
                          onClick={() => {
                            if (confirm('Withdraw this report from the campus board?')) {
                              act(i.id, () => api('/items/' + i.id, {method: 'DELETE'}));
                            }
                          }}
                        >
                          <Trash2 size={14} /> Withdraw
                        </button>
                      </>
                    )}
                    {i.status !== 'resolved' && (
                      <button
                        disabled={busy === i.id}
                        className="outline"
                        onClick={() => {
                          if (confirm('Confirm that the item has been returned?'))
                            act(i.id, () => post('/items/' + i.id + '/resolve', {}));
                        }}
                      >
                        Mark returned
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Private Thread with Meetup State Machine (G-6) and Cancel Handoff (G-3)
function Thread({id, meta, notify, refresh}) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [body, setBody] = useState(''),
    [busy, setBusy] = useState(false),
    [meetBusy, setMeetBusy] = useState(false),
    [meetError, setMeetError] = useState('');

  const load = useCallback(
    () =>
      api('/claims/' + id + '/thread')
        .then(setData)
        .catch(e => setError(e.message)),
    [id]
  );

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (error) return <div className="form-error">{error}</div>;
  if (!data) return <div className="skeleton" />;

  const meetupStatus = data.claim.meetup_status || 'proposed';

  return (
    <>
      <div className="privacy-note">
        <ShieldCheck /> Only you and the other student can access this anonymous thread.
      </div>
      <h3>{data.claim.title}</h3>

      {/* G-6 Meetup State Machine Display */}
      {data.claim.checkpoint && (
        <div className={'meetup-card meetup-box-' + meetupStatus}>
          <MapPin size={22} />
          <div className="meetup-card-body">
            <div className="meetup-card-top">
              <strong>{data.claim.checkpoint}</strong>
              <span className={'meetup-badge status-' + meetupStatus}>
                {meetupStatus === 'accepted'
                  ? 'Confirmed'
                  : meetupStatus === 'declined'
                    ? 'Declined'
                    : 'Proposed'}
              </span>
            </div>
            <p>
              {new Date(data.claim.meetup_at).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
              })}{' '}
              IST
            </p>
            {meetupStatus === 'accepted' ? (
              <small className="meetup-msg-ok">
                <Check size={14} /> Both students agreed on this checkpoint. Meet safely at the staffed reception.
              </small>
            ) : meetupStatus === 'declined' ? (
              <small className="meetup-msg-declined">
                Proposal declined. Suggest an alternate checkpoint or time below.
              </small>
            ) : data.claim.meetup_mine ? (
              <small className="meetup-msg-waiting">
                <Clock size={13} /> You proposed this meetup. Awaiting confirmation from the other student.
              </small>
            ) : (
              <div className="meetup-action-buttons">
                <button
                  type="button"
                  className="primary mini-btn"
                  onClick={async () => {
                    try {
                      await post(`/claims/${id}/meetup/accept`, {});
                      notify('Meetup checkpoint confirmed!');
                      await load();
                      refresh();
                    } catch (e) {
                      notify(e.message);
                    }
                  }}
                >
                  <Check size={14} /> Accept checkpoint
                </button>
                <button
                  type="button"
                  className="outline mini-btn"
                  onClick={async () => {
                    try {
                      await post(`/claims/${id}/meetup/decline`, {});
                      notify('Meetup proposal declined.');
                      await load();
                      refresh();
                    } catch (e) {
                      notify(e.message);
                    }
                  }}
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="messages" aria-live="polite">
        {!data.messages.length ? (
          <div className="empty">
            <MessageCircle />
            <p>Say hello and agree on a staffed campus checkpoint.</p>
          </div>
        ) : (
          data.messages.map(m => (
            <div key={m.id} className={'message ' + (m.mine ? 'mine' : '') + (m.label === 'System' ? ' system-msg' : '')}>
              <small>{m.mine ? 'You' : m.label}</small>
              <p>{m.body}</p>
              <time>
                {new Date(m.created_at + 'Z').toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          ))
        )}
      </div>

      {data.claim.item_status === 'resolved' ? (
        <div className="privacy-note">
          <CheckCircle2 /> This item is reunited. The thread is read-only.
        </div>
      ) : (
        <>
          <form
            className="message-form"
            onSubmit={async e => {
              e.preventDefault();
              setBusy(true);
              try {
                await post('/claims/' + id + '/messages', {body});
                setBody('');
                await load();
              } catch (e) {
                notify(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              aria-label="Private message"
              placeholder="Agree on a safe return…"
              value={body}
              onChange={e => setBody(e.target.value)}
              required
              maxLength={1500}
            />
            <button className="primary" disabled={busy} aria-label="Send message">
              <Send size={18} />
            </button>
          </form>

          <details className="meetup-form">
            <summary>
              Propose a campus meetup <MapPin size={15} />
            </summary>
            <Form
              busy={meetBusy}
              setBusy={setMeetBusy}
              error={meetError}
              setError={setMeetError}
              label="Save meetup proposal"
              onSubmit={async v => {
                const d = await post(
                  '/claims/' + id + '/meetup',
                  {...v, meetup_at: new Date(v.meetup_at).toISOString()},
                  'PATCH'
                );
                notify(d.message);
                await load();
                refresh();
              }}
            >
              <label className="field">
                <span>Staffed checkpoint</span>
                <select name="checkpoint">
                  {meta.checkpoints.map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <Field
                label="Meetup date and time (your local timezone)"
                type="datetime-local"
                name="meetup_at"
                required
              />
            </Form>
          </details>

          {/* G-3 Cancel handoff button inside thread */}
          <div className="thread-bottom-bar">
            <button
              type="button"
              className="text-btn danger-text"
              onClick={async () => {
                if (confirm('Cancel this handoff and return the item to the active campus board?')) {
                  try {
                    await post(`/claims/${id}/cancel-handoff`, {});
                    notify('Handoff cancelled. Item returned to board.');
                    await load();
                    refresh();
                  } catch (e) {
                    notify(e.message);
                  }
                }
              }}
            >
              Cancel handoff
            </button>
          </div>
        </>
      )}
    </>
  );
}

// Admin Moderation Panel (G-9)
function AdminModeration({notify, refresh, openItem, onBack}) {
  const [reports, setReports] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');

  const loadReports = useCallback(() => {
    setLoading(true);
    api('/admin/reports')
      .then(d => {
        setReports(d.reports || []);
        setError('');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleDeleteItem = async (itemId, reportId) => {
    if (!confirm('Are you sure you want to permanently delete this listing and its attached files?'))
      return;
    setBusy(reportId);
    try {
      await api('/admin/items/' + itemId, {method: 'DELETE'});
      notify('Offending listing removed.');
      loadReports();
      refresh();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="dashboard admin-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">CAMPUS ADMINISTRATION</span>
          <h1>Listing Moderation Queue</h1>
          <p>Review reports flagged by students for spam, policy violations, or improper content.</p>
        </div>
        <button className="outline" onClick={onBack}>
          Back to board
        </button>
      </div>

      {loading ? (
        <div className="skeleton" />
      ) : error ? (
        <div className="empty" role="alert">
          <p>{error}</p>
          <button className="outline" onClick={loadReports}>
            Retry
          </button>
        </div>
      ) : !reports.length ? (
        <div className="empty">
          <ShieldCheck size={36} />
          <h3>All clear</h3>
          <p>No listings are currently flagged for review. The campus noticeboard is healthy!</p>
        </div>
      ) : (
        <div className="admin-reports-grid">
          {reports.map(r => (
            <div className="admin-report-card" key={r.id}>
              <div className="admin-card-head">
                <span className={'reason-pill reason-' + r.reason}>{r.reason}</span>
                <time>{new Date(r.created_at).toLocaleDateString('en-IN')}</time>
              </div>
              <h3>{r.item_title}</h3>
              <p className="small-note">
                Venue: <strong>{r.item_venue}</strong> · Reporter: {r.reporter_name} ({r.reporter_email})
              </p>
              {r.note && (
                <div className="admin-report-note">
                  <AlertTriangle size={14} />
                  <span>"{r.note}"</span>
                </div>
              )}
              <div className="admin-card-actions">
                <button
                  className="outline"
                  onClick={() =>
                    openItem({
                      id: r.item_id,
                      title: r.item_title,
                      venue: r.item_venue,
                      category: 'Lab Equipment',
                      description: 'Reported listing under moderation.',
                      occurred_on: '2026-09-01',
                      challenge: 'Inspection',
                    })
                  }
                >
                  Inspect item
                </button>
                <button
                  className="primary danger-btn"
                  disabled={busy === r.id}
                  onClick={() => handleDeleteItem(r.item_id, r.id)}
                >
                  <Trash2 size={15} /> Remove listing
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
