# Page Customization Studio — Admin Dashboard

## Background

The YASH luxury e-commerce site is a **single-file Next.js + MongoDB app** where:
- All views (Home, Shop, Concierge, etc.) are rendered in `app/page.js` as React components.
- Settings/content (hero, about, lookbook, concierge) are stored as a MongoDB document and fetched via `/api/settings`.
- The Admin Studio lives at `app/page.js > AdminView()` with tabs: Overview, Products, Collections, Orders, Inquiries, Settings.
- Currently, Settings only allows editing global site text/images — no per-page layout control.

The goal is to add a **"Page Studio"** tab in the Admin Dashboard — a visual, Figma-like per-page customizer for 5 pages: **Shop, Women, Men, Accessories, Concierge**.

---

## Proposed Architecture

### How "Page Layout" Works
Each page will have a **section-based layout config** stored in MongoDB inside the `settings` document under a `pageLayouts` key:

```json
{
  "pageLayouts": {
    "shop": { "sections": [...] },
    "womenswear": { "sections": [...] },
    "menswear": { "sections": [...] },
    "accessories": { "sections": [...] },
    "concierge": { "sections": [...] }
  }
}
```

Each section in the `sections` array is an object like:
```json
{
  "id": "hero-banner",
  "type": "hero-banner",
  "visible": true,
  "order": 0,
  "content": {
    "title": "Womenswear",
    "subtitle": "Softly tailored silhouettes",
    "image": "https://...",
    "ctaLabel": "Shop Now",
    "ctaAction": "filter:womenswear"
  },
  "style": {
    "textAlign": "center",
    "overlayOpacity": 0.4,
    "height": "60vh"
  }
}
```

### Available Section Types
| Type | Used in | Controls |
|---|---|---|
| `hero-banner` | All pages | Image, Title, Subtitle, CTA, Overlay opacity, Height, Text align |
| `product-grid` | Shop/Women/Men/Accessories | Columns (2/3/4), Max items, Sort, Featured only toggle |
| `editorial-text` | All | Title, Body copy, alignment (left/center/right) |
| `lookbook-strip` | Any | Images array, Offset (staggered vs flat) |
| `promo-banner` | Any | Background color, text, CTA |
| `concierge-form` | Concierge | Title, subtitle, email/phone editable |

---

## User Review Required

> [!IMPORTANT]
> **No drag-and-drop library will be added** to keep bundle size small. Instead, sections will have UP/DOWN reorder buttons — functionally equivalent to Figma order control, without extra dependencies.

> [!NOTE]
> This is not a full no-code builder (like Webflow). It is a **structured section editor** — admins can reorder, show/hide, and edit the content of named page sections. New section types can only be added by developers (by defining them). This is the practical approach for a production app.

---

## Open Questions

> [!IMPORTANT]
> **Q1**: Should the Shop page (filter sidebar, product grid) also be customizable in terms of **which filters are shown** (e.g., hide Color filter, show only Size and Price)? Or just the hero banner above the grid?
>
> **Q2**: For the Concierge page — the form captures name/email/phone/message. Do you want admins to be able to add or remove form fields, or only edit the text around it?
>
> **Q3**: Should the live preview inside the Studio be a full interactive iframe (real-time) or a styled static mock? (Full iframe is more complex but possible since this is a Next.js SPA.)

---

## Proposed Changes

### Backend — `/api/settings` (route.js)

#### [MODIFY] [route.js](file:///c:/Users/Shubham/Downloads/YASHCO/app/api/[[...path]]/route.js)
- Add `pageLayouts` key to the seed data with default section configs for all 5 pages.
- The existing `PUT /api/settings` already accepts any field — no route changes needed; the frontend will POST `{ pageLayouts: {...} }` as part of settings.

---

### Frontend — `app/page.js`

#### [MODIFY] [page.js](file:///c:/Users/Shubham/Downloads/YASHCO/app/page.js)

**1. AdminView — Add "Page Studio" tab**
- Add `page-studio` to the tabs array: `['overview','products','collections','orders','inquiries','settings','page-studio']`
- Render `<AdminPageStudio/>` in the new tab content.

**2. AdminPageStudio component (NEW, ~350 lines)**
- Left panel: page selector (Shop, Women, Men, Accessories, Concierge) as tabs/list.
- Right/main panel: section list for selected page.
- Each section card shows:
  - Drag handles replaced by ↑ ↓ reorder buttons.
  - Eye toggle (show/hide).
  - "Edit" button opens a slide-out panel with content/style inputs.
  - Section type badge (e.g. "Hero Banner", "Product Grid").
- "Add Section" button opens a picker modal to choose section type.
- "Save Layout" saves the entire `pageLayouts` object via `PUT /api/settings`.

**3. ShopView — Make layout-aware (NEW)**
- On load, read `settings.pageLayouts?.shop?.sections` (or `womenswear`, etc.).
- If sections exist: render them **in order** (skipping `visible: false` sections).
- If no layout defined: fall back to current hardcoded layout (100% backward compatible).
- Each section type is rendered by a `renderSection(section, pageKey)` function.

**4. ConciergeView — Make layout-aware (NEW)**
- Same approach: read `settings.pageLayouts?.concierge?.sections`.

**5. Section Renderer functions (NEW, ~200 lines)**
- `HeroBannerSection`, `ProductGridSection`, `EditorialTextSection`, `LookbookStripSection`, `PromoBannerSection`, `ConciergeFormSection` — each is a styled React component reading from `section.content` and `section.style`.

---

## Verification Plan

### Manual Verification
1. Log in as admin (`yashcoofficial@gmail.com / Admin@123`).
2. Navigate to Admin Studio → Page Studio tab.
3. Select "Women" page.
4. Change the hero banner title and image URL → Save.
5. Navigate to the Women/Womenswear shop page → verify the hero banner reflects the change.
6. Reorder sections (move Product Grid above Hero Banner) → Save → verify order on page.
7. Hide a section → Save → verify it disappears on the page.
8. Add a new Editorial Text section → fill content → Save → verify it appears.
9. Test Concierge page customization similarly.
10. Verify backward compatibility: if `pageLayouts` is empty, pages still render with default hardcoded layout.
