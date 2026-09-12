import { describe, it, expect } from 'vitest';
import {
  TRUST_LEVEL_CARDS,
  DATA_CLASS_CARDS,
  DEFAULT_TRUST_LEVEL,
  getTrustLevelCard,
} from '../permissionCards';

describe('permissionCards', () => {
  it('has four trust levels with Chinese names', () => {
    expect(TRUST_LEVEL_CARDS).toHaveLength(4);
    expect(TRUST_LEVEL_CARDS.map((c) => c.name)).toEqual([
      '静默观察',
      '谨慎助手',
      '熟练助手',
      '完全托管',
    ]);
  });

  it('defaults to 谨慎助手', () => {
    expect(DEFAULT_TRUST_LEVEL).toBe(1);
    expect(getTrustLevelCard(DEFAULT_TRUST_LEVEL)?.name).toBe('谨慎助手');
    expect(getTrustLevelCard(DEFAULT_TRUST_LEVEL)?.isDefault).toBe(true);
  });

  it('clamps out-of-range level', () => {
    expect(getTrustLevelCard(-1)?.level).toBe(0);
    expect(getTrustLevelCard(9)?.level).toBe(3);
  });

  it('has D0–D3 data classes', () => {
    expect(DATA_CLASS_CARDS.map((c) => c.id)).toEqual(['D0', 'D1', 'D2', 'D3']);
  });

  it('every card documents risk and confirm policy', () => {
    for (const c of TRUST_LEVEL_CARDS) {
      expect(c.canAct.length).toBeGreaterThan(4);
      expect(c.canSee.length).toBeGreaterThan(4);
      expect(c.confirmPolicy.length).toBeGreaterThan(2);
      expect(c.riskNote.length).toBeGreaterThan(4);
    }
  });
});
