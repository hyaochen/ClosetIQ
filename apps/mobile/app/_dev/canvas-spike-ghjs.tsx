// P4 SPIKE ONLY (option C): gesture-handler with runOnJS(true) callbacks and React state, NO reanimated import.
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

const W = 350, H = 392, BOX = 100, D = 180 / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const INIT = [
  { id: 'a', color: '#B08A5E', x: 110, y: 130, s: 1.4, r: -7 },
  { id: 'b', color: '#C8402A', x: 240, y: 110, s: 1.1, r: 4 },
  { id: 'c', color: '#2F3B52', x: 220, y: 260, s: 1.3, r: 2 },
];
type P = (typeof INIT)[number];

function Piece({ p, selected, onSelect, onChange, onReport }: { p: P; selected: boolean; onSelect: () => void; onChange: (n: Partial<P>) => void; onReport: (s: string) => void }) {
  const cur = useRef(p); cur.current = p;
  const st = useRef({ x: 0, y: 0, s: 1, r: 0, hx: 0, hy: 0, ha: 0, hd: 1 });
  const rep = () => onReport(`${cur.current.id} x=${Math.round(cur.current.x)} y=${Math.round(cur.current.y)} s=${cur.current.s.toFixed(2)} r=${Math.round(cur.current.r)}`);
  const pan = Gesture.Pan().runOnJS(true).minDistance(0)
    .onBegin(() => { onSelect(); st.current.x = cur.current.x; st.current.y = cur.current.y; })
    .onUpdate((e) => onChange({ x: st.current.x + e.translationX, y: st.current.y + e.translationY }))
    .onFinalize(rep);
  const pinch = Gesture.Pinch().runOnJS(true)
    .onBegin(() => { st.current.s = cur.current.s; })
    .onUpdate((e) => onChange({ s: clamp(st.current.s * e.scale, 0.4, 3) }))
    .onFinalize(rep);
  const rot = Gesture.Rotation().runOnJS(true)
    .onBegin(() => { st.current.r = cur.current.r; })
    .onUpdate((e) => onChange({ r: st.current.r + e.rotation * D }))
    .onFinalize(rep);
  const body = Gesture.Simultaneous(pan, pinch, rot);
  const handle = Gesture.Pan().runOnJS(true).minDistance(0)
    .onBegin(() => {
      const a = cur.current.r / D + Math.PI / 4, half = (BOX / 2) * cur.current.s * Math.SQRT2;
      st.current.hx = Math.cos(a) * half; st.current.hy = Math.sin(a) * half; st.current.ha = a; st.current.hd = half; st.current.s = cur.current.s; st.current.r = cur.current.r;
    })
    .onUpdate((e) => {
      const vx = st.current.hx + e.translationX, vy = st.current.hy + e.translationY;
      onChange({ s: clamp(st.current.s * (Math.hypot(vx, vy) / st.current.hd), 0.4, 3), r: st.current.r + (Math.atan2(vy, vx) - st.current.ha) * D });
    })
    .onFinalize(rep);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: BOX, height: BOX, transform: [{ translateX: p.x - BOX / 2 }, { translateY: p.y - BOX / 2 }, { rotate: `${p.r}deg` }, { scale: p.s }] }}>
      <GestureDetector gesture={body}>
        <View testID={`gj-piece-${p.id}`} style={{ flex: 1, backgroundColor: p.color, borderWidth: selected ? 2 : 0, borderStyle: 'dashed', borderColor: '#1A1917', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{p.id}</Text>
        </View>
      </GestureDetector>
      {selected && <GestureDetector gesture={handle}><View testID={`gj-handle-${p.id}`} style={{ position: 'absolute', right: -9, bottom: -9, width: 18, height: 18, backgroundColor: '#1A1917' }} /></GestureDetector>}
    </View>
  );
}

export default function CanvasSpikeGhJs() {
  const [pieces, setPieces] = useState<P[]>(INIT);
  const [sel, setSel] = useState('a');
  const [log, setLog] = useState('-');
  return (
    <GestureHandlerRootView style={{ flex: 1, alignItems: 'center', paddingTop: 16, backgroundColor: '#F4F0E8' }}>
      <Text style={{ marginBottom: 8 }}>C: gesture-handler runOnJS (no reanimated)</Text>
      <View testID="gj-canvas" style={{ width: W, height: H, backgroundColor: '#E9E2D4', overflow: 'hidden' }}>
        {pieces.map((p) => (
          <Piece key={p.id} p={p} selected={sel === p.id} onSelect={() => setSel(p.id)} onReport={setLog}
            onChange={(n) => setPieces((ps) => ps.map((q) => (q.id === p.id ? { ...q, ...n } : q)))} />
        ))}
      </View>
      <Text testID="log" style={{ marginTop: 8 }}>{log}</Text>
    </GestureHandlerRootView>
  );
}
