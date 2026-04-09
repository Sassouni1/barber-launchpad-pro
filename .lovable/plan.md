## Digital Business Card — Build Plan

### What we're building
A premium digital business card page that members can share via QR code. When scanned, it offers a smooth "save to phone" experience with tappable links for **Book Your Free Consultation** and **See Transformations**.

### Architecture

#### 1. Bridge Page (`/card/:userId`)
- Beautiful, premium landing page showing business name, logo, transformation image
- Detects iOS vs Android
- Primary CTA: "Save to Phone" (downloads vCard contact)
- Secondary: "Book Free Consultation" + "See Transformations" buttons

#### 2. vCard (.vcf) Contact Card — The Core
This is the **simplest method that works on ALL phones without any API keys**:
- Saves as a phone contact with business name, logo photo, and **tappable URL links**
- Once saved, the user opens their Contacts app → taps the contact → sees both links right there
- Works on iPhone AND Android natively, no developer accounts needed

The vCard will contain:
- Business name (as contact name)
- Logo (embedded as photo)
- Booking URL (as a labeled URL field)
- Transformations URL (as a labeled URL field)
- Phone number, email if provided

#### 3. Admin/Member Setup Page
- Members configure: business name, booking link, transformations link, phone, email
- Upload logo + transformation image
- Auto-generates QR code pointing to their card page

### What works WITHOUT custom APIs
✅ vCard contact save (both iOS & Android)
✅ Embedded URLs in contact card (tappable from saved contact)
✅ Logo as contact photo
✅ QR code generation
✅ Bridge page with direct save flow
✅ Any booking link (Booksy, Calendly, Square, etc.)
✅ Any gallery link (Instagram, website, etc.)

### What would require APIs (optional enhancements, NOT built now)
- ❌ Apple Wallet `.pkpass` → requires Apple Developer account ($99/yr) + server-side certificate signing
- ❌ Google Wallet pass → requires Google Wallet API + service account setup

### Database changes
- New `business_cards` table storing member card details (name, booking_url, gallery_url, phone, email, logo, image)

### Flow
1. Member fills out card details in settings
2. System generates QR code → member prints/shares it
3. Someone scans QR → lands on premium bridge page
4. Taps "Save to Phone" → vCard downloads → saved as contact
5. Later, opens contact → taps "Book Consultation" or "See Transformations"
