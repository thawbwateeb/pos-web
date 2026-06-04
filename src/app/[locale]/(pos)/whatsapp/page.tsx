import { apiServer } from '@/lib/api-server';
import WhatsappScreen from './WhatsappScreen';
import type { WhatsappSettings } from './types';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [convos, settings] = await Promise.all([
    apiServer<any[]>('/whatsapp/conversations'),
    apiServer<WhatsappSettings | null>('/whatsapp/settings'),
  ]);
  return <WhatsappScreen conversations={convos} settings={settings} />;
}
