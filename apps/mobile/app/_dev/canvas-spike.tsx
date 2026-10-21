// P4 SPIKE ONLY - drag/pinch/rotate feasibility on RN Web. Delete after the decision (see learning brief).
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const W = 350;
const H = 392;
const BOX = 100;
const INIT = [
  { id: 'a', color: '#B08A5E', x: 110, y: 130, s: 1.4, r: -7 },
  { id: 'b', color: '#C8402A', x: 240, y: 110, s: 1.1, r: 4 },
  { id: 'c', color: '#2F3B52', x: 220, y: 260, s: 1.3, r: 2 },
];
type P = (typeof INIT)[number];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const TWO_PI_DEG = 180 / Math.PI;

// ------------------------------------------------------------------ A: gesture-handler + reanimated
function GHPiece({ init, selected, onSelect, onReport }: { init: P; selected: boolean; onSelect: () => void; onReport: (s: string) => void }) {
  const x = useSharedValue(init.x);
  const y = useSharedValue(init.y);
  const s = useSharedValue(init.s);
  const r = useSharedValue(init.r);
  const sx = useSharedValue(0), sy = useSharedValue(0), ss = useSharedValue(1), sr = useSharedValue(0);
  const hv = useSharedValue(0), ha = useSharedValue(0), hs = useSharedValue(1), hr = useSharedValue(0);

  const report = () => onReport(`${init.id} x=${Math.round(x.value)} y=${Math.round(y.value)} s=${s.value.toFixed(2)} r=${Math.round(r.value)}`);

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => { sx.value = x.value; sy.value = y.value; runOnJS(onSelect)(); })
    .onUpdate((e) => { x.value = sx.value + e.translationX; y.value = sy.value + e.translationY; })
    .onFinalize(() => runOnJS(report)());
  const pinch = Gesture.Pinch()
    .onBegin(() => { ss.value = s.value; })
    .onUpdate((e) => { s.value = clamp(ss.value * e.scale, 0.4, 3); })
    .onFinalize(() => runOnJS(report)());
  const rot = Gesture.Rotation()
    .onBegin(() => { sr.value = r.value; })
    .onUpdate((e) => { r.value = sr.value + e.rotation * TWO_PI_DEG; })
    .onFinalize(() => runOnJS(report)());
  const body = Gesture.Simultaneous(pan, pinch, rot);

  // corner handle: distance from piece center -> scale, angle -> rotation (works with a mouse, no pinch needed)
  const handle = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      const a = (r.value / TWO_PI_DEG) + Math.PI / 4;
      const half = (BOX / 2) * s.value * Math.SQRT2;
      hv.value = half; ha.value = a; hs.value = s.value; hr.value = r.value;
      sx.value = Math.cos(a) * half; sy.value = Math.sin(a) * half;
    })
    .onUpdate((e) => {
      const vx = sx.value + e.translationX, vy = sy.value + e.translationY;
      s.value = clamp(hs.value * (Math.hypot(vx, vy) / hv.value), 0.4, 3);
      r.value = hr.value + (Math.atan2(vy, vx) - ha.value) * TWO_PI_DEG;
    })
    .onFinalize(() => runOnJS(report)());

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - BOX / 2 }, { translateY: y.value - BOX / 2 }, { rotate: `${r.value}deg` }, { scale: s.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: BOX, height: BOX }, style]}>
      <GestureDetector gesture={body}>
        <View testID={`gh-piece-${init.id}`} style={{ flex: 1, backgroundColor: init.color, borderWidth: selected ? 2 : 0, borderStyle: 'dashed', borderColor: '#1A1917', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{init.id}</Text>
        </View>
      </GestureDetector>
      {selected && (
        <GestureDetector gesture={handle}>
          <View testID={`gh-handle-${init.id}`} style={{ position: 'absolute', right: -9, bottom: -9, width: 18, height: 18, backgroundColor: '#1A1917' }} />
        </GestureDetector>
      )}
    </Animated.View>
  );
}

