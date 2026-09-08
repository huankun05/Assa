/* eIsland / 汐月 renderer-side identity cache. */

let cached: { visible_name: string; english_name: string; model_default: string } | null = null;

export async function getXiyueVisibleName(): Promise<string> {
  if (cached?.visible_name) return cached.visible_name;
  try {
    const data = await window.api?.xiyueIdentity?.();
    if (data?.visible_name) {
      cached = {
        visible_name: String(data.visible_name),
        english_name: String(data.english_name || 'Xiyue'),
        model_default: String(data.model_default || 'qwen3-4b-32k'),
      };
      return cached.visible_name;
    }
  } catch {
    // ignore
  }
  return '汐月';
}

export function getXiyueVisibleNameSync(): string {
  return cached?.visible_name || '汐月';
}

export async function getXiyueEnglishName(): Promise<string> {
  if (cached?.english_name) return cached.english_name;
  const _ = await getXiyueVisibleName();
  return cached?.english_name || 'Xiyue';
}

export function getXiyueEnglishNameSync(): string {
  return cached?.english_name || 'Xiyue';
}

export async function getXiyueModelDefault(): Promise<string> {
  if (cached?.model_default) return cached.model_default;
  try {
    const data = await window.api?.xiyueIdentity?.();
    if (data?.model_default) {
      cached = cached || { visible_name: '汐月', english_name: 'Xiyue', model_default: '' };
      cached.model_default = String(data.model_default);
      return cached.model_default;
    }
  } catch {
    // ignore
  }
  return 'qwen3-4b-32k';
}

export function getXiyueModelDefaultSync(): string {
  return cached?.model_default || 'qwen3-4b-32k';
}

export function invalidateXiyueIdentityCache(): void {
  cached = null;
}
