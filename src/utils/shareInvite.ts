import { Linking, Share, Platform } from 'react-native';

export function buildInviteMessage(code: string, accountName = 'Our Home'): string {
  return (
    `Hey! Join my Expenso joint account "${accountName}" so we can manage expenses together 💑\n\n` +
    `Invite code: ${code}\n\n` +
    `Steps:\n` +
    `1. Open Expenso\n` +
    `2. Register / Login\n` +
    `3. Profile → Join Joint Account\n` +
    `4. Enter code: ${code}`
  );
}

/** Opens WhatsApp with prefilled invite; falls back to system share sheet. */
export async function shareInviteViaWhatsApp(code: string, accountName?: string): Promise<void> {
  const message = buildInviteMessage(code, accountName);
  const encoded = encodeURIComponent(message);

  // Prefer WhatsApp if installed
  const waApp = `whatsapp://send?text=${encoded}`;
  const waWeb = `https://wa.me/?text=${encoded}`;

  try {
    const canOpen = await Linking.canOpenURL(waApp);
    if (canOpen) {
      await Linking.openURL(waApp);
      return;
    }
  } catch {
    // continue to fallbacks
  }

  try {
    await Linking.openURL(waWeb);
    return;
  } catch {
    // system share
  }

  await Share.share(
    Platform.OS === 'ios'
      ? { message }
      : { message, title: 'Expenso joint account invite' },
  );
}

export async function shareInviteCode(code: string, accountName?: string): Promise<void> {
  const message = buildInviteMessage(code, accountName);
  await Share.share(
    Platform.OS === 'ios'
      ? { message }
      : { message, title: 'Expenso joint account invite' },
  );
}
