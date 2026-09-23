import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, HelpCircle, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../../components/Button';
import { DadJokeModal } from '../../components/DadJokeModal';
import { TutorialModal } from '../../components/TutorialModal';
import { TUTORIALS } from '../../components/tutorials';
import api from '../../utils/api';

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
const DB_NAME = 'jigsawPhotoDB', DB_VER = 1, STORE = 'photos';
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}
async function idbOp(mode, fn) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}
const getPhotos   = ()  => idbOp('readonly',  s => s.getAll());
const savePhoto   = p   => idbOp('readwrite', s => s.put(p));
const deletePhoto = id  => idbOp('readwrite', s => s.delete(id));

// ── Jigsaw shape engine ───────────────────────────────────────────────────────

/** Draw a horizontal edge from (x0,y) → (x1,y). tabAmt > 0 goes up, < 0 goes down. */
function hEdge(ctx, x0, y, x1, tabAmt) {
  if (tabAmt === 0) { ctx.lineTo(x1, y); return; }
  const w = x1 - x0;
  ctx.lineTo(x0 + w * 0.3, y);
  ctx.bezierCurveTo(x0 + w * 0.3, y - tabAmt * 0.5, x0 + w * 0.4, y - tabAmt, x0 + w * 0.5, y - tabAmt);
  ctx.bezierCurveTo(x0 + w * 0.6, y - tabAmt, x0 + w * 0.7, y - tabAmt * 0.5, x0 + w * 0.7, y);
  ctx.lineTo(x1, y);
}

/** Draw a vertical edge from (x,y0) → (x,y1). tabAmt > 0 goes right, < 0 goes left. */
function vEdge(ctx, x, y0, y1, tabAmt) {
  if (tabAmt === 0) { ctx.lineTo(x, y1); return; }
  const h = y1 - y0;
  ctx.lineTo(x, y0 + h * 0.3);
  ctx.bezierCurveTo(x + tabAmt * 0.5, y0 + h * 0.3, x + tabAmt, y0 + h * 0.4, x + tabAmt, y0 + h * 0.5);
  ctx.bezierCurveTo(x + tabAmt, y0 + h * 0.6, x + tabAmt * 0.5, y0 + h * 0.7, x, y0 + h * 0.7);
  ctx.lineTo(x, y1);
}

/**
 * Draw the jigsaw clip path for one piece.
 * edges: { top, right, bottom, left } — +1 = tab sticks out, -1 = notch, 0 = flat border
 * tabDepth: pixel depth of tab
 */
function drawJigsawPath(ctx, ox, oy, pw, ph, td, edges) {
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  // hEdge bulges up for a positive amount and vEdge bulges right, whichever way
  // the edge is traced. So "+1 = tab sticks out" means +td on the top and right
  // edges but −td on the bottom (a tab goes down) and left (a tab goes left).
  hEdge(ctx, ox, oy, ox + pw, edges.top * td);               // TOP: left → right
  vEdge(ctx, ox + pw, oy, oy + ph, edges.right * td);        // RIGHT: top → bottom
  hEdge(ctx, ox + pw, oy + ph, ox, -edges.bottom * td);      // BOTTOM: right → left
  vEdge(ctx, ox, oy + ph, oy, -edges.left * td);             // LEFT: bottom → top
  ctx.closePath();
}

/** Generate per-edge tab directions for all pieces in a rows×cols grid. */
function buildTabDirs(rows, cols) {
  // hBound[r][c]: tab direction of BOTTOM edge of piece(r,c) (only defined for r < rows-1)
  // +1 = tab sticks down from piece(r,c), -1 = notch on piece(r,c)'s bottom
  const coin = () => (Math.random() < 0.5 ? 1 : -1);   // a new set of shapes every puzzle
  const hBound = Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, coin));
  // vBound[r][c]: tab direction of RIGHT edge of piece(r,c) (only defined for c < cols-1)
  // +1 = tab sticks right from piece(r,c), -1 = notch on piece(r,c)'s right
  const vBound = Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, coin));
  return { hBound, vBound };
}

/** Get the four edge directions for piece (r, c). */
function pieceEdges(r, c, rows, cols, tabDirs) {
  const { hBound, vBound } = tabDirs;
  return {
    top:    r > 0       ? -hBound[r - 1][c] : 0,
    bottom: r < rows-1  ?  hBound[r][c]     : 0,
    left:   c > 0       ? -vBound[r][c - 1] : 0,
    right:  c < cols-1  ?  vBound[r][c]     : 0,
  };
}

