import { apiServer } from '@/lib/api-server';
import ChatbotSettings from './ChatbotSettings';
import type { WhatsappSettings } from '../../whatsapp/WhatsappSettingsPanel';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const settings = await apiServer<WhatsappSettings | null>('/whatsapp/settings').catch(() => null);
  return <ChatbotSettings initial={settings} />;
}
