# Button Standardization Guidelines

## Overview

This document defines the standardized button patterns used across the application to ensure visual consistency, proper hierarchy, and optimal UX on both mobile and desktop devices.

## Button Variants

### Primary Actions (`variant="default"`)
- **Use for:** Main CTAs, save actions, submit forms, confirm actions
- **Appearance:** EAC red background (`bg-primary`), white text
- **Examples:** "Lancer la séance", "Enregistrer", "Sauver", "Créer"
- **Height:** `h-12` on mobile, `h-10` on desktop (responsive: `h-12 md:h-10`)

### Secondary Actions (`variant="outline"`)
- **Use for:** Less prominent actions, alternative options, cancel buttons
- **Appearance:** Transparent background with border, inherits text color
- **Examples:** "Annuler", filter toggles, view switchers
- **Height:** `h-12` on mobile, `h-10` on desktop (responsive: `h-12 md:h-10`)

### Tertiary Actions (`variant="ghost"`)
- **Use for:** Low-priority actions, navigation, settings access
- **Appearance:** Transparent background and border, hover effect
- **Examples:** "Retour", "Paramètres", info buttons
- **Height:** Standard sizing, no specific height constraint

### Destructive Actions (`variant="destructive"`)
- **Use for:** Delete, remove, reject operations
- **Appearance:** Red background (`bg-destructive`), white text
- **Confirmation:** **MUST** include confirmation dialog before destructive action
- **Examples:** "Supprimer", "Désactiver", "Rejeter"
- **Height:** `h-12` on mobile, `h-10` on desktop (responsive: `h-12 md:h-10`)

## Size Standards

### Mobile-First Pages (Dashboard, Strength, Records)
- **Primary buttons:** `h-12` (48px) - thumb-friendly touch targets
- **Use BottomActionBar pattern** for main actions (sticky bottom bar)
- **Icon buttons:** `h-10 w-10` minimum for adequate touch area

### Desktop-First Pages (Admin, Coach Tools)
- **Primary buttons:** `h-10` (40px) - compact, professional
- **Top-right save button** for forms and editors
- **Icon buttons:** `h-9 w-9` standard

### Responsive Pattern
- Use Tailwind responsive classes: `h-12 md:h-10`
- Ensures mobile thumb-friendliness while keeping desktop compact

## Layout Patterns

### BottomActionBar (Mobile-First)
- **Location:** Fixed to bottom of viewport
- **Used in:** Dashboard, Strength (reader mode)
- **Pattern:**
```tsx
<BottomActionBar saveState={saveState}>
  <Button variant="default" className="flex-1 h-14 rounded-xl">
    Primary Action
  </Button>
</BottomActionBar>
```

### Top-Right Save (Desktop-First)
- **Location:** Top-right corner of page/form
- **Used in:** Admin, SwimCatalog, StrengthCatalog (builder mode)
- **Pattern:**
```tsx
<div className="flex items-center justify-between">
  <h2>Page Title</h2>
  <Button variant="default" className="h-10">
    <Save className="mr-2 h-4 w-4" /> Enregistrer
  </Button>
</div>
```

### Inline Action Groups
- **Location:** Within cards, table rows, lists
- **Spacing:** `gap-2` between buttons
- **Pattern:**
```tsx
<div className="flex items-center gap-2">
  <Button variant="outline" size="icon">
    <Edit2 className="h-4 w-4" />
  </Button>
  <Button variant="destructive" size="icon">
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
```

## Icon Buttons

### Standard Icon Button
- **Size:** `h-10 w-10` (mobile), `h-9 w-9` (desktop)
- **Variant:** Usually `outline` or `ghost`
- **Pattern:**
```tsx
<Button variant="outline" size="icon" aria-label="Action name">
  <Icon className="h-4 w-4" />
</Button>
```

### Circular Icon Button
- **Classes:** `rounded-full`
- **Used in:** Navigation, settings, close buttons
- **Pattern:**
```tsx
<Button variant="ghost" size="icon" className="rounded-full">
  <X className="h-4 w-4" />
</Button>
```

## Confirmation Dialogs

### Destructive Actions
**ALWAYS** require user confirmation before executing:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">
      <Trash2 className="mr-2 h-4 w-4" /> Supprimer
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirmer la suppression ?</AlertDialogTitle>
      <AlertDialogDescription>
        Cette action est définitive.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Annuler</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>
        Supprimer
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Accessibility

### Required Attributes
- **aria-label:** Required for icon-only buttons
- **title:** Helpful for hover tooltips on icon buttons
- **disabled state:** Visual + functional (pointer-events-none via Shadcn default)

### Focus States
- All buttons have `focus-visible:ring-1 focus-visible:ring-ring` (Shadcn default)
- Keyboard navigation fully supported

## Examples by Page

### Strength.tsx
- **Reader mode bottom bar:** `h-14` primary "Lancer la séance" button
- **Settings toggle:** `ghost` variant, `rounded-full`
- **Cycle selector:** Pill buttons (custom, not Button component)
- **In-progress actions:** `h-12` "Reprendre", `outline` close button

### SwimCatalog.tsx
- **Top bar save:** `h-9` compact button with Save icon
- **Session list actions:** Icon buttons `h-9 w-9`
- **Builder mode:** `variant="secondary"` for add actions

### StrengthCatalog.tsx
- **Top save button:** `h-10` with Save icon
- **Add exercise:** `variant="outline"` with Plus icon
- **Delete session:** `variant="destructive"` with confirmation dialog

### Admin.tsx
- **Create coach:** `variant="default"` standard height
- **Approve/reject:** Status-colored buttons with icons
- **Disable user:** `variant="destructive"` with confirmation

## Migration Checklist

When standardizing buttons on a page:
- [ ] Replace custom button styling with standardized variants
- [ ] Apply responsive heights: `h-12 md:h-10` for primary actions
- [ ] Ensure destructive actions have confirmation dialogs
- [ ] Add `aria-label` to all icon-only buttons
- [ ] Verify keyboard navigation works
- [ ] Test on mobile (48px touch targets for primary actions)
- [ ] Test on desktop (compact 40px for efficiency)

## Notes

- Dashboard already uses BottomActionBar ✅ (no changes needed)
- Button component in `src/components/ui/button.tsx` uses cva for variants
- Shadcn provides built-in disabled styles and focus states
- All buttons have hover/active elevation effects via Tailwind utilities
