# vLLM Design Tokens Reference (Dark Mode)

> Extracted from [vllm.ai](https://vllm.ai/) on 2026-08-05.
> The site is a **Next.js** app deployed on **Vercel**, styled with **Tailwind CSS v4** and **shadcn/ui**-style CSS custom properties.
> Source repo: Not publicly available (private Vercel deployment). The blog lives at [vllm-project/vllm-project.github.io](https://github.com/vllm-project/vllm-project.github.io) (Jekyll), but the main site is a separate Next.js project.

---

## 1. Color Palette

### 1.1 Brand Colors

```css
--color-vllm-blue:    #30a2ff;   /* Primary brand blue */
--color-vllm-yellow:  #fdb517;   /* Secondary brand yellow / accent */
--vllm-yellow-hover:  #e5a315;   /* Yellow darkened for hover state */
```

### 1.2 Dark-Mode Semantic Tokens (`:root .dark`)

These are oklch values with hex equivalents (mapped to Tailwind's Slate scale).

```css
.dark {
  /* Surfaces */
  --background:           oklch(12.9% .042 264.695);   /* #020617  slate-950 */
  --foreground:           oklch(98.4% .003 247.858);   /* #f8fafc  slate-50  */
  --card:                 oklch(20.8% .042 265.755);   /* #0f172a  slate-900 */
  --card-foreground:      oklch(98.4% .003 247.858);   /* #f8fafc  slate-50  */
  --popover:              oklch(20.8% .042 265.755);   /* #0f172a  slate-900 */
  --popover-foreground:   oklch(98.4% .003 247.858);   /* #f8fafc  slate-50  */

  /* Interactive */
  --primary:              oklch(92.9% .013 255.508);   /* #e2e8f0  slate-300 */
  --primary-foreground:   oklch(20.8% .042 265.755);   /* #0f172a  slate-900 */
  --secondary:            oklch(27.9% .041 260.031);   /* #1e293b  slate-800 */
  --secondary-foreground: oklch(98.4% .003 247.858);   /* #f8fafc  slate-50  */

  /* Muted / subtle */
  --muted:                oklch(27.9% .041 260.031);   /* #1e293b  slate-800 */
  --muted-foreground:     oklch(70.4% .04  256.788);   /* #94a3b8  slate-400 */
  --accent:               oklch(27.9% .041 260.031);   /* #1e293b  slate-800 */
  --accent-foreground:    oklch(98.4% .003 247.858);   /* #f8fafc  slate-50  */

  /* Borders & inputs */
  --border:               oklch(100% 0 0 / .1);        /* white at 10% opacity */
  --input:                oklch(100% 0 0 / .15);       /* white at 15% opacity */
  --ring:                 oklch(55.1% .027 264.364);   /* #475569  slate-600 */

  /* Destructive */
  --destructive:          oklch(70.4% .191 22.216);    /* #f87171  red-400   */

  /* Charts */
  --chart-1:              oklch(48.8% .243 264.376);   /* #3b82f6  blue-600  */
  --chart-2:              oklch(69.6% .17  162.48);    /* #34d399  emerald-400 */
  --chart-3:              oklch(76.9% .188 70.08);     /* #f59e0b  amber-500 */
  --chart-4:              oklch(62.7% .265 303.9);     /* #a855f7  purple-500 */
  --chart-5:              oklch(64.5% .246 16.439);    /* #ef4444  red-500   */

  /* Sidebar */
  --sidebar:                  oklch(20.8% .042 265.755);   /* #0f172a */
  --sidebar-foreground:       oklch(98.4% .003 247.858);   /* #f8fafc */
  --sidebar-primary:          oklch(48.8% .243 264.376);   /* #3b82f6 */
  --sidebar-primary-foreground: oklch(98.4% .003 247.858); /* #f8fafc */
  --sidebar-accent:           oklch(27.9% .041 260.031);   /* #1e293b */
  --sidebar-accent-foreground: oklch(98.4% .003 247.858);  /* #f8fafc */
  --sidebar-border:           oklch(100% 0 0 / .1);        /* white 10% */
  --sidebar-ring:             oklch(55.1% .027 264.364);   /* #475569 */

  /* Radius */
  --radius: 0.625rem;  /* 10px */
}
```

### 1.3 Light-Mode Semantic Tokens (`:root`)

```css
:root {
  --background:           oklch(100% 0 0);             /* #ffffff  white     */
  --foreground:           oklch(12.9% .042 264.695);   /* #020617  slate-950 */
  --card:                 oklch(100% 0 0);             /* #ffffff  white     */
  --card-foreground:      oklch(12.9% .042 264.695);   /* #020617  slate-950 */
  --primary:              oklch(20.8% .042 265.755);   /* #0f172a  slate-900 */
  --primary-foreground:   oklch(98.4% .003 247.858);   /* #f8fafc  slate-50  */
  --secondary:            oklch(96.8% .007 247.896);   /* #f1f5f9  slate-100 */
  --muted:                oklch(96.8% .007 247.896);   /* #f1f5f9  slate-100 */
  --muted-foreground:     oklch(55.4% .046 257.417);   /* #64748b  slate-500 */
  --accent:               oklch(96.8% .007 247.896);   /* #f1f5f9  slate-100 */
  --border:               oklch(92.9% .013 255.508);   /* #e2e8f0  slate-300 */
  --input:                oklch(92.9% .013 255.508);   /* #e2e8f0  slate-300 */
  --ring:                 oklch(70.4% .04 256.788);    /* #94a3b8  slate-400 */
  --destructive:          oklch(57.7% .245 27.325);    /* #dc2626  red-600   */

  --radius: 0.625rem;
}
```

### 1.4 Hex Quick-Reference (Dark Mode)

| Token               | Hex       | Role                        |
|----------------------|-----------|-----------------------------|
| `--background`       | `#020617` | Page background (slate-950) |
| `--foreground`       | `#f8fafc` | Primary text (slate-50)     |
| `--card`             | `#0f172a` | Card / surface (slate-900)  |
| `--muted`            | `#1e293b` | Muted surface (slate-800)   |
| `--muted-foreground` | `#94a3b8` | Secondary text (slate-400)  |
| `--border`           | `rgba(255,255,255,0.1)` | Borders          |
| `--input`            | `rgba(255,255,255,0.15)` | Input borders   |
| `--vllm-blue`        | `#30a2ff` | Primary brand accent        |
| `--vllm-yellow`      | `#fdb517` | Secondary brand accent      |
| `--vllm-yellow-hover`| `#e5a315` | Yellow hover state          |

### 1.5 Additional Named Colors in Use

```
#06152e   — Hero gradient start (dark navy)
#0b4f8f   — Hero gradient mid
#30a2ff   — Hero gradient end (= vllm-blue)
#4A154B   — Slack purple (used in community section)
#E01E5A   — Slack accent pink/red
```

---

## 2. Typography

### 2.1 Font Families

```css
--font-inter:     "Inter", "Inter Fallback";           /* Body / UI text */
--font-jetbrains: "JetBrains Mono", "JetBrains Mono Fallback"; /* Code / monospace */
```

Both fonts are self-hosted as variable woff2 files via Next.js font optimization (no external CDN required). The CSS variable names on `<html>`:

```css
.__variable_1b85de { --font-inter: "Inter", "Inter Fallback"; }
.__variable_fdaf1b { --font-jetbrains: "JetBrains Mono", "JetBrains Mono Fallback"; }
```

Fallback metrics for Inter:
```css
@font-face {
  font-family: "Inter Fallback";
  src: local("Arial");
  ascent-override: 90.44%;
  descent-override: 22.52%;
  line-gap-override: 0.00%;
  size-adjust: 107.12%;
}
```

Fallback metrics for JetBrains Mono:
```css
@font-face {
  font-family: "JetBrains Mono Fallback";
  src: local("Arial");
  ascent-override: 75.79%;
  descent-override: 22.29%;
  line-gap-override: 0.00%;
  size-adjust: 134.59%;
}
```

### 2.2 Type Scale (Tailwind v4 defaults)

| Token        | Size      | Line-Height |
|--------------|-----------|-------------|
| `--text-xs`  | 0.75rem   | 1.333       |
| `--text-sm`  | 0.875rem  | 1.429       |
| `--text-base`| 1rem      | 1.5         |
| `--text-lg`  | 1.125rem  | 1.556       |
| `--text-xl`  | 1.25rem   | 1.4         |
| `--text-2xl` | 1.5rem    | 1.333       |
| `--text-3xl` | 1.875rem  | 1.2         |
| `--text-4xl` | 2.25rem   | 1.111       |
| `--text-5xl` | 3rem      | 1           |
| `--text-6xl` | 3.75rem   | 1           |
| `--text-8xl` | 6rem      | 1           |

### 2.3 Font Weights

| Token                    | Value |
|--------------------------|-------|
| `--font-weight-normal`   | 400   |
| `--font-weight-medium`   | 500   |
| `--font-weight-semibold` | 600   |
| `--font-weight-bold`     | 700   |
| `--font-weight-black`    | 900   |

### 2.4 Letter Spacing

| Token              | Value     |
|--------------------|-----------|
| `--tracking-tight` | -0.025em  |
| `--tracking-wide`  | 0.025em   |
| `--tracking-wider` | 0.05em    |
| `--tracking-widest`| 0.1em     |

### 2.5 Line Height

| Token              | Value |
|--------------------|-------|
| `--leading-tight`  | 1.25  |
| `--leading-snug`   | 1.375 |
| `--leading-relaxed`| 1.625 |

### 2.6 Text Usage in Components

- **Hero H1**: `text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight`
- **Section headings**: `text-2xl md:text-3xl font-bold`
- **Nav links**: `text-sm font-medium text-muted-foreground`
- **Card body**: `text-sm text-muted-foreground leading-relaxed`
- **Badges**: `text-sm font-medium` or `text-xs`
- **Code kbd**: `text-[10px] font-mono`

---

## 3. Spacing & Layout

### 3.1 Base Spacing Unit

```css
--spacing: 0.25rem;  /* 4px — Tailwind default */
```

### 3.2 Container Widths

| Token              | Width  |
|--------------------|--------|
| `--container-sm`   | 24rem  |
| `--container-md`   | 28rem  |
| `--container-lg`   | 32rem  |
| `--container-xl`   | 36rem  |
| `--container-2xl`  | 42rem  |
| `--container-3xl`  | 48rem  |
| `--container-4xl`  | 56rem  |
| `--container-5xl`  | 64rem  |
| `--container-6xl`  | 72rem  |

### 3.3 Page Layout

```css
/* Main content container */
.container.max-w-6xl.mx-auto.px-4.sm\:px-6
/* max-w-6xl = 72rem = 1152px */

/* Nav bar height */
h-16  /* 4rem = 64px */

/* Section spacing */
py-12       /* 3rem = 48px (footer) */
py-8        /* 2rem = 32px (hero inner padding) */
md:py-0     /* zero on medium+ (hero) */
space-y-8   /* gap between footer sections */

/* Hero section min-height */
min-h-[calc(100svh-4rem)]  /* full viewport minus nav */
md:pt-8 md:pb-8            /* 32px vertical padding on md+ */
lg:pt-10 lg:pb-10          /* 40px vertical padding on lg+ */
```

### 3.4 Grid Gaps

```
gap-2   (0.5rem / 8px)   — inline badge groups
gap-3   (0.75rem / 12px) — ecosystem pill list, icon rows
gap-4   (1rem / 16px)    — nav items, card internal
gap-6   (1.5rem / 24px)  — nav links, card grid
gap-8   (2rem / 32px)    — section content
gap-12  (3rem / 48px)    — major section separators
```

### 3.5 Section Max-Widths Used

```
max-w-xl   (36rem)  — narrow text blocks
max-w-2xl  (42rem)  — subtitles, descriptions
max-w-3xl  (48rem)  — wider text blocks
max-w-4xl  (56rem)  — hero heading
max-w-5xl  (64rem)  — wide content areas
max-w-6xl  (72rem)  — main container
```

---

## 4. Border Radius

```css
--radius:     0.625rem;  /* 10px — base radius */
--radius-2xl: 1rem;      /* 16px */
--radius-3xl: 1.5rem;    /* 24px */
```

### Radius Usage

| Class        | Value     | Used For                         |
|--------------|-----------|----------------------------------|
| `rounded`    | 0.25rem   | Small inline elements            |
| `rounded-md` | 0.375rem | Buttons, kbd badges              |
| `rounded-lg` | 0.5rem   | Nav items, mobile menu items     |
| `rounded-xl` | 0.75rem  | List items, code blocks          |
| `rounded-2xl`| 1rem     | Icon containers, feature cards   |
| `rounded-3xl`| 1.5rem   | Major cards, hero cards          |
| `rounded-full`| 9999px  | Badges, status dots, pills       |

---

## 5. Shadows

### 5.1 Shadow Scale

```css
/* shadow-sm */
box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1);

/* shadow-md (hover:shadow-md) */
box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);

/* shadow-lg (hover:shadow-lg) */
box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);

/* shadow-2xl (mobile drawer) */
box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);

/* shadow-xs (buttons) */
/* Tailwind v4 micro shadow */
```

### 5.2 Branded Shadows

```css
/* Blue glow on hover */
hover:shadow-vllm-blue/5   → --tw-shadow-color: #30a2ff0d;
hover:shadow-vllm-blue/25  → --tw-shadow-color: #30a2ff40;

/* Yellow glow on hover (CTA) */
hover:shadow-vllm-yellow/25 → --tw-shadow-color: #fdb51740;

/* Large blue glow (feature cards) */
box-shadow: 0 18px 60px rgba(48,162,255,0.22);
box-shadow: 0 24px 80px rgba(48,162,255,0.2);

/* Card lift on hover */
.card-lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -8px rgba(0,0,0,0.15);  /* light mode */
}
.dark .card-lift:hover {
  box-shadow: 0 12px 24px -8px rgba(0,0,0,0.4);    /* dark mode */
}
```

### 5.3 Glow Pulse Animation

```css
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 5px rgba(253,181,23,0.3); }
  50%      { box-shadow: 0 0 20px rgba(253,181,23,0.5); }
}
```

---

## 6. Gradients

### 6.1 Hero Background Gradient (CTA banner at top)

```css
/* Linear gradient — dark navy to vllm-blue */
background: linear-gradient(90deg, #06152e 0%, #0b4f8f 48%, #30a2ff 100%);

/* Overlay: radial yellow glow + horizontal white sheen */
background: radial-gradient(circle at 20% 50%, rgba(253,181,23,0.24), transparent 26%),
            linear-gradient(90deg, rgba(255,255,255,0.10), transparent 42%, rgba(255,255,255,0.16));
```

### 6.2 Section Background Gradient

```css
/* Subtle diagonal blue-to-yellow wash */
background: linear-gradient(to bottom-right, vllm-blue/5, transparent, vllm-yellow/5);
/* Tailwind: bg-gradient-to-br from-vllm-blue/5 via-transparent to-vllm-yellow/5 */
```

### 6.3 Card Decorative Blurs

```css
/* Blue decorative blur */
.absolute.inset-0.bg-gradient-to-br.from-vllm-blue/20.to-vllm-blue/5.rounded-3xl.blur-xl.opacity-50

/* Yellow decorative blur */
.absolute.inset-0.bg-gradient-to-br.from-vllm-yellow/20.to-vllm-yellow/5.rounded-3xl.blur-xl.opacity-50
```

### 6.4 Decorative Corner Blobs

```css
/* Top-right blue blob */
position: absolute; top: 0; right: 0;
width: 16rem; height: 16rem;
background: vllm-blue/5;
border-radius: 9999px;
filter: blur(48px); /* blur-3xl */
transform: translate(50%, -50%);

/* Bottom-left yellow blob */
position: absolute; bottom: 0; left: 0;
width: 12rem; height: 12rem;
background: vllm-yellow/5;
border-radius: 9999px;
filter: blur(48px);
transform: translate(-50%, 50%);
```

---

## 7. Component Patterns

### 7.1 Navigation Bar

```css
/* Sticky header */
position: sticky; top: 0; z-index: 30;
width: 100%;
border-bottom: 1px solid var(--border);
background: var(--background) / 80% opacity;
backdrop-filter: blur(12px); /* backdrop-blur-md */

/* Yellow accent strip at bottom of announcement bar */
height: 2px;
background: var(--color-vllm-blue);  /* actually bg-vllm-yellow in markup */

/* Nav links */
font-size: 0.875rem; font-weight: 500;
color: var(--muted-foreground);
transition: all 200ms;
/* + link-underline pseudo-element */

/* Search button */
display: inline-flex; align-items: center; gap: 6px;
padding: 6px 12px;
background: var(--muted) / 50%;
border-radius: 0.5rem; /* rounded-lg */
```

### 7.2 Primary CTA Button ("Get Started")

```css
/* Core styles */
display: inline-flex;
align-items: center;
justify-content: center;
gap: 0.5rem;
border-radius: 0.375rem;   /* rounded-md */
padding: 1.5rem 2rem;      /* py-6 px-8 */
font-size: 1rem;            /* text-base */
font-weight: 600;           /* font-semibold */

/* Colors */
background: #fdb517;        /* bg-vllm-yellow */
color: #000000;             /* text-black */

/* Hover */
background-hover: #e5a315;  /* hover:bg-vllm-yellow-hover */
transform: scale(1.05);     /* hover:scale-105 */
box-shadow: 0 10px 15px -3px rgba(253,181,23,0.25); /* hover:shadow-lg shadow-vllm-yellow/25 */

/* Active */
transform: scale(0.95);     /* active:scale-95 */

/* Glow effect (btn-glow) */
overflow: hidden;
/* ::before pseudo-element — radial white glow on hover */
```

### 7.3 Secondary CTA Button ("Documentation")

```css
/* Core styles */
display: inline-flex;
align-items: center;
justify-content: center;
gap: 0.5rem;
border-radius: 0.375rem;  /* rounded-md */
padding: 1.5rem 2rem;     /* py-6 px-8 */
font-size: 1rem;
font-weight: 600;

/* Colors */
background: var(--background);     /* bg-background */
border: 1px solid #30a2ff;         /* border-vllm-blue */
color: #30a2ff;                    /* text-vllm-blue */
box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); /* shadow-xs */

/* Dark mode additions */
background: var(--input) / 30%;   /* dark:bg-input/30 */
border-color: var(--input);        /* dark:border-input */

/* Hover */
background-hover: rgba(48,162,255,0.1); /* hover:bg-vllm-blue/10 */
transform: scale(1.05);
box-shadow: 0 10px 15px -3px rgba(48,162,255,0.25); /* shadow-vllm-blue/25 */

/* Active */
transform: scale(0.95);
```

### 7.4 Cards

#### Feature Card (3-column grid)

```css
/* Outer */
display: flex; flex-direction: column;
align-items: center; text-align: center;
padding: 1.5rem;           /* p-6 */
border-radius: 1rem;       /* rounded-2xl */
transition: all 300ms;
/* hover: bg-muted/50, scale(1.05) */

/* Icon container */
width: 3rem; height: 3rem;  /* w-12 h-12 */
border-radius: 1rem;        /* rounded-2xl */
background: rgba(48,162,255,0.1); /* bg-vllm-blue/10 */
```

#### Large Content Card

```css
position: relative;
background: var(--background) / 80%;  /* bg-background/80 */
backdrop-filter: blur(4px);           /* backdrop-blur-sm */
border: 1px solid var(--border);
border-radius: 1.5rem;               /* rounded-3xl */
padding: 2rem;                       /* p-8 */
height: 100%;
transition: border-color 300ms;
/* hover: border-vllm-blue/30 */
```

#### Info Section Card

```css
background: var(--muted) / 50%;  /* bg-muted/50 */
padding: 1.5rem;                 /* p-6, md:p-8 */
border-radius: 0.75rem;         /* rounded-xl */
box-shadow: 0 1px 3px rgba(0,0,0,0.1); /* shadow-sm */
```

### 7.5 Badges / Pills

#### Status Badge

```css
display: inline-flex;
align-items: center;
gap: 0.5rem;
padding: 0.375rem 0.75rem;   /* px-3 py-1.5 */
border-radius: 9999px;       /* rounded-full */
background: rgba(48,162,255,0.1); /* bg-vllm-blue/10 */
color: #30a2ff;               /* text-vllm-blue */
font-size: 0.875rem;          /* text-sm */
font-weight: 500;             /* font-medium */
```

#### Ecosystem Pill

```css
display: inline-flex;
align-items: center;
gap: 0.5rem;
padding: 0.625rem 1rem;      /* px-4 py-2.5 */
border-radius: 9999px;       /* rounded-full */
border: 1px solid var(--border);
background: var(--background);
/* hover: bg-muted/50, border-vllm-blue/50 */
font-size: 0.875rem;
font-weight: 500;
```

### 7.6 List Items (Interactive)

```css
display: flex;
align-items: center;
gap: 1rem;                   /* gap-4 */
padding: 0.75rem;            /* p-3 */
border-radius: 0.75rem;      /* rounded-xl */
transition: all;
cursor: pointer;
/* hover: bg-vllm-blue/10 */

/* Active/selected state */
background: rgba(48,162,255,0.1);    /* bg-vllm-blue/10 */
border: 1px solid rgba(48,162,255,0.2); /* border-vllm-blue/20 */

/* Status dot */
width: 0.5rem; height: 0.5rem;
border-radius: 9999px;
background: var(--muted-foreground) / 30%;
/* hover: bg-vllm-blue */
```

### 7.7 Footer / Ecosystem Section

```css
/* Footer wrapper */
width: 100%;
padding: 3rem 0; /* py-12 */

/* Container */
max-width: 72rem; /* max-w-6xl */
margin: 0 auto;
padding: 0 1rem;  /* px-4 sm:px-6 */

/* Copyright bar */
padding: 2rem 0; /* py-8 */
border-top: 1px solid var(--border);
```

---

## 8. Custom CSS Utilities

### 8.1 Link Underline

```css
.link-underline {
  position: relative;
}
.link-underline::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: currentColor;
  transition: width 0.3s;
}
.link-underline:hover::after {
  width: 100%;
}
```

### 8.2 Card Lift

```css
.card-lift {
  transition: transform 0.3s, box-shadow 0.3s;
}
.card-lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -8px rgba(0,0,0,0.15);
}
/* Dark mode override */
.dark .card-lift:hover {
  box-shadow: 0 12px 24px -8px rgba(0,0,0,0.4);
}
```

### 8.3 Dot Grid Background

```css
.dot-grid {
  background-image: radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 0);
  background-size: 24px 24px;
}
.dark .dot-grid {
  background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 0);
}
```

### 8.4 Button Glow (btn-glow)

```css
.btn-glow {
  position: relative;
  overflow: hidden;
}
.btn-glow::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 0;
  height: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0, transparent 70%);
  transition: width 0.6s, height 0.6s;
}
.btn-glow:hover::before {
  width: 300px;
  height: 300px;
}
.btn-glow:active::before {
  width: 400px;
  height: 400px;
  transition: width 0.1s, height 0.1s;
}
```

### 8.5 Scroll Animations

```css
.scroll-animate {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}
.scroll-animate.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Staggered children */
.scroll-animate-stagger > * {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;
}
.scroll-animate-stagger.is-visible > :nth-child(1) { transition-delay: 0s; }
.scroll-animate-stagger.is-visible > :nth-child(2) { transition-delay: 0.1s; }
.scroll-animate-stagger.is-visible > :nth-child(3) { transition-delay: 0.2s; }
.scroll-animate-stagger.is-visible > :nth-child(4) { transition-delay: 0.3s; }
.scroll-animate-stagger.is-visible > :nth-child(5) { transition-delay: 0.4s; }
.scroll-animate-stagger.is-visible > :nth-child(6) { transition-delay: 0.5s; }
/* All become: opacity: 1; transform: translateY(0); */
```

---

## 9. Animations / Keyframes

```css
@keyframes fade-in-up {
  0%   { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }

@keyframes ripple {
  to { opacity: 0; transform: scale(4); }
}

@keyframes bounce-subtle {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-5px); }
}

@keyframes card-pop-in {
  0%   { opacity: 0; transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes scale-in {
  0%   { opacity: 0; transform: scale(0); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes scroll {
  0%   { transform: translate(0); }
  100% { transform: translate(-50%); }
}

@keyframes tooltip-slide-in {
  0%   { opacity: 0; transform: translate(-8px); }
  100% { opacity: 1; transform: translate(0); }
}

@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 5px rgba(253,181,23,0.3); }
  50%      { box-shadow: 0 0 20px rgba(253,181,23,0.5); }
}
```

---

## 10. Transition Defaults

```css
/* Standard transitions used across the site */
transition-all duration-200   /* 200ms — nav links, icons, borders */
transition-all duration-300   /* 300ms — cards, icons, backgrounds */
transition-all duration-500   /* 500ms — decorative blurs */
transition-colors             /* color-only transitions */

/* Default timing */
ease-out                      /* scroll animations, fade-in-up */
/* Default Tailwind easing for transition-all */
```

---

## 11. Responsive Breakpoints

Standard Tailwind v4 breakpoints are in use:

| Prefix | Min-Width |
|--------|-----------|
| `sm`   | 640px     |
| `md`   | 768px     |
| `lg`   | 1024px    |
| `xl`   | 1280px    |

Key responsive patterns:
- Hero heading: `text-4xl` -> `md:text-5xl` -> `lg:text-6xl`
- Section headings: `text-2xl` -> `md:text-3xl`
- Grid columns: `grid-cols-1` -> `sm:grid-cols-2` -> `md:grid-cols-3`
- Container padding: `px-4` -> `sm:px-6`
- Nav: mobile hamburger `md:hidden`, desktop links `hidden md:flex`

---

## 12. Logo Assets

```
/vLLM-Full-Logo.svg           — Light-mode logo (dark text)
/vLLM-Full-Dark-Mode-Logo.svg — Dark-mode logo (light text)
```

Switching logic:
```html
<img class="h-11 w-auto dark:hidden"     src="/vLLM-Full-Logo.svg" />
<img class="h-11 w-auto hidden dark:block" src="/vLLM-Full-Dark-Mode-Logo.svg" />
```

Hero logo is larger: `h-20 md:h-28 lg:h-32`.

---

## 13. Summary: Key Design Decisions

1. **Color foundation**: Tailwind Slate scale for neutrals, not Gray/Zinc/Neutral. Dark mode uses slate-950 background (#020617), slate-900 cards (#0f172a), slate-800 muted surfaces (#1e293b).

2. **Brand colors are simple**: Just two — `#30a2ff` (blue) and `#fdb517` (yellow). Used at various opacities (5%, 10%, 20%) for subtle tints.

3. **Component styling is shadcn/ui**: The CSS custom property pattern (`--background`, `--foreground`, `--card`, `--muted`, etc.) follows the shadcn/ui convention exactly.

4. **Border approach**: Borders in dark mode use `rgba(255,255,255,0.1)` — white at 10% opacity, not a fixed gray. This adapts cleanly to any dark surface.

5. **Card pattern**: `rounded-3xl` (24px), glass-morphism (`backdrop-blur-sm`, `bg-background/80`), subtle border, blue-tinted hover border.

6. **Buttons**: Primary = solid yellow with black text. Secondary = outlined blue on transparent. Both use `rounded-md`, `py-6 px-8`, `scale-105` on hover, `scale-95` on active.

7. **Typography**: Inter for all UI text, JetBrains Mono for code. Both variable-weight, self-hosted.

8. **Animation approach**: Scroll-triggered fade-in-up with staggered children. Hover micro-interactions (scale, translateY, color transitions). All GPU-friendly (transform/opacity only).
