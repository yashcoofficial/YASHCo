# YashCo — Luxury eCommerce Platform & Page Studio

Welcome to **YashCo**, a state-of-the-art luxury fashion eCommerce platform built with Next.js and MongoDB. This project features a custom-built, fully visual CMS called **Page Studio** that gives you complete control over your website's layout and content in real-time.

---

## 🌟 Key Features

### 1. Visual WYSIWYG Page Studio
The crown jewel of this platform — a Figma-like editing experience directly within your application:

| Feature | Description |
|---|---|
| **Multi-Page Management** | Edit Home, Shop, Women, Men, Accessories, and Concierge pages from one dashboard |
| **Drag-and-Drop Canvas** | Reorder sections using intuitive drag handles |
| **True Visual Previews** | Core components like Shop Grid and Concierge Form render accurate visual proxies in the editor |
| **Live Property Editing** | Click any section → open its Properties panel → instantly update text, images, layout, etc. |
| **Image Aspect Ratios** | Resize images (Portrait 3:4, Square 1:1, Landscape 4:3, Widescreen 16:9) via dropdown |
| **Section Visibility Toggle** | Show/hide any section without deleting it |
| **Add New Sections** | Inject new Banner, Editorial Text, Lookbook Strip, or Promo Banner sections into any page |

### 2. High-End eCommerce Experience
- **Dynamic Product Catalog** with filtering by Collection, Size, Colour, Price Range + sort
- **Cart & Wishlist** — slide-out cart with quantity management
- **Product Detail Pages** — image galleries, size/color selection, inquiry forms
- **Concierge Booking Form** — private consultation request system
- **Responsive Premium Design** — quiet luxury aesthetic: muted beige, deep blacks, gold accents (#c8a15b)

### 3. Admin Dashboard
- Full **Products Manager** — add, edit, delete products
- **Collections Manager** — manage product collections with images
- **Settings Editor** — control brand settings, currency, and homepage content
- **Orders & Analytics** view

### 4. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | JavaScript / JSX |
| Styling | TailwindCSS v4 + Custom CSS |
| Icons | Lucide React |
| Database | MongoDB (via API routes) |
| Hosting | Vercel-ready |

---

## 🚀 Feature Walkthrough

### Page Studio — Editing a Page
1. Log in as Admin → click **Admin** in the navbar
2. Navigate to **Page Studio** from the admin panel
3. **Select a page** from the left sidebar (Home, Shop, Women, Men, Accessories, Concierge)
4. The **Canvas** in the center renders live previews of all sections
5. **Drag** sections up/down to reorder them
6. **Click** any section to open its **Properties panel** on the right
7. Edit text, upload images by URL, change layout columns, adjust aspect ratios
8. Click **Save Layouts** or **Save Section** to persist changes to the database

### Image Aspect Ratio Control
Available on: Collections Grid, Featured Products, Shop Product Grid
- `Portrait (3:4)` — classic fashion editorial style
- `Square (1:1)` — clean, modern grid
- `Landscape (4:3)` — editorial/lookbook
- `Widescreen (16:9)` — hero-style banners
- `Original Size` — display images at natural proportions

### Adding a New Section
1. Click **+ Add Another Section** at the bottom of the canvas
2. Choose a section type from the modal (Hero Banner, Editorial Text, Lookbook Strip, Promo Banner)
3. The new section appears in the canvas and is immediately editable

---

## 📦 Repository

Your code is now live on GitHub: **[Shubhambro007/YashCo](https://github.com/Shubhambro007/YashCo)**

```bash
# Run locally
npm run dev

# Available at:
http://localhost:3000
```

## Multiservice runtime

The application is split into two independently runnable services:

- **Web service**: the Next.js storefront and admin UI on port `3000`.
- **API service**: the MongoDB-backed REST API on port `4000`.

Run them from two terminals:

```bash
npm run dev:api
npm run dev:web
```

To make the web service send `/api/*` requests to the API service, start the web service with `API_SERVICE_URL`:

```bash
API_SERVICE_URL=http://localhost:4000 npm run dev:web
```

Without `API_SERVICE_URL`, Next keeps its built-in API route enabled for backwards-compatible single-process development. Both services use the existing `MONGO_URL`, `DB_NAME`, and authentication/email environment variables.

