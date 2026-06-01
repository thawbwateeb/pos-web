import { apiServer } from '@/lib/api-server';
import WhatsappScreen from './WhatsappScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [convos, settings] = await Promise.all([
    apiServer<any[]>('/whatsapp/conversations'),
    apiServer<any>('/whatsapp/settings'),
  ]);
  return <WhatsappScreen conversations={convos} settings={settings} />;
}
