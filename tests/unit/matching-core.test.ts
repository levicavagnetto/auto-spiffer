import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseTireList } from '../../src/main/matching/tireList'
import { isEligibleBrand } from '../../src/main/matching/brands'
import {
  parseDescription,
  wordingSignature
} from '../../src/main/matching/parse'
import { similarity } from '../../src/main/matching/similarity'
import { matchTire } from '../../src/main/matching/match'

const labels = readFileSync('docs/reference/tire-list-2026-10.txt', 'utf8')
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
const tires = parseTireList(labels)

describe('claim page tire list', () => {
  it('recognizes all labels, wheels and the boat trailer category', () => {
    expect(tires).toHaveLength(77)
    expect(tires.filter((item) => item.kind === 'wheel')).toHaveLength(2)
    expect(
      tires
        .filter((item) => item.kind === 'tire')
        .every((item) => isEligibleBrand(item.brand))
    ).toBe(true)
    expect(
      tires.find((item) => item.label.includes('BOAT TRAILER'))
    ).toMatchObject({
      brand: 'Hercules',
      model: 'Strong Guard ST Trailer',
      category: 'Boat Trailer'
    })
  })
})

describe('report wording', () => {
  it('removes repeated sizes, ratings, warranty and noise from the signature', () => {
    expect(
      wordingSignature(
        parseDescription('245/55R19 103H NOK ONE BW 80K 245/55R19 (80K)')
      )
    ).toBe('nokian|one')
    expect(wordingSignature(parseDescription('nok one 215/70R16 99H'))).toBe(
      'nokian|one'
    )
    expect(wordingSignature(parseDescription('NOK ONE X 215/70R16'))).toBe(
      'nokian|onex'
    )
  })
  it('lets the outside brand win over a code in its model', () => {
    expect(
      parseDescription('205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K')
    ).toMatchObject({ brand: 'Ironman', words: ['iMOVE', 'GEN', '3', 'AS'] })
  })
  it('keeps both candidates when two eligible brand codes appear', () => {
    expect(parseDescription('GEN NOK MODEL 205/55R16')).toMatchObject({
      brand: null,
      brandCandidates: ['General', 'Nokian'],
      words: ['GEN', 'NOK', 'MODEL']
    })
  })
  it('treats Excel load range words as noise', () => {
    expect(
      parseDescription('LT285/50R22 121/118R E Toyo Open Country A/T III BLK')
        .words
    ).toEqual(['Open', 'Country', 'A/T', 'III'])
    expect(
      parseDescription('LT295/55R20 123/120T E/10 Nitto Terra Grappler G3 BLK')
        .words
    ).toEqual(['Terra', 'Grappler', 'G3'])
  })
})

it('uses the LCS ratio rather than edit distance', () => {
  expect(similarity('altimax', 'altimaxx')).toBeCloseTo(93.333, 2)
})

const ready: [string, string][] = [
  [
    '235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)',
    'General Altimax RT45 - Passenger Tires'
  ],
  [
    'LT255/75R17/6 111/108S TOY OPEN COUNTRY A/T III 50K LT255/75R17/6 BW 111/108S (50K)',
    'Toyo Open Country A/T III - Light Truck Tires'
  ],
  [
    'LT265/75R16/10 123/120S NOK OUTPOST NAT BW 60K',
    'Nokian Outpost nAT - Light Truck Tires'
  ],
  [
    '225/65R17 102H CON SECURECONTACT AW BW 60K',
    'Continental SecureContact AW - Passenger Tires'
  ],
  [
    '265/70R16 112T FAL WILDPEAK A/T4W BW 65K',
    'Falken Wildpeak A/T4W - Light Truck Tires'
  ],
  ['205/60R16 92V FAL AKLIMATE BW 65K', 'Falken Aklimate - Passenger Tires'],
  [
    'NIT TERRA GRAPPLER G3 275/60R20XL 116T',
    'Nitto Terra Grappler G3 - Light Truck Tires'
  ],
  ['ALTIMAX RT45 205/55R16', 'General Altimax RT45 - Passenger Tires'],
  [
    '205/50R17 93H XL General AltiMAX RT45 BLK',
    'General Altimax RT45 - Passenger Tires'
  ],
  [
    'LT285/50R22 121/118R E Toyo Open Country A/T III BLK',
    'Toyo Open Country A/T III - Light Truck Tires'
  ],
  [
    'LT295/55R20 123/120T E/10 Nitto Terra Grappler G3 BLK',
    'Nitto Terra Grappler G3 - Light Truck Tires'
  ],
  [
    '255/55R20XL 110V NOK REMEDY WRG5 BW 60K',
    'Nokian Remedy WRG5 - Passenger Tires'
  ],
  ['GEN GRABBER ATX 265/70R17', 'General Grabber A/TX - Light Truck Tires'],
  ['GEN GRABBER A TX 265/70R17', 'General Grabber A/TX - Light Truck Tires'],
  [
    'CON TERRAINCONTACT HT 265/70R17',
    'Continental Terrain Contact H/T - Light Truck Tires'
  ],
  ['GEN RT45 ALTIMAX 205/55R16', 'General Altimax RT45 - Passenger Tires'],
  ['GEN ALTIMAXX RT45 205/55R16', 'General Altimax RT45 - Passenger Tires'],
  [
    'HER STRONG GUARD ST ST205/75R14/8 105/101N',
    'Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES'
  ],
  [
    'CON VIKING CONTACT 7 205/55R16',
    'Continental Viking Contact 7 - Passenger Tires'
  ],
  [
    'CON VIKING CONTACT 8 205/55R16',
    'Continental Viking Contact 8 - Passenger Tires'
  ]
]

