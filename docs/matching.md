# Tire matching

How a Material Sales tire description becomes one exact tire from the claim page's Eligible Product list.
This is the old app's matcher (`git show origin/legacy:auto_spiffer/match.py`, `tirespec.py`, `sizes.py`,
`brands.py`, `product_map.py`, `report_match.py`), which was right on every real September 2026 line. Keep
its rules; rewrite the code simply.

## The problem

The report and the claim page word a tire differently, and the report has no fixed field order:

```
235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)    size first, brand code, model, size again
NIT TERRA GRAPPLER G3 275/60R20XL 116T                        brand code first, size last
205/50R17 93H XL General AltiMAX RT45 BLK                     full brand name
```

The claim page says `General Altimax RT45 - Passenger Tires`. Plain fuzzy matching is dangerous: `RT43` and
`RT45` look almost the same but are different tires. So the matcher pulls the description apart by shape,
then asks "which tire on the list is best explained by these words, for this brand?".

## 1. Which rows are tires

A sales row is **not a tire** (shown as "Not a tire", never matched) when its description contains
`shipping` or `handling`, or the word `tube`, or no tire size. Matching is case-insensitive.

## 2. Taking a description apart (order does not matter)

Remove, everywhere they appear (the report often repeats them):

1. **Sizes**, case-insensitive, not inside a longer word:
   - metric `(?:LT|ST|P)?\d{3}/\d{2}\s?Z?R\s?\d{2}(?:XL|LT)?(?:/\d{1,2})?` (`235/50R18`, `255/35ZR19XL`, `LT265/75R16/10`, `ST205/75R14/8`)
   - flotation `(?:LT)?\d{2}\s?X\s?\d{1,2}(?:\.\d{1,2})?\s?R\s?\d{2}(?:LT)?(?:/\d{1,2})?` (`35X12.5R18LT/12`, `LT37X12.50R20/10`)
   - bias `\d{1,2}X\d{1,2}(?:\.\d{1,2})?(?:/\d{1,2}(?:\.\d{1,2})?)?-\d{1,2}` (`18X8.50/9.50-8`)
   - wrapped as `(?<![\w/])(?:metric|flotation|bias)(?![\w])`
2. **Mileage warranties**: `\(?(?<![\w/])\d{2,3}K(?![\w])\)?` (`65K`, `(65K)`).
3. **Load and speed ratings**: `(?<![\w/])\d{2,3}(?:/\d{2,3})?[JLMNPQRSTUHVWY](?![\w/])` (`97H`, `123/120S`).
   `K` is left out on purpose: `65K` is a warranty.
