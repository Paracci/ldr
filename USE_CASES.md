# LDR Use Cases — Sector Guide

> This document explains how LDR can be used across different sectors.
> Goal: Inspire developers and businesses, and lay the groundwork for the community
> to develop their own scenarios.
> Contribution: Open a PR to add new scenarios to any sector.

---

## Table of Contents

1. [Retail](#retail)
2. [Food & Beverage](#food--beverage)
3. [Payments & Finance](#payments--finance)
4. [Entertainment & Media](#entertainment--media)
5. [Healthcare](#healthcare)
6. [Transport & Travel](#transport--travel)
7. [Education](#education)
8. [Events & Tourism](#events--tourism)
9. [Government & Public Services](#government--public-services)
10. [Small Business & Individual](#small-business--individual)
11. [Security Notes](#security-notes)
12. [Contribute](#contribute)

---

## Retail

### Basic Use

When a store logo is scanned, the user is routed based on their location and behavior.

### Scenarios

**Aisle-specific routing**

```text
User in the meat aisle → scanned logo
→ Today's meat deals + recipes
User in the baby products aisle → scanned logo
→ Baby product campaigns + loyalty points
```

**In-store vs. at-home routing**

```text
User inside the store → real-time deals + checkout directions
User browsing a catalog at home → home delivery page
User far from the store → nearest branch map
```

**Time-based campaigns**

```text
08:00–11:00 → Morning deals (bread, milk, breakfast items)
11:00–14:00 → Lunch ready-meal campaigns
18:00–21:00 → Evening grocery deals
After 21:00 → Next-day order + delivery
```

**Language-based routing**

```text
Phone language Arabic → Arabic product page
Phone language English → English interface
```

### Developer Notes

- Use WiFi network detection instead of GPS — in-store network detection is more reliable
- For aisle-specific scenarios, the store integrates its own beacon/WiFi infrastructure with the LDR SDK
- LDR never sees user data — the brand makes decisions through its own API

---

## Food & Beverage

### Basic Use

When a restaurant or café logo is scanned, the menu or order page opens based on table, time, and user preference.

### Scenarios

**Time-based menu**

```text
06:00–11:00 → Breakfast menu
11:00–15:00 → Lunch menu + daily special
15:00–18:00 → Snacks & drinks menu
18:00–23:00 → Dinner menu
```

**Table detection**

```text
User scanned logo at the table
→ Restaurant system identifies the table
→ "Table 7 — Place your order" page opens
→ Call waiter button active
```

> NOTE: Table detection uses a logo + table number combination.
> Security: Single-use session token, valid for 30 minutes.

**Reservation & waitlist**

```text
Restaurant is full → scanning logo adds user to waitlist
→ SMS / notification when their turn comes
→ User can browse the menu while waiting outside
```

**Loyalty program**

```text
Every logo scan → points added
At 50th scan → free drink coupon
User data stays with the brand, not with LDR
```

### Developer Notes

- LDR is a router only for payments — the actual payment goes through the existing POS / bank infrastructure
- Menu changes don't require reprinting the logo — just update from the server

---

## Payments & Finance

> **Critical principle: LDR never holds, sees, or carries money.**
> LDR only routes to the correct payment page. Money always flows through bank / payment infrastructure.

### Scenarios

**POS payment**

```text
User scanned logo at the checkout
→ Current transaction details (amount + store) are shown
→ User confirms through their own bank
→ LDR is out of the loop from this point
```

**Security layer**

```text
Each POS transaction → single-use token (valid 30 seconds)
Token is signed by the bank
On expiry → invalid, generate new token
Man-in-the-middle attack → token is dead, worthless
```

**Bill payment**

```text
Logo on paper bill scanned
→ Bill details shown (amount, due date, institution)
→ Redirected to banking app
→ One-tap payment
```

**Donation**

```text
NGO / foundation logo scanned
→ Donation amount selection
→ Redirected to secure payment infrastructure
```

**Send money to a friend**

```text
Logo on a person's business card scanned
→ That person's payment link opens (bank transfer, PayPal, etc.)
→ LDR only delivers the link
```

### Developer Notes

- This sector requires the highest level of security
- Always require: signed token + HTTPS + payment through bank infrastructure
- LDR must never act as a payment intermediary in this sector
- Recommendation: develop a separate `ldr-payments` module for payment scenarios

---

## Entertainment & Media

### Scenarios

**Music & podcast**

```text
Album cover scanned
→ Album opens in Spotify / YouTube / Apple Music
→ Routed to the app the user has installed
→ If none: web player
```

**Film & series**

```text
Poster scanned
→ Film opens on Netflix / Disney+ / streaming platform
→ Route to the platform the user is subscribed to
→ If not subscribed: trailer + subscribe page
```

**Book & magazine**

```text
Book cover scanned
→ Buy / borrow e-book
→ Route to audiobook version
→ Author's other books
```

**Game**

```text
Game box / poster scanned
→ App Store / Play Store
→ If demo available: direct download
→ Multiplayer: friend invite link
```

**Concert tickets**

```text
Concert poster scanned
→ Ticket purchase page
→ If sold out: waitlist
→ On event day: door QR / e-ticket
```

---

## Healthcare

> This sector has the most sensitive user data. GDPR / local health regulation compliance is mandatory.

### Scenarios

**Hospital & clinic**

```text
Hospital logo scanned
→ Book appointment page
→ If appointment exists → appointment details
→ Emergency: direct emergency room routing
```

**Medication & pharmacy**

```text
Medication box logo scanned
→ Package insert (instructions for use)
→ Side effects + drug interactions
→ Nearest pharmacy
→ If prescription required: prescription system integration
```

**Insurance**

```text
Insurance card logo scanned
→ Policy details
→ List of partner hospitals
→ Claims submission
```

**Ambulance & emergency**

```text
Ambulance logo scanned
→ Direct emergency call (911 / 112)
→ Location sharing (with user consent)
```

### Developer Notes

- Health data is never sent to LDR servers
- Embedded mode is preferred for all routing
- Appointment / prescription systems integrate with existing health infrastructure

---

## Transport & Travel

### Scenarios

**Public transport**

```text
Metro / bus logo scanned
→ Current route information + next departure
→ Buy ticket
→ Route map
Morning hours: crowding warning + alternative route
```

**Taxi & ride sharing**

```text
Taxi logo scanned
→ Request a ride (current location auto-filled)
→ Estimated fare
→ Driver info
```

**Flights & airports**

```text
Airline logo scanned
→ Check-in page
→ Based on flight time:
   3 hours before → online check-in
   1 hour before → gate number + boarding pass
   After flight → baggage tracking
```

**Hotel**

```text
Hotel logo scanned
→ If reservation exists: check-in + room key
→ If no reservation: available rooms + prices
→ Scanned in lobby: concierge services
→ Scanned in room: room service menu
```

**Car rental**

```text
Logo scanned
→ Rent a car
→ If already renting: vehicle location + pickup
→ On return day: extension option
```

---

## Education

### Scenarios

**School & university**

```text
School logo scanned by student
→ Course schedule
→ Assignment deadlines
→ Announcements
Teacher scans → attendance system
Parent scans → student report card / attendance record
```

**Textbook**

```text
Book cover scanned
→ Additional resources on the topic
→ Practice questions
→ Video explanation
→ Ask the teacher button
```

**Certificate & diploma**

```text
Logo on certificate scanned
→ Certificate authenticity verified
→ Route to person's LinkedIn profile
→ Verification from institution's certificate registry
```

**Library**

```text
Library logo scanned
→ Member login
→ Borrowed books + return dates
→ Whether reserved book is ready
```

---

## Events & Tourism

### Scenarios

**Museum & historic site**

```text
Museum logo scanned
→ Audio guide starts (automatic language detection)
→ Which exhibit are you in front of → that exhibit's story
→ Children's mode / adult mode (by user selection, not phone user)
```

**Trade show & conference**

```text
Event logo scanned
→ Program & sessions
→ Which hall are you in → that hall's program
→ Speaker biographies
→ Networking: "Who is at this event" list
```

**Sports event**

```text
Club logo scanned
→ Match day: live score + lineup
→ No match: buy tickets + next match
→ Scanned at stadium: seat map + nearest restroom / concession
```

**Festival**

```text
Festival logo scanned
→ Stage schedule (which stage is active now)
→ Map: stages, food, restrooms
→ Find your friends (location sharing — optional)
```

---

## Government & Public Services

> In this sector, LDR being open source and independent is critical.
> No government body can control LDR infrastructure.

### Scenarios

**Official documents**

```text
Government agency logo scanned
→ Document authenticity verified (blockchain or open registry)
→ Document details
→ Related service page
```

**Municipal services**

```text
Municipality logo scanned on the street
→ Municipal services at that location
→ Water / electricity outage report
→ Parks & recreation complaint
→ Routing based on selected language
```

**Elections & voting**

```text
Polling station logo scanned
→ Voter information verification
→ Polling place confirmation
```

> NOTE: The actual voting process is never done through LDR. Information & routing only.

**Emergency**

```text
Emergency services logo scanned
→ Real-time alerts (earthquake, flood, fire)
→ Assembly point map
→ Missing person report
→ Donation & volunteer registration
```

---

## Small Business & Individual

> LDR's greatest strength: you don't need to be a big brand.
> A barbershop can register its own logo.

### Scenarios

**Barbershop & beauty salon**

```text
Logo scanned
→ Book appointment
→ Services & price list
→ Fully booked? → waitlist + SMS notification
```

**Freelancer**

```text
Logo on business card scanned
→ Portfolio
→ Services & prices
→ Book appointment / request a quote
→ Payment link
```

**Home rental & sales**

```text
Logo on door / listing scanned
→ Apartment details + photos
→ Contact owner
→ Schedule a viewing
```

**Handcraft & small producer**

```text
Logo on product scanned
→ Product story
→ Place an order / browse other products
→ Direct contact with producer
→ Certificates (organic, handmade verification)
```

**Business card**

```text
Logo scanned
→ Digital business card (download vCard)
→ LinkedIn / website
→ Direct call / message
→ Add appointment to calendar
```

---

## Security Notes

Core security principles applicable to all sectors:

**User data**

- LDR server never collects user data
- Contextual data (time, language) stays on-device
- If location data is used: city level only, not GPS coordinates
- User must always be able to see "why did this open"

**Logo security**

- Every logo is verified with a cryptographic signature
- Similar logos are automatically rejected (visual similarity algorithm)
- Unverified logos show a clear warning to users

**Payment scenarios**

- LDR is never a payment intermediary
- Single-use token (30 second validity)
- Money always flows through bank / payment infrastructure

**Open source guarantee**

- LDR algorithms are open to everyone
- Any server can mirror the LDR registry
- No single company can control the system

---

## Contribute

To add a new sector or scenario to this list:

1. Fork this file
2. Add your scenario (follow the template)
3. Add a security note
4. Open a PR

**Scenario template:**

```markdown
**[Scenario name]**

[Logo source] scanned
→ [Condition 1]: [Result 1]
→ [Condition 2]: [Result 2]
→ Default: [Default result]

Security note: [Special security requirement if any]
```

---

*LDR — Logo Dynamic Redirect | Open Standard | MIT License*
*"Your logo should do more than look good."*