function GHCanvas({ onReport }: { onReport: (s: string) => void }) {
  const [sel, setSel] = useState('a');
  return (
    <View testID="gh-canvas" style={{ width: W, height: H, backgroundColor: '#E9E2D4', overflow: 'hidden' }}>
      {INIT.map((p) => (
        <GHPiece key={p.id} init={p} selected={sel === p.id} onSelect={() => setSel(p.id)} onReport={onReport} />
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ B: PanResponder / pointer (no extra libs)
function PRPiece({ p, selected, onSelect, onChange, onReport }: { p: P; selected: boolean; onSelect: () => void; onChange: (n: Partial<P>) => void; onReport: (s: string) => void }) {
  const cur = useRef(p);
  cur.current = p;
  const start = useRef({ x: 0, y: 0, s: 1, r: 0, d: 0, a: 0 });

  const body = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { onSelect(); start.current = { ...start.current, x: cur.current.x, y: cur.current.y, s: cur.current.s, r: cur.current.r, d: 0, a: 0 }; },
      onPanResponderMove: (e, g) => {
        const t = e.nativeEvent.touches as any[] | undefined;
        if (t && t.length >= 2) {
          const dx = t[1].pageX - t[0].pageX, dy = t[1].pageY - t[0].pageY;
          const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
          if (!start.current.d) { start.current.d = d; start.current.a = a; start.current.s = cur.current.s; start.current.r = cur.current.r; }
          onChange({ s: clamp(start.current.s * (d / start.current.d), 0.4, 3), r: start.current.r + (a - start.current.a) * TWO_PI_DEG });
        } else {
          onChange({ x: start.current.x + g.dx, y: start.current.y + g.dy });
        }
      },
      onPanResponderRelease: () => onReport(`${cur.current.id} x=${Math.round(cur.current.x)} y=${Math.round(cur.current.y)} s=${cur.current.s.toFixed(2)} r=${Math.round(cur.current.r)}`),
    }),
  ).current;

  const handle = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const c = cur.current;
        const a = c.r / TWO_PI_DEG + Math.PI / 4, half = (BOX / 2) * c.s * Math.SQRT2;
        start.current = { x: Math.cos(a) * half, y: Math.sin(a) * half, s: c.s, r: c.r, d: half, a };
      },
      onPanResponderMove: (_e, g) => {
        const vx = start.current.x + g.dx, vy = start.current.y + g.dy;
        onChange({ s: clamp(start.current.s * (Math.hypot(vx, vy) / start.current.d), 0.4, 3), r: start.current.r + (Math.atan2(vy, vx) - start.current.a) * TWO_PI_DEG });
      },
      onPanResponderRelease: () => onReport(`${cur.current.id} x=${Math.round(cur.current.x)} y=${Math.round(cur.current.y)} s=${cur.current.s.toFixed(2)} r=${Math.round(cur.current.r)}`),
    }),
  ).current;

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: BOX, height: BOX, transform: [{ translateX: p.x - BOX / 2 }, { translateY: p.y - BOX / 2 }, { rotate: `${p.r}deg` }, { scale: p.s }] }}>
      <View testID={`pr-piece-${p.id}`} {...body.panHandlers} style={{ flex: 1, backgroundColor: p.color, borderWidth: selected ? 2 : 0, borderStyle: 'dashed', borderColor: '#1A1917', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{p.id}</Text>
      </View>
      {selected && <View testID={`pr-handle-${p.id}`} {...handle.panHandlers} style={{ position: 'absolute', right: -9, bottom: -9, width: 18, height: 18, backgroundColor: '#1A1917' }} />}
    </View>
  );
}

function PRCanvas({ onReport }: { onReport: (s: string) => void }) {
  const [pieces, setPieces] = useState<P[]>(INIT);
  const [sel, setSel] = useState('a');
  const selRef = useRef('a');
  selRef.current = sel;
  const box = useRef<View>(null);

  // web only: wheel = scale, shift+wheel = rotate (the desktop substitute for pinch)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = box.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const fn = (ev: WheelEvent) => {
      ev.preventDefault();
      setPieces((ps) => ps.map((p) => p.id !== selRef.current ? p : ev.shiftKey ? { ...p, r: p.r + ev.deltaY * 0.1 } : { ...p, s: clamp(p.s * (ev.deltaY < 0 ? 1.05 : 0.95), 0.4, 3) }));
    };
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, []);

  return (
    <View ref={box} testID="pr-canvas" style={{ width: W, height: H, backgroundColor: '#D9C3B0', overflow: 'hidden' }}>
      {pieces.map((p) => (
        <PRPiece key={p.id} p={p} selected={sel === p.id} onSelect={() => setSel(p.id)} onReport={onReport}
          onChange={(n) => setPieces((ps) => ps.map((q) => (q.id === p.id ? { ...q, ...n } : q)))} />
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ page
export default function CanvasSpike() {
  const [mode, setMode] = useState<'gh' | 'pr'>('gh');
  const [log, setLog] = useState('-');
  return (
    <GestureHandlerRootView style={{ flex: 1, alignItems: 'center', paddingTop: 16, backgroundColor: '#F4F0E8' }}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Pressable testID="mode-gh" onPress={() => setMode('gh')}><Text style={{ fontWeight: mode === 'gh' ? '700' : '400' }}>A: gesture-handler + reanimated</Text></Pressable>
        <Pressable testID="mode-pr" onPress={() => setMode('pr')}><Text style={{ fontWeight: mode === 'pr' ? '700' : '400' }}>B: PanResponder</Text></Pressable>
      </View>
      {mode === 'gh' ? <GHCanvas key="gh" onReport={setLog} /> : <PRCanvas key="pr" onReport={setLog} />}
      <Text testID="log" style={{ marginTop: 8 }}>{log}</Text>
    </GestureHandlerRootView>
  );
}
