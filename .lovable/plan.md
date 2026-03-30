

# Fix GHL OAuth Redirect URI Mismatch

## Problem
The redirect URI sent to GHL uses `window.location.origin` which gives the Lovable preview URL. GHL rejects it because it doesn't match the redirect URI configured in your GHL marketplace app settings.

## Solution
Hardcode the redirect URI to use the published URL instead of dynamically using `window.location.origin`.

## Changes

**1. `src/components/admin/GHLIntegration.tsx`**
- Change `getRedirectUri()` to return `https://barber-launchpad-pro.lovable.app/integrations/ghl/callback` instead of using `window.location.origin`

## GHL Marketplace Side
You also need to make sure your GHL marketplace app has `https://barber-launchpad-pro.lovable.app/integrations/ghl/callback` set as an allowed redirect URI in your app settings at `marketplace.gohighlevel.com`.