/**
 * Slice an image into jigsaw-shaped pieces sized to fit `maxBoardW`.
 * Pieces follow the photo's proportions (within limits; anything beyond is
 * cropped from the centre). Returns { pieces, pw, ph, overhang }.
 */
function sliceJigsawPieces(imgSrc, rows, cols, maxBoardW) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      // Piece shape: the photo's cell aspect, kept between 2:3 and 3:2
      const cellAspect = Math.min(1.5, Math.max(2 / 3, (img.height / rows) / (img.width / cols)));
      const pw = Math.max(40, Math.min(100, Math.floor(maxBoardW / cols)));
      const ph = Math.round(pw * cellAspect);
      // Centre crop of the photo matching the board's shape
      const boardAspect = (rows * ph) / (cols * pw);
      let cropW = img.width, cropH = img.width * boardAspect;
      if (cropH > img.height) { cropH = img.height; cropW = img.height / boardAspect; }
      const cropX = (img.width - cropW) / 2, cropY = (img.height - cropH) / 2;

      const td  = Math.round(Math.min(pw, ph) * 0.28); // tab depth
      const ovh = td + 3;                               // overhang for tab overflow
      const tabDirs = buildTabDirs(rows, cols);
      const pieces = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const edges = pieceEdges(r, c, rows, cols, tabDirs);
          const cvW = pw + 2 * ovh, cvH = ph + 2 * ovh;
          const cv  = document.createElement('canvas');
          cv.width = cvW; cv.height = cvH;
          const ctx = cv.getContext('2d');

          // Clip to jigsaw shape
          drawJigsawPath(ctx, ovh, ovh, pw, ph, td, edges);
          ctx.save(); ctx.clip();

          // Draw the whole (cropped) photo positioned so this piece's cell lands
          // at (ovh, ovh). The clip keeps just this piece, tabs included, so
          // neighbouring pieces fit together without gaps.
          ctx.drawImage(img, cropX, cropY, cropW, cropH,
            ovh - c * pw, ovh - r * ph, cols * pw, rows * ph);
          ctx.restore();

          // Draw the outline on top of the clip
          drawJigsawPath(ctx, ovh, ovh, pw, ph, td, edges);
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          pieces.push({
            id: `${r}-${c}`,
            dataUrl: cv.toDataURL(),
            correctPos: { row: r, col: c },
            cvW, cvH,
          });
        }
      }

      // Shuffle
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
      }

      // The whole (cropped) picture, for the "Picture" reference view
      const ref = document.createElement('canvas');
      ref.width = cols * pw; ref.height = rows * ph;
      ref.getContext('2d').drawImage(img, cropX, cropY, cropW, cropH, 0, 0, ref.width, ref.height);

      resolve({ pieces, pw, ph, overhang: ovh, reference: ref.toDataURL('image/jpeg', 0.85) });
    };
    img.src = imgSrc;
  });
}

// ── Photos ────────────────────────────────────────────────────────────────────
const MAX_PHOTO_PX = 1600;   // longest side kept; plenty for the board and much faster to cut

/** Read an image file and scale it down so its longest side is at most MAX_PHOTO_PX. */
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_PHOTO_PX / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

const alertPhotoError = () =>
  window.alert("Sorry, that picture couldn't be opened. Please try a different photo.");

// ── Difficulty config ─────────────────────────────────────────────────────────
const DIFFS = {
  easy:   { label: 'Easy (4×4 = 16)',   rows: 4, cols: 4 },
  medium: { label: 'Medium (5×6 = 30)', rows: 5, cols: 6 },
  hard:   { label: 'Hard (8×8 = 64)',   rows: 8, cols: 8 },
};

const TRAY_PIECE_H = 84;   // pieces are shown scaled down to this height in the tray

