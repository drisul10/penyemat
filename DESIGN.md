# DESIGN.md

<!-- ryux-context:start -->
- **Product**: Penyemat
- **Platform**: Browser extension; the library opens as an extension page (Chromium and Firefox in v1; Safari after v1)
- **Audience**: General web users
- **Main job**: Find a saved link again later
- **Why choose it**: Search that works: full-text search of page content, not just titles
- **Character**: Quick, sharp, dependable
- **Market**: No specific market, English UI
- **Product docs**: PRD.md
- **UI direction**: Dog-ear (direction 1 of 3, chosen 2026-11-19)
<!-- ryux-context:end -->

## Visual and motion language

```yaml
direction:
  id: dog-ear
  name: Dog-ear
  status: chosen            # user choice, 2026-11-19, from directions.html (1 Dog-ear, 2 Index, 3 Wayfinder)
  philosophy: functional, with one expressive motif
  grounding: everyday ritual of folding a page corner to mark it
  grammar:
    type: slab headings + grotesk body
    colour_behaviour: high contrast on a saturated warm field
    shape: sharp, with one cut corner
    density: balanced in the brand band, compact in lists
    material: dimensional vector (flat shapes, one fold shadow)
    imagery: dimensional vector of folded cards; brand moments only
    motion: functional
  rests_on: [general web users, find it again, quick sharp dependable]
  category_default_declined: white page, blue accent, thumbnail card grid, folder sidebar
  weight_carrier: the marigold brand field with the folded-card stack (hero asset in directions.html)
  type:
    heading: Zilla Slab 700       # proposed: a slab reads firm at small sizes
    body: Work Sans 400/500/600   # proposed: neutral, legible at 13-15px
    figures: tabular for dates and counts
  colour:                   # proposed until the team confirms
    scheme: analogous warm (marigold, umber) + tomato for matches
    neutrals_source: marigold hue at low saturation
    roles:
      brand_field: "#FFC21A"     # brand band and save moment only, never behind lists
      ink: "#1E1605"             # text and primary action
      action_text_on_ink: "#FFC21A"
      leaf: "#FFFBF0"            # work surface and cards
      umber: "#5C4A1F"           # secondary text
      tomato: "#C2341A"          # search match only
      fold_shadow: "#E9A800"
    contrast:                    # measured
      ink_on_brand_field: 11.08
      brand_field_on_ink: 11.08
      ink_on_leaf: 17.33
      umber_on_leaf: 8.27
      tomato_on_leaf: 5.34
  shape:
    radius: [4]
    signature_cut: 22px folded corner, top right, on saved items
  depth: flat; one fold shadow on the corner; no drop shadows on cards
  motion:
    durations: [220]
    save: corner folds, 220ms ease-out; reduced motion shows the folded state without animation
  signature: folded corner on every saved item
  avoid: [marigold behind lists or long text, drop shadows, more than one accent on a screen]
  trade_offs:
    - yellow over large areas tires the eye, so the field is limited to the brand band and the save moment
```

## Library layout

- Chosen 2026-11-19 from alternatives.html (A Ask, B Timeline, C Shelves). User's words: "A + D: A's big search field at the top, with D's saves-grouped by default/custom category on shelves of folded cards (like C)."

## Business rules

Decided (user, 2026-11-19):
- Categories · a starter set ships with the product, and users can edit it ("Starter set users can edit")
- Category at save · optional at save, changeable later ("Optional at save, changeable later")
- Categories per link · one category per link ("No, one category per link")
- No server · no database server and no network server; everything runs on the client ("NO DB server, NO NETWORK server, everything is in client")
- Library location · inside the extension ("Inside the extension")
- Search · typo-tolerant keyword search, on device ("Typo-tolerant keyword search")
- Locked shelf · one shelf, shown closed, encrypted with a passphrase ("Encrypt with a passphrase", "One locked shelf, shown closed")
- Relock · when the library closes, or after idle time ("When the library closes, or after idle time")
- Save into locked shelf · a separate "Save to Locked" command (right-click menu, optional shortcut) saves encrypted only; the popup's Locked chip moves an already-saved page with a warning ("Separate 'Save to Locked' command")
- Backup · export and import a file ("Export/import a file")
- Browsers · Chromium and Firefox in v1; Safari after v1 ("Not yet, Safari after v1")
- Scale · up to 10,000 bookmarks with full text indexed ("Up to 10,000")
- Starter categories · Read later and Unsorted only; users add their own ("the starter should only contain "Read later" and "Unsorted". Let user adding themself.")
- No category picked · goes to an Unsorted shelf, always last, can't be renamed or deleted ("An 'Unsorted' shelf")
- Deleted category · its links move to Unsorted ("Move to Unsorted")
- Undo after deleting a link · 10 seconds ("10 seconds")
- Relock idle time · user sets it in Settings, default 5 minutes, range 1 to 60 ("User picks in Settings")
- Passphrase · at least 8 characters ("8 characters")
- Wrong passphrase attempts · no limit ("No limit")
- Accounts and telemetry · none ("No accounts, sign-in, or telemetry")
- Page text cap · first 100 KB per bookmark ("First 100 KB of text")
- Import duplicates · keep the newer copy, report counts ("Keep newer, report count")
- Unreadable page text · save it; search covers title and address only ("Save it; search title and address only")

Not decided (rule · words that find it on a screen · word its label carries):
- None.

## Corrections

- 2026-11-19 · Brand name Bookmarker → Penyemat. User: "rename brand name "Bookmarker" to "Penyemat", also change folder name"
- 2026-11-19 · Starter categories Read later, Recipes, Travel, Home → Read later and Unsorted only. User: "the starter should only contain "Read later" and "Unsorted". Let user adding themself."
