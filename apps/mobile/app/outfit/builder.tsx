import { useLocalSearchParams } from 'expo-router';
import { CanvasEditor } from '@/components/canvas/CanvasEditor';

/** 新穿搭：拼貼畫布。可帶 ?items=id1,id2 預先放入衣物，否則從空白畫布開始。 */
export default function OutfitBuilderScreen() {
  const { items } = useLocalSearchParams<{ items?: string }>();
  const preset = items ? items.split(',').filter(Boolean) : undefined;
  return <CanvasEditor presetItemIds={preset} />;
}