// ── Main component ────────────────────────────────────────────────────────────
export default function JigsawGame() {
  const navigate  = useNavigate();

  // ── Setup state ────────────────────────────────────────────────────────────
  const [phase,       setPhase]       = useState('setup');
  const [photos,      setPhotos]      = useState([]);
  const [selPhoto,    setSelPhoto]    = useState(null);
  const [diff,        setDiff]        = useState('easy');
  const [showTutorial,setShowTutorial]= useState(false);

  // ── Game state ─────────────────────────────────────────────────────────────
  const [pieces,      setPieces]      = useState([]);
  const [config,      setConfig]      = useState({ rows:0, cols:0, pw:0, ph:0, overhang:0 });
  // boardSlots: "r-c" → pieceId  (tentatively OR correctly placed)
  const [boardSlots,  setBoardSlots]  = useState({});
  // locked: Set of pieceIds that are in correct positions (cannot be moved)
  const [locked,      setLocked]      = useState(new Set());
  const [secs,        setSecs]        = useState(0);
  const [jokeOpen,    setJokeOpen]    = useState(false);
  const [reference,   setReference]   = useState(null);   // the finished picture, to look at
  const [showRef,     setShowRef]     = useState(false);

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [drag,       setDrag]      = useState(null); // { id, x, y }
  const dragRef      = useRef(null);
  const boardRef     = useRef(null);
  const timerRef     = useRef(null);

  useEffect(() => { getPhotos().then(setPhotos).catch(() => {}); }, []);
  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Photo management ───────────────────────────────────────────────────────
  const handleUpload = useCallback(async e => {
    const file = e.target.files?.[0];
    e.target.value = '';                  // allow picking the same photo again later
    if (!file) return;
    try {
      const p = { id: Date.now(), name: file.name, dataUrl: await shrinkPhoto(file) };
      await savePhoto(p);
      setPhotos(prev => [...prev, p]);
      setSelPhoto(p);
    } catch {
      alertPhotoError();
    }
  }, []);

  const handleDeletePhoto = useCallback(async (id, e) => {
    e.stopPropagation();
    await deletePhoto(id);
    setPhotos(prev => prev.filter(p => p.id !== id));
    setSelPhoto(prev => prev?.id === id ? null : prev);
  }, []);

  // ── Start game ─────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!selPhoto) return;
    const { rows, cols } = DIFFS[diff];
    const availW = Math.min(window.innerWidth, 900) - 32;   // fit the screen
    const result = await sliceJigsawPieces(selPhoto.dataUrl, rows, cols, availW);
    setPieces(result.pieces);
    setConfig({ rows, cols, pw: result.pw, ph: result.ph, overhang: result.overhang });
    setReference(result.reference);
    setShowRef(false);
    setBoardSlots({});
    setLocked(new Set());
    setSecs(0);
    setPhase('playing');
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
  }, [selPhoto, diff]);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  // Pointer events cover finger, mouse and pencil alike. The piece being dragged
  // stays on the page (faded) until it's dropped: iPad Safari stops sending a
  // touch's events if the element the finger started on is removed.
  const onDragStart = useCallback((e, id, fromSlot) => {
    if (locked.has(id) || dragRef.current) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not essential */ }
    dragRef.current = { id, x: e.clientX, y: e.clientY, fromSlot: fromSlot || null, pointerId: e.pointerId };
    setDrag({ id, x: e.clientX, y: e.clientY });
  }, [locked]);

  const onDragMove = useCallback(e => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    d.x = e.clientX; d.y = e.clientY;
    setDrag({ id: d.id, x: d.x, y: d.y });
  }, []);

  const onDragEnd = useCallback(e => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    // The browser took the gesture over (e.g. to scroll the tray): leave the piece where it was
    if (e.type === 'pointercancel') return;

    const { id, x, y, fromSlot } = d;
    const piece = pieces.find(p => p.id === id);
    const boardEl = boardRef.current;
    if (!piece || !boardEl) return;

    const rect  = boardEl.getBoundingClientRect();
    const { pw, ph, overhang, rows, cols } = config;
    // Board content (grid) origin is at (rect.left + overhang, rect.top + overhang)
    const bx = x - rect.left - overhang;
    const by = y - rect.top  - overhang;
    const onBoard = bx > -overhang && bx < cols * pw + overhang && by > -overhang && by < rows * ph + overhang;

    // Nearest slot to the drop point
    const nc = Math.max(0, Math.min(cols - 1, Math.round((bx - pw / 2) / pw)));
    const nr = Math.max(0, Math.min(rows - 1, Math.round((by - ph / 2) / ph)));
    const slotKey = `${nr}-${nc}`;
    const placed = onBoard && !locked.has(boardSlots[slotKey]);   // can't cover a locked piece

    setBoardSlots(prev => {
      const next = { ...prev };
      if (fromSlot && next[fromSlot] === id) delete next[fromSlot];   // it has left its old spot
      if (placed) next[slotKey] = id;             // an unlocked piece already there returns to the tray
      return next;                                // dropped off the board: back to the tray
    });

    // A piece dropped into its own slot locks in place
    if (placed && piece.correctPos.row === nr && piece.correctPos.col === nc) {
      const nowLocked = new Set(locked).add(id);
      setLocked(nowLocked);
      if (nowLocked.size >= pieces.length) {
        clearInterval(timerRef.current);
        setTimeout(() => setJokeOpen(true), 600);
      }
    }
  }, [pieces, locked, boardSlots, config]);

  useEffect(() => {
    if (phase !== 'playing') return;
    window.addEventListener('pointermove',   onDragMove);
    window.addEventListener('pointerup',     onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
    return () => {
      window.removeEventListener('pointermove',   onDragMove);
      window.removeEventListener('pointerup',     onDragEnd);
      window.removeEventListener('pointercancel', onDragEnd);
    };
  }, [phase, onDragMove, onDragEnd]);

  // ── Win / score ─────────────────────────────────────────────────────────────
  const handleJokeClose = useCallback(async () => {
    setJokeOpen(false);
    setPhase('win');
    await api.post('/scores', { game: 'jigsaw', score: Math.max(0, 10000 - secs * 5), difficulty: diff })
      .catch(() => {});   // a failed score save shouldn't block the win screen
  }, [secs, diff]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const { rows, cols, pw, ph, overhang } = config;
  const boardW  = cols * pw + 2 * overhang;
  const boardH  = rows * ph + 2 * overhang;
  const boardPieceIds = new Set(Object.values(boardSlots));
  const trayPieces    = pieces.filter(p => !boardPieceIds.has(p.id));   // includes one being dragged (shown faded)
  const dragPiece     = drag ? pieces.find(p => p.id === drag.id) : null;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  // ── Setup screen ───────────────────────────────────────────────────────────
  if (phase === 'setup') return (
    <div className="min-h-screen bg-game-bg p-4 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/')}><ArrowLeft size={22} /></Button>
        <h1 className="text-game-gold text-2xl font-bold">🧩 Jigsaw Puzzle</h1>
        <button onClick={() => setShowTutorial(true)} className="ml-auto text-white/40 hover:text-white/70 p-2">
          <HelpCircle size={20} />
        </button>
      </div>

      <label className="flex items-center gap-2 bg-game-accent text-white px-4 py-3 rounded-xl cursor-pointer self-start">
        <Upload size={18} /><span>Add a Photo</span>
        {/* No "capture" attribute, so the iPad offers the Photo Library as well as the camera */}
        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </label>

      {photos.length === 0 && <p className="text-white/40 text-center py-8">Upload a photo to get started</p>}

      <div className="grid grid-cols-3 gap-3">
        {photos.map(p => (
          <div key={p.id} onClick={() => setSelPhoto(p)}
            className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all
              ${selPhoto?.id === p.id ? 'border-game-gold' : 'border-white/10 hover:border-white/30'}`}>
            <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
            <button onClick={e => handleDeletePhoto(p.id, e)}
              className="absolute top-1 right-1 bg-game-red/80 rounded-full p-1">
              <Trash2 size={12} color="white" />
            </button>
            {selPhoto?.id === p.id && (
              <div className="absolute inset-0 bg-game-gold/30 flex items-center justify-center text-3xl">✓</div>
            )}
          </div>
        ))}
      </div>

      <div>
        <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Difficulty</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DIFFS).map(([k, { label }]) => (
            <Button key={k} variant={diff === k ? 'gold' : 'ghost'} onClick={() => setDiff(k)}>{label}</Button>
          ))}
        </div>
      </div>

      <Button variant="primary" onClick={handleStart} disabled={!selPhoto} className="py-4 text-lg mt-auto">
        ▶ Start Puzzle
      </Button>

      <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} title="Jigsaw Puzzle" slides={TUTORIALS.jigsaw} />
    </div>
  );

  // ── Win screen ─────────────────────────────────────────────────────────────
  if (phase === 'win') {
    return (
      <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center gap-5 p-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="text-7xl">🎉</motion.div>
        <h2 className="text-game-gold text-3xl font-bold">Puzzle Complete!</h2>
        <p className="text-white/70 text-lg">Time: {mm}:{ss}</p>
        <p className="text-white text-xl">Score: <span className="text-game-gold font-bold">{Math.max(0, 10000 - secs * 5).toLocaleString()}</span></p>
        <Button variant="primary" onClick={() => setPhase('setup')}>Play Again</Button>
        <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
      </div>
    );
  }

  // ── Playing screen ─────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-game-bg flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-game-card shrink-0">
        <Button variant="ghost" onClick={() => { clearInterval(timerRef.current); setPhase('setup'); }}>
          <ArrowLeft size={20} />
        </Button>
        <span className="text-white/60 text-sm font-mono">{mm}:{ss}</span>
        <div className="flex items-center gap-3">
          <span className="text-white/60 text-sm hidden sm:inline">{locked.size} / {pieces.length} placed</span>
          <button onClick={() => setShowRef(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold min-h-[44px] ${showRef ? 'bg-game-gold text-game-bg' : 'bg-white/10 text-white'}`}>
            <ImageIcon size={16} /> Picture
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10 shrink-0">
        <motion.div className="h-full bg-game-gold"
          animate={{ width: `${pieces.length ? (locked.size / pieces.length) * 100 : 0}%` }}
          transition={{ duration: 0.3 }} />
      </div>

      {/* Board (scrollable) */}
      <div className="flex-1 overflow-auto p-2">
        <p className="text-white/40 text-xs text-center mb-1">Drag pieces onto the board — they snap into place when correct</p>

        {/* The finished picture, shown over the board until tapped */}
        {showRef && reference && (
          <button onClick={() => setShowRef(false)}
            className="fixed inset-x-0 z-40 mx-auto flex flex-col items-center gap-2 p-3 rounded-2xl bg-black/80 shadow-2xl"
            style={{ top: 'calc(var(--safe-top) + 4.5rem)', width: `min(92vw, ${boardW + 24}px)` }}>
            <img src={reference} alt="The finished picture" className="w-full rounded-lg" draggable={false} />
            <span className="text-white/70 text-xs">Tap to hide</span>
          </button>
        )}

        {/* Puzzle board */}
        <div ref={boardRef}
          style={{ width: boardW, height: boardH, position: 'relative', flexShrink: 0 }}
          className="mx-auto rounded-xl overflow-visible border border-white/20 bg-black/30">

          {/* Dim reference grid lines */}
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => (
              <div key={`g-${r}-${c}`} style={{
                position: 'absolute',
                left: c * pw + overhang, top: r * ph + overhang,
                width: pw, height: ph,
                border: '1px solid rgba(255,255,255,0.08)',
                pointerEvents: 'none',
              }} />
            ))
          )}

          {/* Placed pieces on board */}
          {Object.entries(boardSlots).map(([slotKey, pieceId]) => {
            const piece = pieces.find(p => p.id === pieceId);
            if (!piece) return null;
            const [r, c] = slotKey.split('-').map(Number);
            const isLocked = locked.has(pieceId);
            return (
              <img
                key={pieceId}
                src={piece.dataUrl}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: c * pw,
                  top:  r * ph,
                  width: piece.cvW,
                  height: piece.cvH,
                  cursor: isLocked ? 'default' : 'grab',
                  filter: isLocked ? 'none' : 'drop-shadow(0 0 4px rgba(255,255,255,0.3))',
                  zIndex: isLocked ? 1 : 2,
                  opacity: drag?.id === pieceId ? 0.25 : 1,     // being dragged: faded in place
                  touchAction: 'none',
                  WebkitTouchCallout: 'none',                   // no iPad image menu on long-press
                }}
                onPointerDown={e => !isLocked && onDragStart(e, pieceId, slotKey)}
              />
            );
          })}
        </div>
      </div>

      {/* Tray */}
      <div className="shrink-0 bg-black/40 border-t border-white/10 p-2">
        <p className="text-white/40 text-xs mb-1.5">{trayPieces.length} pieces remaining</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 items-center" style={{ minHeight: TRAY_PIECE_H }}>
          {trayPieces.map(piece => (
            <img
              key={piece.id}
              src={piece.dataUrl}
              alt=""
              draggable={false}
              style={{
                height: Math.min(piece.cvH, TRAY_PIECE_H),
                width: piece.cvW * Math.min(1, TRAY_PIECE_H / piece.cvH),
                flexShrink: 0, cursor: 'grab',
                // Sideways swipes still scroll the tray; moving up picks the piece up
                touchAction: 'pan-x',
                WebkitTouchCallout: 'none',
                opacity: drag?.id === piece.id ? 0.3 : 1,
              }}
              onPointerDown={e => onDragStart(e, piece.id, null)}
            />
          ))}
          {trayPieces.length === 0 && locked.size < pieces.length && (
            <p className="text-white/30 text-sm self-center px-4">All pieces on the board!</p>
          )}
        </div>
      </div>

      {/* Floating drag ghost */}
      {drag && dragPiece && (
        <img
          src={dragPiece.dataUrl}
          alt=""
          draggable={false}
          style={{
            position: 'fixed',
            left: drag.x - dragPiece.cvW / 2,
            top:  drag.y - dragPiece.cvH / 2,
            width: dragPiece.cvW,
            height: dragPiece.cvH,
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: 0.85,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))',
          }}
        />
      )}

      <DadJokeModal isOpen={jokeOpen} onClose={handleJokeClose} />
    </div>
  );
}


