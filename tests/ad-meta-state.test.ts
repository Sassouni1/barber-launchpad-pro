import { describe, it, expect } from 'bun:test';
import { adMetaStage, canCreateOrLink, needsMetaCheck } from '../src/lib/adMetaState';

describe('adMetaStage', () => {
  it('a local status never reads as a Meta campaign without a stored Meta ID', () => {
    expect(adMetaStage({ meta_campaign_id: null })).toBe('local_draft');
    expect(adMetaStage({ meta_campaign_id: null, meta_effective_status: 'ACTIVE' })).toBe('local_draft');
  });

  it("uses Meta's effective_status to separate PAUSED from ACTIVE", () => {
    expect(adMetaStage({ meta_campaign_id: '120', meta_effective_status: 'PAUSED' })).toBe('meta_paused');
    expect(adMetaStage({ meta_campaign_id: '120', meta_effective_status: 'ACTIVE' })).toBe('meta_active');
    expect(adMetaStage({ meta_campaign_id: '120', meta_effective_status: null })).toBe('meta_unchecked');
  });
});

describe('create/link controls', () => {
  it('an unfinished or unknown Meta create offers only the read-only check, never another create', () => {
    for (const status of ['creating', 'unknown']) {
      expect(canCreateOrLink({ meta_create_status: status })).toBe(false);
      expect(needsMetaCheck({ meta_create_status: status })).toBe(true);
    }
    expect(canCreateOrLink({ meta_create_status: 'failed' })).toBe(true);
    expect(canCreateOrLink({ meta_campaign_id: '120', meta_create_status: 'created' })).toBe(false);
  });
});
