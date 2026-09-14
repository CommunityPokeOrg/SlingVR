export type ControlMode = 'friendly' | 'spectacular';

export const SETTINGS = {
  mode: 'friendly' as ControlMode,
};

const MODE_KEY = 'slingvr.mode';

export function loadMode(storage: Pick<Storage, 'getItem'>): ControlMode {
  return storage.getItem(MODE_KEY) === 'spectacular' ? 'spectacular' : 'friendly';
}

export function saveMode(storage: Pick<Storage, 'setItem'>, mode: ControlMode): void {
  storage.setItem(MODE_KEY, mode);
}

function availableStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function setMode(mode: ControlMode): ControlMode {
  SETTINGS.mode = mode;
  const storage = availableStorage();
  if (storage) {
    try {
      saveMode(storage, mode);
    } catch {
      // Storage may be disabled by the browser.
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ControlMode>('slingvr:mode', { detail: mode }));
  }
  return mode;
}

export function toggleMode(): ControlMode {
  return setMode(SETTINGS.mode === 'friendly' ? 'spectacular' : 'friendly');
}
