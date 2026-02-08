import type { WhatsAppProvider } from './types';
import type { WhatsAppProvider as WhatsAppProviderName } from '../whatsapp-types';
import { mockProvider } from './mock-provider';
import { evolutionProvider } from './evolution-provider';
import { metaCloudProvider } from './meta-cloud-provider';

export type { WhatsAppProvider, WebhookRequest, ParsedInboundMessage, SendMessageParams, SendMessageResult } from './types';

export { mockProvider, evolutionProvider, metaCloudProvider };

const providerMap: Record<WhatsAppProviderName, WhatsAppProvider> = {
  meta_cloud: metaCloudProvider,
  evolution: evolutionProvider,
  mock: mockProvider,
};

/** Resolve provider instance by connection provider name. Mock is not in DB; use for tests. */
export function getProvider(providerName: WhatsAppProviderName): WhatsAppProvider {
  return providerMap[providerName] ?? metaCloudProvider;
}

/** For local/test use: provider that parses mock payloads and accepts verify. */
export function getMockProvider(): WhatsAppProvider {
  return mockProvider;
}
