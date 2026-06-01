import { apiServer } from '@/lib/api-server';
import GiftCardsScreen from './GiftCardsScreen';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const [settings, cards] = await Promise.all([
    apiServer<any>('/gift-cards/settings'),
    apiServer<any[]>('/gift-cards'),
  ]);
  return <GiftCardsScreen settings={settings} initialCards={cards} />;
}
