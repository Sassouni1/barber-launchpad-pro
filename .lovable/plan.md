

# Performance Fix Plan

## Problem
The site runs extremely slowly on lower-end devices, causing:
- Video randomly pausing
- 5-second delay per keystroke in the GHL order form
- General slow loading

The root cause is heavy GPU usage from CSS effects that overwhelm budget phones.

## Changes

### 1. Reduce blur effects in DashboardLayout
Remove or drastically reduce the two large fixed blur elements (120px and 100px blur) that render on every single page. These alone can tank performance on weaker GPUs.

**File:** `src/components/layout/DashboardLayout.tsx`
- Remove or hide the ambient glow `div` elements on mobile using `hidden md:block`
- Reduce blur values for desktop (e.g., 120px to 60px)

### 2. Reduce backdrop-filter usage on mobile
The `glass-card` class uses `backdrop-filter: blur(20px)` and is used on nearly every component. This is the single biggest performance killer.

**File:** `src/index.css`
- Add a media query to disable or reduce `backdrop-filter` on mobile devices
- Replace with a simpler semi-transparent background on smaller screens

### 3. Tone down infinite animations
Several animations run forever and consume GPU cycles constantly.

**File:** `src/index.css`
- Change `spotlight-pulse` animation to only run on hover or remove on mobile
- Remove `animate-ping` from status indicators on mobile (or use a static dot)

**File:** `src/components/dashboard/WelcomeHero.tsx`
- Remove `spotlight-pulse` class on mobile
- Remove `animate-ping` on the status dot for mobile

**File:** `src/components/layout/Sidebar.tsx`
- Remove `animate-ping` from the "System Status" indicator (desktop sidebar only, low impact but still wasteful)

### 4. Hide cyber-grid on mobile
The fixed cyber-grid background with mask-image adds another compositing layer.

**File:** `src/components/layout/DashboardLayout.tsx`
- Add `hidden md:block` to the cyber-grid-fade div so it only shows on desktop

### 5. Add will-change and containment hints (optional, minor)
Add CSS containment to help the browser optimize rendering of the main content area.

## Expected Impact
These changes should dramatically improve performance on budget devices by reducing GPU compositing layers from ~8-10+ down to 2-3 on mobile. The visual design will remain the same on desktop -- mobile will just get a slightly simplified version of the effects.

## Technical Details

### CSS changes in `src/index.css`:
```css
/* Add mobile performance override */
@media (max-width: 768px) {
  .glass-card {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: hsl(var(--card) / 0.95);
  }
  
  .glass-card::before {
    display: none;
  }
  
  .spotlight-pulse::after {
    display: none;
  }
  
  .gold-glow, .gold-glow-subtle {
    box-shadow: none;
  }
}
```

### DashboardLayout changes:
```tsx
{/* Hide heavy effects on mobile */}
<div className="fixed inset-0 cyber-grid-fade pointer-events-none hidden md:block" />
<div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[80px] pointer-events-none hidden md:block" />
<div className="fixed bottom-0 right-1/4 w-80 h-80 bg-primary/3 rounded-full blur-[80px] pointer-events-none hidden md:block" />
```

### WelcomeHero changes:
- Remove `spotlight-pulse` class on mobile
- Replace `animate-ping` with a static colored dot on mobile

