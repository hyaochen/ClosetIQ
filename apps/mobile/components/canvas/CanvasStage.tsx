import { useEffect, useRef } from 'react';
import { View, Image, PanResponder, Platform, Pressable, Text, type ViewStyle } from 'react-native';
import type { CanvasBackground } from '@closet/shared';
import { imageUrl } from '@/lib/images';
import { fonts } from '@/lib/theme';
import { bgHex, clamp, normDeg, SCALE_MAX, SCALE_MIN, type EditorPiece } from './canvas-utils';

// 畫布底色（卡色／白／淺赭）不隨深淺色主題改變，所以選取框也用固定的墨色，確保任何底色上都看得到
const INK = '#1A1917';
const PAPER = '#F4F0E8';
const MUTE = '#5E5A53';
const DEG = 180 / Math.PI;

/** 欄位可以是數值，或「由目前值算出新值」的函式（滾輪連續觸發時避免讀到舊值） */
export type PiecePatch = Partial<Record<'x' | 'y' | 'scale' | 'rotate', number | ((cur: number) => number)>>;
type Cb = { onSelect: (id: string | null) => void; onPatch: (id: string, patch: PiecePatch) => void };

function boxStyle(p: EditorPiece, W: number, H: number): ViewStyle {
  const box = p.scale * W;
  return { position: 'absolute', left: p.x * W - box / 2, top: p.y * H - box / 2, width: box, height: box, transform: [{ rotate: `${p.rotate}deg` }] };
}

/** 片段本體：單指拖曳移動，雙指縮放 + 旋轉 */
function PieceBody({ p, W, H, cb }: { p: EditorPiece; W: number; H: number; cb: React.MutableRefObject<Cb> }) {
  const pr = useRef(p);
  pr.current = p;
  const dims = useRef({ W, H });
  dims.current = { W, H };
  const st = useRef({ x: 0, y: 0, s: 1, r: 0, d: 0, a: 0, pinch: false, bdx: 0, bdy: 0 });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const c = pr.current;
        st.current = { x: c.x, y: c.y, s: c.scale, r: c.rotate, d: 0, a: 0, pinch: false, bdx: 0, bdy: 0 };
        cb.current.onSelect(c.itemId);
      },
      onPanResponderMove: (e, g) => {
        const c = pr.current;
        const s = st.current;
        const t = e.nativeEvent.touches as unknown as { pageX: number; pageY: number }[] | undefined;
        if (t && t.length >= 2) {
          const dx = t[1].pageX - t[0].pageX;
          const dy = t[1].pageY - t[0].pageY;
          const d = Math.hypot(dx, dy);
          const a = Math.atan2(dy, dx);
          if (!s.pinch) {
            s.pinch = true; s.d = d || 1; s.a = a; s.s = c.scale; s.r = c.rotate;
          }
          cb.current.onPatch(c.itemId, { scale: clamp(s.s * (d / s.d), SCALE_MIN, SCALE_MAX), rotate: normDeg(s.r + (a - s.a) * DEG) });
        } else {
          if (s.pinch) {
            s.pinch = false; s.x = c.x; s.y = c.y; s.bdx = g.dx; s.bdy = g.dy;
          }
          const { W: w, H: h } = dims.current;
          cb.current.onPatch(c.itemId, { x: clamp(s.x + (g.dx - s.bdx) / w, 0, 1), y: clamp(s.y + (g.dy - s.bdy) / h, 0, 1) });
        }
      },
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={p.name}
      style={[boxStyle(p, W, H), Platform.OS === 'web' ? ({ cursor: 'grab', userSelect: 'none', touchAction: 'none' } as any) : null]}
    >
      <Image
        source={{ uri: imageUrl(p.path) }}
        resizeMode="contain"
        style={{ width: '100%', height: '100%', transform: [{ scaleX: p.flipX ? -1 : 1 }], pointerEvents: 'none' } as any}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/** 四角控制點：拖曳 = 以片段中心為軸，距離比 = 縮放、角度差 = 旋轉 */
