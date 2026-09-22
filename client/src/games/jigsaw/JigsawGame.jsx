import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../../components/Button';
import { DadJokeModal } from '../../components/DadJokeModal';
import { TutorialModal, TUTORIALS } from '../../components/TutorialModal';
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
  // TOP: left → right, tab up = negative y = positive tabAmt in hEdge convention
  hEdge(ctx, ox, oy, ox + pw, edges.top * td);
  // RIGHT: top → bottom, tab right = positive x = positive tabAmt in vEdge
  vEdge(ctx, ox + pw, oy, oy + ph, edges.right * td);
  // BOTTOM: right → left (invert x), tab down = positive y = hEdge tabAmt positive
  // When going right→left: x0=ox+pw, x1=ox → w is negative → bezier goes in the right direction
  hEdge(ctx, ox + pw, oy + ph, ox, edges.bottom * td);
  // LEFT: bottom → top (invert y), tab left = negative x = vEdge tabAmt negative
  // When going bottom→top: y0=oy+ph, y1=oy → h is negative → bezier works correctly
  vEdge(ctx, ox, oy + ph, oy, edges.left * td);
  ctx.closePath();
}

/** Generate per-edge tab directions for all pieces in a rows×cols grid. */
function buildTabDirs(rows, cols) {
  // hBound[r][c]: tab direction of BOTTOM edge of piece(r,c) (only defined for r < rows-1)
  // +1 = tab sticks down from piece(r,c), -1 = notch on piece(r,c)'s bottom
  const hBound = Array.from({ length: rows - 1 }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ((r * cols + c) % 2 === 0 ? 1 : -1))
  );
  // vBound[r][c]: tab direction of RIGHT edge of piece(r,c) (only defined for c < cols-1)
  // +1 = tab sticks right from piece(r,c), -1 = notch on piece(r,c)'s right
  const vBound = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols - 1 }, (_, c) => ((r + c) % 2 === 0 ? 1 : -1))
  );
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

/** Slice an image into jigsaw-shaped pieces. Returns { pieces, pw, ph, overhang }. */
function sliceJigsawPieces(imgSrc, rows, cols, pw, ph) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
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

          // Draw image slice (mapped so the piece content lands at offset ovh,ovh)
          ctx.drawImage(img,
            Math.floor(c * img.width / cols),
            Math.floor(r * img.height / rows),
            Math.ceil(img.width / cols),
            Math.ceil(img.height / rows),
            ovh, ovh, pw, ph
          );
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

      resolve({ pieces, pw, ph, overhang: ovh });
    };
    img.src = imgSrc;
  });
}

// ── Difficulty config ─────────────────────────────────────────────────────────
const DIFFS = {
  easy:   { label: 'Easy (4×4 = 16)',   rows: 4, cols: 4 },
  medium: { label: 'Medium (5×6 = 30)', rows: 5, cols: 6 },
  hard:   { label: 'Hard (8×8 = 64)',   rows: 8, cols: 8 },
};