describe('matching known cases', () => {
  it.each(ready)('readies %s', (description, label) => {
    expect(matchTire(description, tires)).toMatchObject({
      status: 'ready',
      tire: label
    })
  })
  it.each([
    [
      'GEN ALTIMAX RT43 205/55R16',
      'General Altimax RT45 - Passenger Tires',
      'RT43'
    ],
    [
      '245/55R19 103H NOK ONE BW 80K',
      'Nokian One HT - Light Truck Tires',
      'HT'
    ],
    [
      '275/55R20XL 117T HER TERRA TRAC AT X-JOURNEY 3PMS 60K',
      'Hercules Terra Trac A/T - Light Truck Tires',
      'X-JOURNEY'
    ],
    [
      'RT45 205/55R16',
      'General Altimax RT45 - Passenger Tires',
      'brand was not recognized'
    ]
  ])('holds %s for a decision', (description, guess, why) => {
    const result = matchTire(description, tires)
    expect(result.status).toBe('needs-decision')
    expect(result.guess).toBe(guess)
    expect(result.reason).toContain(why)
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.suggestions.length).toBeLessThanOrEqual(3)
  })
  it.each([
    ['ST185/80R13/8 CAR RADIAL TRAIL HD', 'Carlisle'],
    ['205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K', 'Ironman'],
    ['305/40R22XL 114H NIT NT420V', 'Nitto'],
    ['255/35ZR19XL 96Y CON EXTREMECONTACT DWS06 PLUS 50K', 'Continental'],
    ['205/65R16 95H HER ROADTOUR CONNECT AS BW 55K', 'Hercules'],
    ['225/65R17 102H NOK NORDMAN SOLSTICE 4 BW 50K', 'Nokian'],
    ['245/45R19 102V XL Michelin CrossClimate2 AW BLK', 'Michelin']
  ])('excludes %s', (description, brand) => {
    expect(matchTire(description, tires)).toMatchObject({
      status: 'not-eligible',
      reason: expect.stringContaining(brand)
    })
  })
  it('never readies a different model number or a wheel', () => {
    expect(matchTire('CON VIKING CONTACT 9 205/55R16', tires).status).not.toBe(
      'ready'
    )
    expect(matchTire('ATD STEEL WHEELS 225/65R17', tires).status).not.toBe(
      'ready'
    )
  })
  it('uses a saved choice before the brand gate but ignores absent labels', () => {
    const saved = {
      'carlisle|radialtrailhd': {
        label: 'Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES',
        example: 'CAR RADIAL TRAIL HD',
        decidedOn: '2026-10-26'
      }
    }
    expect(
      matchTire('ST185/80R13/8 CAR RADIAL TRAIL HD', tires, saved)
    ).toMatchObject({ status: 'ready', savedMatch: true })
    expect(
      matchTire('ST185/80R13/8 CAR RADIAL TRAIL HD', tires.slice(0, 10), saved)
        .status
    ).toBe('not-eligible')
  })
  it('applies a saved not eligible decision only to the same signature', () => {
    const saved = {
      'nokian|one': { label: null, example: 'NOK ONE', decidedOn: '2026-10-26' }
    }
    expect(matchTire('NOK ONE 245/55R19', tires, saved)).toMatchObject({
      status: 'not-eligible',
      savedMatch: true
    })
    expect(matchTire('NOK ONE X 245/55R19', tires, saved).savedMatch).toBe(
      false
    )
  })
})