function Handle({ p, W, sx, sy, cb }: { p: EditorPiece; W: number; sx: 1 | -1; sy: 1 | -1; cb: React.MutableRefObject<Cb> }) {
  const pr = useRef(p);
  pr.current = p;
  const wRef = useRef(W);
  wRef.current = W;
  const st = useRef({ vx: 0, vy: 0, s: 1, r: 0, len: 1, ang: 0 });
  const box = p.scale * W;
  const dark = sx === 1 && sy === 1;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const c = pr.current;
        const half = ((c.scale * wRef.current) / 2) * Math.SQRT2;
        const a = Math.atan2(sy, sx) + c.rotate / DEG;
        const vx = Math.cos(a) * half;
        const vy = Math.sin(a) * half;
        st.current = { vx, vy, s: c.scale, r: c.rotate, len: half || 1, ang: Math.atan2(vy, vx) };
      },
      onPanResponderMove: (_e, g) => {
        const s = st.current;
        const vx = s.vx + g.dx;
        const vy = s.vy + g.dy;
        cb.current.onPatch(pr.current.itemId, {
          scale: clamp(s.s * (Math.hypot(vx, vy) / s.len), SCALE_MIN, SCALE_MAX),
          rotate: normDeg(s.r + (Math.atan2(vy, vx) - s.ang) * DEG),
        });
      },
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      accessibilityRole="button"
      accessibilityLabel="縮放與旋轉"
      style={[
        { position: 'absolute', width: 28, height: 28, left: (sx < 0 ? 0 : box) - 14, top: (sy < 0 ? 0 : box) - 14, alignItems: 'center', justifyContent: 'center' },
        Platform.OS === 'web' ? ({ cursor: 'nwse-resize', touchAction: 'none' } as any) : null,
      ]}
    >
      <View style={{ width: 9, height: 9, backgroundColor: dark ? INK : PAPER, borderWidth: 1, borderColor: INK }} />
    </View>
  );
}

export function CanvasStage({
  width,
  height,
  background,
  pieces,
  selected,
  onSelect,
  onPatch,
  caption,
  emptyHint,
}: {
  width: number;
  height: number;
  background: CanvasBackground;
  pieces: EditorPiece[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onPatch: (id: string, patch: PiecePatch) => void;
  caption?: string;
  emptyHint?: string;
}) {
  const cb = useRef<Cb>({ onSelect, onPatch });
  cb.current = { onSelect, onPatch };
  const stageRef = useRef<View>(null);
  const selRef = useRef(selected);
  selRef.current = selected;
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const sel = pieces.find((p) => p.itemId === selected) ?? null;

  // 桌機：滾輪 = 縮放，Shift + 滾輪 = 旋轉（沒有雙指時的替代操作）
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = stageRef.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const fn = (ev: WheelEvent) => {
      const id = selRef.current;
      const p = piecesRef.current.find((x) => x.itemId === id);
      if (!p) return;
      ev.preventDefault();
      if (ev.shiftKey) {
        const dy = ev.deltaY || ev.deltaX;
        cb.current.onPatch(p.itemId, { rotate: (r) => normDeg(r + dy * 0.1) });
      } else {
        cb.current.onPatch(p.itemId, { scale: (v) => clamp(v * (ev.deltaY < 0 ? 1.05 : 0.95), SCALE_MIN, SCALE_MAX) });
      }
    };
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, []);

  return (
    <View
      ref={stageRef}
      style={[{ width, height, backgroundColor: bgHex(background), borderWidth: 1, borderColor: '#CFC7B8', overflow: 'hidden' }, Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as any) : null]}
      testID="canvas-stage"
    >
      <Pressable accessibilityLabel="畫布空白處，點一下取消選取" onPress={() => onSelect(null)} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      {pieces.map((p) => (
        <PieceBody key={p.itemId} p={p} W={width} H={height} cb={cb} />
      ))}
      {sel ? (
        <View pointerEvents="box-none" style={boxStyle(sel, width, height)}>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderWidth: 1, borderStyle: 'dashed', borderColor: INK }} />
          <Handle p={sel} W={width} sx={-1} sy={-1} cb={cb} />
          <Handle p={sel} W={width} sx={1} sy={-1} cb={cb} />
          <Handle p={sel} W={width} sx={-1} sy={1} cb={cb} />
          <Handle p={sel} W={width} sx={1} sy={1} cb={cb} />
        </View>
      ) : null}
      {pieces.length === 0 && emptyHint ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: MUTE, textAlign: 'center', lineHeight: 26 }}>{emptyHint}</Text>
        </View>
      ) : null}
      {caption ? (
        <Text style={{ pointerEvents: 'none', position: 'absolute', right: 10, bottom: 8, fontFamily: fonts.numeral, fontStyle: 'italic', fontSize: 15, color: MUTE } as any}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