const SNAP_DIST = 40; // px: snap to correct slot when dropped within this distance

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

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [drag,       setDrag]      = useState(null); // { id, x, y }
  const dragRef      = useRef(null);
  const boardRef     = useRef(null);
  const timerRef     = useRef(null);

  useEffect(() => { getPhotos().then(setPhotos).catch(() => {}); }, []);
  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Photo management ───────────────────────────────────────────────────────
  const handleUpload = useCallback(e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const p = { id: Date.now(), name: file.name, dataUrl: ev.target.result };
      await savePhoto(p);
      setPhotos(prev => [...prev, p]);
      setSelPhoto(p);
    };
    reader.readAsDataURL(file);
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
    // Compute piece size to fit screen
    const availW = Math.min(window.innerWidth, 900) - 32;
    const pw = Math.max(40, Math.min(100, Math.floor(availW / cols)));
    const ph = pw; // square pieces

    const result = await sliceJigsawPieces(selPhoto.dataUrl, rows, cols, pw, ph);
    setPieces(result.pieces);
    setConfig({ rows, cols, pw, ph, overhang: result.overhang });
    setBoardSlots({});
    setLocked(new Set());
    setSecs(0);
    setPhase('playing');
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
  }, [selPhoto, diff]);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const onDragStart = useCallback((e, id, fromSlot) => {
    if (locked.has(id)) return;
    if (e.cancelable) e.preventDefault();
    const { clientX: x, clientY: y } = e.touches ? e.touches[0] : e;
    dragRef.current = { id, x, y, fromSlot: fromSlot || null };
    setDrag({ id, x, y });
    // Remove from board if dragging from board
    if (fromSlot) {
      setBoardSlots(prev => { const n = { ...prev }; delete n[fromSlot]; return n; });
    }
  }, [locked]);

  const onDragMove = useCallback(e => {
    if (!dragRef.current?.id) return;
    const { clientX: x, clientY: y } = e.touches ? e.touches[0] : e;
    dragRef.current = { ...dragRef.current, x, y };
    setDrag(d => d ? { ...d, x, y } : null);
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragRef.current?.id) return;
    const { id, x, y } = dragRef.current;
    dragRef.current = null;

    const piece = pieces.find(p => p.id === id);
    const boardEl = boardRef.current;
    let placed = false;

    if (piece && boardEl) {
      const rect  = boardEl.getBoundingClientRect();
      const { pw, ph, overhang, rows, cols } = config;
      // Board content (grid) origin is at (rect.left + overhang, rect.top + overhang)
      const bx = x - rect.left - overhang;
      const by = y - rect.top  - overhang;

      // Find nearest slot
      const nc = Math.max(0, Math.min(cols - 1, Math.round((bx - pw / 2) / pw)));
      const nr = Math.max(0, Math.min(rows - 1, Math.round((by - ph / 2) / ph)));

      // Snap distance: distance from drop point to center of nearest slot
      const slotCx = nc * pw + pw / 2;
      const slotCy = nr * ph + ph / 2;
      const dist = Math.sqrt((bx - slotCx) ** 2 + (by - slotCy) ** 2);

      if (bx > -overhang && bx < cols * pw + overhang && by > -overhang && by < rows * ph + overhang) {
        // On board area: always place in nearest slot
        const slotKey = `${nr}-${nc}`;
        const existingId = boardSlots[slotKey];

        // Don't overwrite a locked piece
        if (!locked.has(existingId)) {
          setBoardSlots(prev => ({ ...prev, [slotKey]: id }));

          const isCorrect = piece.correctPos.row === nr && piece.correctPos.col === nc;
          if (isCorrect && dist <= SNAP_DIST) {
            setLocked(prev => {
              const n = new Set(prev);
              n.add(id);
              // Check win after locking
              if (n.size >= pieces.length) {
                clearInterval(timerRef.current);
                setTimeout(() => setJokeOpen(true), 600);
              }
              return n;
            });
          }
          placed = true;
        }
      }
    }

    setDrag(null);
  }, [pieces, locked, boardSlots, config]);

  useEffect(() => {
    if (phase !== 'playing') return;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup',   onDragEnd);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend',  onDragEnd);
    return () => {
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup',   onDragEnd);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('touchend',  onDragEnd);
    };
  }, [phase, onDragMove, onDragEnd]);

  // ── Win / score ─────────────────────────────────────────────────────────────
  const handleJokeClose = useCallback(async () => {
    setJokeOpen(false);
    setPhase('win');
    try {
      await api.post('/scores', { game: 'jigsaw', score: Math.max(0, 10000 - secs * 5), difficulty: diff });
    } catch (_) {}
  }, [secs, diff]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const { rows, cols, pw, ph, overhang } = config;
  const boardW  = cols * pw + 2 * overhang;
  const boardH  = rows * ph + 2 * overhang;
  const boardPieceIds = new Set(Object.values(boardSlots));
  const trayPieces    = pieces.filter(p => !boardPieceIds.has(p.id) && drag?.id !== p.id);
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
        <Upload size={18} /><span>Upload Photo</span>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
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
        <span className="text-white/60 text-sm">{locked.size} / {pieces.length} locked</span>
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
            if (!piece || drag?.id === pieceId) return null;
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
                  touchAction: 'none',
                }}
                onMouseDown={e => !isLocked && onDragStart(e, pieceId, slotKey)}
                onTouchStart={e => !isLocked && onDragStart(e, pieceId, slotKey)}
              />
            );
          })}
        </div>
      </div>

      {/* Tray */}
      <div className="shrink-0 bg-black/40 border-t border-white/10 p-2">
        <p className="text-white/40 text-xs mb-1.5">{trayPieces.length} pieces remaining</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ maxHeight: '120px' }}>
          {trayPieces.map(piece => (
            <img
              key={piece.id}
              src={piece.dataUrl}
              alt=""
              draggable={false}
              style={{
                width: piece.cvW, height: piece.cvH,
                flexShrink: 0, cursor: 'grab', touchAction: 'none',
                opacity: drag?.id === piece.id ? 0.3 : 1,
              }}
              onMouseDown={e => onDragStart(e, piece.id, null)}
              onTouchStart={e => onDragStart(e, piece.id, null)}
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


