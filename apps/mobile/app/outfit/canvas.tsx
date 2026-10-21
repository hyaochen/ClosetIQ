import { useLocalSearchParams } from 'expo-router';
import { CanvasEditor } from '@/components/canvas/CanvasEditor';

/** 編輯既有穿搭的畫布：/outfit/canvas?id=<outfitId> */
export default function OutfitCanvasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <CanvasEditor key={id} outfitId={id} />;
}
