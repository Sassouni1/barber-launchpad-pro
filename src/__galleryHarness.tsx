import { createRoot } from 'react-dom/client';
import '@/index.css';
import { GalleryManager } from '@/components/website/GalleryManager';

const photos = Array.from({ length: 4 }, (_, i) => ({
  position: i,
  itemKey: `i${i}`,
  imageKey: `k${i}`,
  src: 'https://stay-faded-barbershop.pages.dev/assets/stay-faded-panda-sign.jpg',
  alt: `Stay Faded photo ${i + 1}`,
}));

createRoot(document.getElementById('root')!).render(
  <div className="bg-background p-3">
    <GalleryManager
      title="Photo gallery"
      photos={photos}
      max={24}
      busy={false}
      shareUrl="https://stayfadedbarbershop5280.com/#inside-stay-faded"
      onAdd={() => {}}
      onReplace={() => {}}
      onMove={() => {}}
      onRemove={() => {}}
      onDescribe={() => {}}
      onShare={() => {}}
    />
  </div>,
);
