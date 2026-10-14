import TravelGallery from '@/components/TravelGallery';
import photos from '@/data/travel-photos.json';
import './travel.css';

export const metadata = {
  title: 'Travel',
  description: `Photographs from ${photos.groups.map(group => group.country).join(', ')}.`
};

export default function TravelPage() {
  return <TravelGallery groups={photos.groups} />;
}
