import { describe, expect, it } from 'vitest'

import { classifyCrop } from '@/lib/crop-groups'

describe('classifyCrop', () => {
  it('does not find a keyword inside another word', () => {
    expect(classifyCrop(531, 'Anden træfrugt')).toBe('other')
    expect(classifyCrop(484, 'Skovlandbrug med omdriftsafgrøder')).toBe('other')
    expect(classifyCrop(361, 'Ikke støtteberettiget landbrugsareal')).toBe(
      'other',
    )
    expect(classifyCrop(551, 'Moskusgræskar')).toBe('other')
  })

  it('finds a keyword at the start or the end of a word', () => {
    expect(classifyCrop(709, 'Grønkorn af vinterrug')).toBe('winterCereal')
    expect(classifyCrop(710, 'Grønkorn af hybridrug')).toBe('springCereal')
    expect(classifyCrop(423, 'Sukkermajs')).toBe('maize')
    expect(classifyCrop(424, 'Ærter, konsum')).toBe('legume')
    expect(classifyCrop(596, 'Elefantgræs')).toBe('grass')
    expect(classifyCrop(124, 'Spinatfrø')).toBe('seedGrass')
    expect(classifyCrop(342, 'Bestøverbrak')).toBe('fallow')
  })

  it('puts fruit, forest and pumpkins under Andet before the other rules', () => {
    expect(classifyCrop(521, 'Surkirsebær med undervækst af græs')).toBe(
      'other',
    )
    expect(classifyCrop(522, 'Blomme uden undervækst af græs')).toBe('other')
    expect(classifyCrop(482, 'Skovlandbrug med permanent græs')).toBe('other')
  })

  it('does not read farming as rye', () => {
    expect(classifyCrop(582, 'Pyntegrønt, økologisk jordbrug')).toBe('other')
    expect(classifyCrop(907, 'Naturarealer, økologisk jordbrug')).toBe('fallow')
  })
})
