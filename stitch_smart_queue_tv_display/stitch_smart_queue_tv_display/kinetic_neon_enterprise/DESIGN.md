---
name: Kinetic Neon Enterprise
colors:
  surface: '#0c1324'
  surface-dim: '#0c1324'
  surface-bright: '#33394c'
  surface-container-lowest: '#070d1f'
  surface-container-low: '#151b2d'
  surface-container: '#191f31'
  surface-container-high: '#23293c'
  surface-container-highest: '#2e3447'
  on-surface: '#dce1fb'
  on-surface-variant: '#baccb0'
  inverse-surface: '#dce1fb'
  inverse-on-surface: '#2a3043'
  outline: '#85967c'
  outline-variant: '#3c4b35'
  surface-tint: '#2ae500'
  primary: '#efffe3'
  on-primary: '#053900'
  primary-container: '#39ff14'
  on-primary-container: '#107100'
  inverse-primary: '#106e00'
  secondary: '#ffffff'
  on-secondary: '#003737'
  secondary-container: '#00fbfb'
  on-secondary-container: '#007070'
  tertiary: '#f9fafa'
  on-tertiary: '#2f3131'
  tertiary-container: '#dddddd'
  on-tertiary-container: '#606162'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#79ff5b'
  primary-fixed-dim: '#2ae500'
  on-primary-fixed: '#022100'
  on-primary-fixed-variant: '#095300'
  secondary-fixed: '#00fbfb'
  secondary-fixed-dim: '#00dddd'
  on-secondary-fixed: '#002020'
  on-secondary-fixed-variant: '#004f4f'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#0c1324'
  on-background: '#dce1fb'
  surface-variant: '#2e3447'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 120px
    fontWeight: '800'
    lineHeight: 120px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Inter
    fontSize: 80px
    fontWeight: '700'
    lineHeight: 80px
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 96px
    fontWeight: '700'
    lineHeight: 100px
  headline-sm:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
  body-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-padding: 4rem
  gutter: 2rem
  stack-gap: 1.5rem
  section-margin: 5rem
---

## Brand & Style
This design system is engineered for high-visibility public environments, specifically large-format displays viewed from a distance. The brand personality is authoritative, high-tech, and urgent, utilizing a **Cyber-SaaS Enterprise** aesthetic. 

The visual direction combines **Minimalism** with **High-Contrast** elements. It prioritizes information density and legibility above all else. The emotional response is one of efficiency and precision. To guide the viewer's eye, the system employs a "Dark-to-Glow" hierarchy: static information remains recessed in the background, while active transitions and new calls utilize vibrant neon accents and subtle atmospheric glows to command immediate attention.

## Colors
The palette is optimized for OLED and high-brightness LED panels to ensure zero bleed and maximum contrast.

- **Background (Slate 950):** `#020617` serves as the canvas, absorbing light to let active elements "pop."
- **Primary (Neon Green):** `#39FF14` is used for "Active" or "Now Serving" states. It signifies action and movement.
- **Secondary (Cyan):** `#00FFFF` is reserved for "Next in Queue" or "Counter Information," providing a cool-toned contrast to the primary green.
- **Surface:** `#0F172A` (Slate 900) is used for card containers to provide subtle separation from the base background.
- **Text:** Pure `#FFFFFF` for primary data; `#94A3B8` (Slate 400) for secondary labels.

## Typography
Typography is scaled for long-distance legibility. **Inter** provides a clean, neutral foundation for names and instructions, while **JetBrains Mono** is utilized for alphanumeric queue codes (e.g., A-102) to ensure no character ambiguity (e.g., distinguishing '0' from 'O').

- **Display Roles:** Used for the current ticket being served.
- **Code Roles:** Used for ticket numbers. The monospaced nature ensures that as numbers flip, the layout remains stable.
- **Label Roles:** Used for counter numbers and table headers, set in uppercase for a functional, "instrument-panel" look.

## Layout & Spacing
The layout follows a **Fixed Grid** model optimized for 16:9 aspect ratio displays. 

- **The Hero Zone:** Occupies the left 60% of the screen, showcasing the "Now Serving" information in the largest type scale.
- **The Sidebar:** Occupies the right 40% for the "Upcoming" list.
- **The Ticker:** A fixed footer bar at the bottom for scrolling announcements.
- **Rhythm:** An 8px base unit is used, but scaled significantly for TV. Use 64px (`4rem`) as the standard outer margin to prevent content from hitting the edges of physical bezels or being clipped by overscan on older panels.

## Elevation & Depth
In this high-contrast dark environment, depth is achieved through **Tonal Layering** and **Neon Glows** rather than traditional shadows.

- **Base Level:** Slate 950 background.
- **Surface Level:** Slate 900 for card backgrounds with a 1px border of Slate 800.
- **Active State:** When a number is called, the card gains a `0px 0px 30px` outer glow matching the color of the accent (Green or Cyan) and a 2px solid border of the same color. 
- **Backdrop Blurs:** Used sparingly behind the marquee ticker to maintain legibility over any background movement.

## Shapes
This design system uses a **Soft** shape language (`0.25rem` to `0.75rem`). This maintains the professional, "Enterprise" feel without being as aggressive as sharp corners. 

- Standard Cards: `0.5rem` (8px).
- Active Indicators: `0.25rem` (4px).
- Ticker/Header bars: `0` (Sharp) to span the full width of the display seamlessly.

## Components

### High-Visibility Cards
Cards are the primary container for ticket info. Static cards have a dark grey background. **Active Cards** feature a high-contrast Neon Green background with black text for the ticket number, creating a "negative" space effect that is impossible to miss.

### Status Indicators
Small "Pulse" dots sit next to the counter number. These use a CSS keyframe animation to scale from 100% to 150% with 0 opacity to create a "sonar" effect, signaling which station is currently paging.

### Marquee Ticker
A full-width bar at the bottom of the screen (`120px` height). It uses a solid Slate 900 background with a Primary Neon Green top-border. Text scrolls horizontally at a constant, readable speed.

### Alphanumeric Code Blocks
Ticket numbers are always presented in a "box" style using **JetBrains Mono**. These blocks should have extra tracking (letter-spacing) to ensure each character is distinct from a distance.

### Lists
The "Waiting" list uses a stripped-back styling: no card background, just a 1px bottom border (`Slate 800`) between rows to maximize the number of visible tickets while maintaining a clean vertical rhythm.