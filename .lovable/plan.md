# Persistent floating Aion assistant

## Experience
- Add a compact gold-accented circular **Aion** launcher fixed at the bottom-right of authenticated member pages.
- Open a polished chat panel above the launcher: approximately 380 × 560px on desktop and a shorter, mobile-safe bottom sheet with visible page context on phones.
- Include distinct minimize and close controls, keyboard/focus support, readable labels/tooltips, safe-area spacing, and positioning that clears the mobile navigation.
- Preserve the panel’s open, minimized, or closed state while navigating between member pages.

## Existing Aion behavior
- Reuse Aion’s existing database-backed conversations, message history, streaming responses, image generation, greeting, and download/variation actions.
- Extract the existing conversation selection/creation behavior into a reusable floating chat host rather than adding another AI endpoint or storage system.
- Keep the full `/aion` page and dashboard Aion card working with the same saved conversations.
- Use the required AI Elements conversation, message, prompt input, and loading primitives as the chat foundation while retaining Aion’s black-and-gold appearance and current capabilities.

## Visibility
- Mount the assistant once inside the authenticated member application so it survives page navigation.
- Show it for standard member pages such as dashboard, training, marketing, website, support, rewards, and other protected member areas.
- Hide it on signed-out/public/auth pages, every `/admin` page, supplier/manufacturer view, agreement/password-reset gates, public referral/card/client/directory pages, and the entire `/order-hair-system` flow.
- Hide the floating launcher on `/aion` itself to avoid two simultaneous copies of the same conversation; the full Aion page remains the active experience there.

## Verification and release
- Verify launcher, open, minimized, close, conversation persistence, navigation persistence, and route exclusions while signed in.
- Visually inspect desktop and 319 × 635 mobile layouts, including mobile-navigation clearance, panel sizing, scrolling, focus, contrast, and no overlap.
- Run the full build and lint checks, publish the frontend, then verify the published member experience without changing Aion’s backend behavior.

## Technical notes
- Keep the existing Aion functions and tables unchanged; no second backend or duplicate history store will be created.
- Replace the current global conversation-ID bridge with an explicit conversation ID passed to the streaming request so the full page and floating host cannot interfere.
- Store only the panel presentation state and selected conversation ID locally; message history remains in the existing database.