4. Split the rest on whitespace and strip `()[],;:` from each word's ends.
5. **Noise words** (case-insensitive): `BW M XL RF SL OWL RWL WL 3PMS 3PMSF M+S M/S MS BLK`, and the pattern
   `^\d{1,2}PR$` (ply ratings). (`BLK` is new in 1.0: the Excel export's full-brand rows end in it.)
6. **The brand.** Look each remaining word up in the brand table:

   | On the claim page (code → name) | Not on the claim page (never eligible) |
   |---|---|
   | CON Continental, FAL Falken, GEN General, HER Hercules, NIT Nitto, NOK Nokian, TOY Toyo, PIRELLI Pirelli | CAR Carlisle, FST FST, IRON Ironman |

   The full brand names work as codes too (`General`, `Toyo`). The Excel export also writes brands that
   are never on the list in full (Michelin, Yokohama, Kenda, Advanta, BFGoodrich). They are simply unknown
   brands, and fall through to "nothing on the list matches".
   - One brand found: that is the brand; remove its words.
   - Several brands found and one is **not** on the claim page: that one wins, and the others stay as model
     words. (`IRON iMOVE GEN 3 AS` is an Ironman tire; `GEN` is part of its model name.)
   - Several brands, all on the claim page: the brand is ambiguous; keep every word, and match against those
     brands' tires.
7. What is left are the **model words**, for example `AltiMAX`, `RT45`.

## 3. The tire list

Each dropdown label `"<Brand> <Model> - <Category>"` gives:
- **category**: the text after the last ` - `, without the word `Tires`, words capitalized
  (`BOAT TRAILER TIRES` → `Boat Trailer`);
- **brand**: the longest brand name from the table that the label starts with, followed by a space; else
  the first word;
- **model**: the rest of the name.

A label with no ` - ` and ending in `Wheel` or `Wheels` is a **wheel** and is never matched to a tire sale.

## 4. Matching, in tiers (first confident answer wins)

**Compact** a text: lowercase, keep only `a-z` and `0-9`.

**Identity tokens** say *which* tire it is: a compact word with a digit (`rt45`, `g3`, `7`), a roman numeral
(`[ivx]{2,}`), or all letters and at most 3 long (`ht`, `at`, `as`, `one`). They must match exactly in both
directions. Longer descriptive words may have a small spelling slip or be missing from the report.

1. **Saved match.** The person decided this wording before (section 6): use it. A saved "not eligible" makes
   the line Not eligible. A saved tire that is no longer on the list is ignored for now (kept, see section 6).
   A saved match wins even over a brand that is never eligible.
2. **Brand gate.** A brand that is not on the claim page: Not eligible, "Carlisle is not on the claim page".
   A known brand with no tires on the list: Not eligible. The pool is that brand's tires (or the ambiguous
   brands' tires, or every tire when no brand was found). No model words left: Not eligible.
3. **Exact.** The compacted model words joined equal one pool tire's compacted model: Ready, score 100. Equal
   to several: Needs a decision ("the name matches more than one tire").
4. **Word match.** For each pool tire, walk its model words in order:
   - first try 3, then 2 of its consecutive words joined, found as one description word or as 2 to 3
     adjacent unused description words joined (`TerrainContact`, `A TX`, `ATX` all match `A/TX` or
     `Terrain Contact`);
   - else the single word, found the same way;
   - else, for a non-identity word of 5 or more letters, the most similar unused non-identity description
     word of 5 or more letters with a similarity of at least **88** (see below);
   - else the word is *missing*.

   Then:
   - `coverage` = matched characters of the tire's words / all characters of the tire's words
   - `explained` = characters of the used description words / all characters of the description words
   - `score` = 100 × 2 × coverage × explained / (coverage + explained) (0 if both are 0)
   - *identity missing*: missing tire words that are identity tokens
   - *identity extra*: unused description words that are identity tokens
   - *unexplained*: unused description words

   Sort tires by score (high first), then fewest missing words, then label. The best three with a score of
   at least 25 are the **suggestions**.
   - Best score below **50**: Not eligible ("nothing on the list for Nitto matches 'NT420V'").
   - **Ready** only when all hold: the brand is known; no identity token is missing or extra; no description
     word is unexplained; coverage ≥ 0.5; the lead over the runner-up is at least **15** points.
   - Otherwise **Needs a decision**, with the best tire as the guess and a reason built from what failed:
     "the list tire has HT which the report line does not", "the report line has RT43 which the list tire
     does not", "extra words in the report line: X-JOURNEY", "only part of the tire name was found",
     "<runner-up> is almost as close", "the brand was not recognized".

**Similarity** is RapidFuzz's `ratio`: with `L` the length of the longest common subsequence of the two
strings, `100 × 2L / (len(a) + len(b))`. (Not Levenshtein: implement this directly, it is a few lines.)

The suggestion percentages shown on the Review screen are these scores, rounded.

## 5. Merging split rows

After matching, rows with the same **invoice**, **sale date**, **status** and the same **tire** (the matched
tire for Ready rows, the wording signature for the rest) become one line, quantities added (qty 1 and qty 3
become 4). Different tires on one invoice stay separate lines. Inputs are not changed. A merged line shows
`*` after its quantity on the Review screen.

## 6. Saved matches

- The key is the wording **signature**: `<brand name lowercased, or ?>|<compacted model words>`, for example
  `nokian|one`. Size, load, warranty and noise do not affect it, so `245/55R19 NOK ONE 80K` and
  `nok one 215/70R16` share `nokian|one`, but `NOK ONE X` does not.
- The value is the exact dropdown label, or "not eligible", plus one example description and the date.
- When a saved label is not in the current tire list, the match is kept but marked inactive and ignored, and
  it works again when the tire returns.
- The person can remove any saved match in Settings.

## Known cases (use them as tests)

Descriptions are real report wording. The expected labels are from the October 2026 list.

**Exact (Ready):**

| Description | Tire |
|---|---|
| `235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)` | General Altimax RT45 - Passenger Tires |
| `LT255/75R17/6 111/108S TOY OPEN COUNTRY A/T III 50K LT255/75R17/6 BW 111/108S (50K)` | Toyo Open Country A/T III - Light Truck Tires |
| `LT265/75R16/10 123/120S NOK OUTPOST NAT BW 60K` | Nokian Outpost nAT - Light Truck Tires |
| `225/65R17 102H CON SECURECONTACT AW BW 60K` | Continental SecureContact AW - Passenger Tires |
| `265/70R16 112T FAL WILDPEAK A/T4W BW 65K` | Falken Wildpeak A/T4W - Light Truck Tires |
| `205/60R16 92V FAL AKLIMATE BW 65K` | Falken Aklimate - Passenger Tires |
| `NIT TERRA GRAPPLER G3 275/60R20XL 116T` | Nitto Terra Grappler G3 - Light Truck Tires |
| `ALTIMAX RT45 205/55R16` (no brand, unique name) | General Altimax RT45 - Passenger Tires |
| `205/50R17 93H XL General AltiMAX RT45 BLK` | General Altimax RT45 - Passenger Tires |
| `LT285/50R22 121/118R E Toyo Open Country A/T III BLK` | Toyo Open Country A/T III - Light Truck Tires |
| `LT295/55R20 123/120T E/10 Nitto Terra Grappler G3 BLK` | Nitto Terra Grappler G3 - Light Truck Tires |
| `255/55R20XL 110V NOK REMEDY WRG5 BW 60K` | Nokian Remedy WRG5 - Passenger Tires |

The last three Excel-only rows contain `E` and `E/10` (load range). Make sure they still reach Ready: treat a
lone `[A-F]` or `[A-F]/\d{1,2}` load-range word as noise, and confirm with a test.

**Spacing and punctuation (Ready):** `GEN GRABBER ATX 265/70R17` and `GEN GRABBER A TX 265/70R17` → General
Grabber A/TX; `CON TERRAINCONTACT HT 265/70R17` → Continental Terrain Contact H/T.

**Word match (Ready):** `GEN RT45 ALTIMAX 205/55R16` (order), `GEN ALTIMAXX RT45 205/55R16` (spelling slip),
`HER STRONG GUARD ST ST205/75R14/8 105/101N` → Hercules Strong Guard ST Trailer (missing descriptive word).

**Needs a decision:**
- `GEN ALTIMAX RT43 205/55R16`: guess General Altimax RT45, reason names `RT43`.
- `245/55R19 103H NOK ONE BW 80K 245/55R19 103H (80K)`: guess Nokian One HT, reason names `HT`.
- `275/55R20XL 117T HER TERRA TRAC AT X-JOURNEY 3PMS 60K`: guess Hercules Terra Trac A/T (first suggestion),
  reason names `X-JOURNEY`, 1 to 3 suggestions.
- `RT45 205/55R16`: reason says the brand was not recognized.
- `CON VIKING CONTACT 9 205/55R16`: not Ready (while `... 8` and `... 7` match Viking Contact 8 and 7).

**Not eligible:**
- `ST185/80R13/8 CAR RADIAL TRAIL HD ST185/80R13/8 BW M`: Carlisle is not on the claim page.
- `205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K`: Ironman is not on the claim page.
- `305/40R22XL 114H NIT NT420V`, `255/35ZR19XL 96Y CON EXTREMECONTACT DWS06 PLUS 50K`,
  `205/65R16 95H HER ROADTOUR CONNECT AS BW 55K`, `225/65R17 102H NOK NORDMAN SOLSTICE 4 BW 50K`: nothing on
  the list for that brand.
- `245/45R19 102V XL Michelin CrossClimate2 AW BLK`: Michelin is not on the list.
- `ATD STEEL WHEELS 225/65R17`: never matched to a wheel.

**Not a tire:** `18X8.50/9.50-8 FST IMPORT TR13 TUBE 18X850/950-8` (tube), `Shipping and Handling`.

**Saved matches:** saving `NOK ONE` as Nokian One HT makes `215/70R16 99H NOK ONE 80K` Ready by saved match
but not `215/70R16 99H NOK ONE X 80K`; saving Ironman's wording as not eligible makes it Not eligible (saved);
saving a Carlisle wording as a Hercules tire makes it Ready.

**Merging:** the same invoice with `... HER TERRA TRAC AT X-JOURNEY ...` qty 1 and qty 3 becomes one line of 4;
`205/60R16 92V FAL AKLIMATE BW` qty 2 and `FAL AKLIMATE 205/60R16` qty 2 on one invoice become one line of 4;
the same tire on two invoices stays two lines.

## Unknowns

- Pirelli's short code on the report is not known. Until it is seen, Pirelli lines written with a code fall
  to "brand not recognized" and the person decides; the saved match covers it from then on.
