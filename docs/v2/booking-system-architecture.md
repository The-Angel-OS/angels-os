# 📅 Angel OS Booking System Architecture

## Overview

Angel OS implements a comprehensive booking system that handles individual appointments, group classes/events, and recurring subscriptions. This system supports everything from one-on-one consultations to yoga classes to gym memberships.

## 🎯 Booking Types Supported

### **1. Individual Appointments**
- Car stereo installations
- Consultations (AI readiness, business strategy)
- Medical appointments
- Beauty/barber services
- Auto repair diagnostics

### **2. Classes & Events**
- Yoga classes (capacity: 15-20)
- Workout classes (capacity: 10-30)
- Coffee shop workshops (capacity: 8-12)
- Dragon boat racing training
- Business seminars

### **3. Subscriptions & Memberships**
- Gym memberships (monthly/annual)
- Yoga studio unlimited classes
- Coffee shop loyalty programs
- Business consulting retainers
- SaaS service subscriptions

## 🔄 Booking Flow Architecture

### **Step 1: Product Configuration**

```typescript
// Products Collection - Enhanced for Bookings
{
  title: "Yoga Class - Morning Flow",
  productType: "class_booking",
  
  // Booking-specific fields
  bookingConfig: {
    type: "class", // "appointment" | "class" | "subscription"
    duration: 60, // minutes
    capacity: {
      min: 3,  // Minimum to run class
      max: 20, // Maximum capacity
      current: 12 // Current bookings
    },
    schedule: {
      recurring: true,
      pattern: "weekly", // "daily" | "weekly" | "monthly"
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      times: ["07:00", "18:30"],
      timezone: "America/New_York"
    },
    location: {
      type: "physical", // "physical" | "online" | "hybrid"
      address: "123 Yoga Studio Lane",
      room: "Studio A",
      onlineLink: null
    },
    pricing: {
      dropIn: 25,      // Single class
      package: {       // Class packages
        "5-pack": { price: 100, expires: 90 },
        "10-pack": { price: 180, expires: 120 }
      },
      membership: {    // Monthly unlimited
        monthly: 89,
        annual: 890
      }
    },
    cancellation: {
      policy: "24_hours", // "2_hours" | "24_hours" | "48_hours" | "no_refund"
      fee: 0,
      refundPercentage: 100
    }
  }
}
```

### **Step 2: Order Creation**

```typescript
// Orders Collection - Booking Integration
{
  orderId: "ORD-YG-240821-001",
  customer: "user_id_123",
  items: [
    {
      product: "yoga_morning_flow_id",
      bookingType: "class",
      selectedDate: "2024-08-22",
      selectedTime: "07:00",
      quantity: 1,
      price: 25,
      
      // Class-specific data
      classSession: {
        sessionId: "YMF-240822-0700",
        instructor: "Sarah Johnson",
        capacity: { max: 20, booked: 13 },
        waitlistPosition: null
      }
    }
  ],
  
  // Booking metadata
  bookingInfo: {
    confirmationCode: "YG-ABC123",
    status: "confirmed", // "pending" | "confirmed" | "cancelled" | "completed"
    paymentStatus: "paid",
    bookingDate: "2024-08-21T15:30:00Z",
    
    // Special requirements
    notes: "First time student, needs modifications",
    equipment: ["yoga mat", "blocks"],
    accessibility: []
  }
}
```

### **Step 3: Appointment Creation**

```typescript
// Appointments Collection - Calendar Integration
{
  id: "APT-YG-240822-001",
  orderId: "ORD-YG-240821-001",
  customer: "user_id_123",
  
  // Core appointment data
  title: "Yoga Class - Morning Flow",
  description: "Beginner-friendly vinyasa flow class",
  appointmentType: "class_session",
  
  // Timing
  startTime: "2024-08-22T07:00:00Z",
  endTime: "2024-08-22T08:00:00Z",
  timezone: "America/New_York",
  
  // Class-specific data
  classInfo: {
    sessionId: "YMF-240822-0700",
    instructor: {
      id: "instructor_sarah",
      name: "Sarah Johnson",
      bio: "Certified yoga instructor with 10 years experience"
    },
    capacity: {
      max: 20,
      current: 13,
      waitlist: 3
    },
    level: "beginner",
    equipment: ["yoga mat", "blocks", "strap"],
    roomSetup: "heated studio"
  },
  
  // Status tracking
  status: "confirmed",
  attendanceStatus: null, // "attended" | "no_show" | "cancelled"
  
  // Integration data
  calendarEventId: "cal_event_123",
  remindersSent: [],
  
  // Business intelligence
  revenueData: {
    amount: 25,
    commission: 3.75, // 15% platform fee
    instructorPay: 21.25
  }
}
```

## 🏋️ **Subscription & Membership System**

### **Recurring Subscription Flow**

```typescript
// Subscription Product Example
{
  title: "Frontage Road Gym - Monthly Membership",
  productType: "subscription",
  
  subscriptionConfig: {
    type: "membership",
    billingCycle: "monthly", // "weekly" | "monthly" | "quarterly" | "annual"
    
    access: {
      facilities: ["gym_floor", "cardio", "weights", "locker_room"],
      classes: "unlimited", // "unlimited" | number | "none"
      guestPasses: 2,
      personalTraining: 0 // sessions included
    },
    
    pricing: {
      setupFee: 50,
      monthlyRate: 49,
      annualDiscount: 10, // percentage off if paid annually
      familyDiscount: 20  // percentage off additional family members
    },
    
    commitment: {
      minimumTerm: 1, // months
      cancellationNotice: 30, // days
      freezeOptions: {
        allowed: true,
        maxPerYear: 2,
        maxDuration: 30 // days
      }
    }
  }
}
```

### **Class Capacity Management**

```typescript
// Class Session Management
interface ClassSession {
  id: string
  productId: string
  date: string
  time: string
  instructor: string
  
  capacity: {
    max: number
    booked: number
    waitlist: number
    noShows: number
  }
  
  bookings: Array<{
    orderId: string
    customerId: string
    status: "confirmed" | "cancelled" | "no_show"
    bookingTime: string
    paymentStatus: "paid" | "pending" | "refunded"
  }>
  
  waitlist: Array<{
    customerId: string
    addedAt: string
    notified: boolean
    position: number
  }>
}
```

## 🔄 **Integration Points**

### **Order → Appointment → Calendar Flow**

1. **Product Selection**: Customer chooses yoga class
2. **Availability Check**: System checks class capacity
3. **Order Creation**: Creates order with booking details
4. **Payment Processing**: Stripe handles payment
5. **Appointment Creation**: Creates appointment record
6. **Calendar Integration**: Adds to tenant calendar
7. **Confirmation**: Email/SMS confirmation sent
8. **Reminders**: Automated reminder system via LEO

### **Subscription Management**

```typescript
// Subscription Orders - Recurring Management
{
  orderId: "SUB-GYM-240821-001",
  subscriptionId: "gym_membership_123",
  
  billing: {
    nextBillingDate: "2024-09-21",
    amount: 49,
    status: "active", // "active" | "paused" | "cancelled" | "past_due"
    
    history: [
      { date: "2024-08-21", amount: 49, status: "paid" },
      { date: "2024-07-21", amount: 49, status: "paid" }
    ]
  },
  
  access: {
    membershipNumber: "FRG-2024-0156",
    accessCode: "1234*",
    validUntil: "2024-09-21T23:59:59Z",
    
    usage: {
      checkins: 18, // This month
      classesAttended: 12,
      guestPassesUsed: 1
    }
  }
}
```

## 🎭 **Universal Event & Booking Types**

### **🎵 Touring Performers & Entertainment**
- **Rock Band Tour**: Multi-city venues, VIP packages, merchandise bundles
- **Comedy Shows**: Multiple shows per venue, meet & greet add-ons
- **DJ Events**: Club bookings, private parties, festival slots
- **Theater Productions**: Season tickets, group discounts, premium seating

### **📚 Authors & Content Creators**
- **Book Signing Tours**: Independent bookstores, library events
- **Workshop Series**: Writing workshops, masterclasses
- **Virtual Events**: Online book clubs, Q&A sessions
- **Meet & Greets**: Fan events, photo opportunities

### **🏢 Enterprise & Corporate Events**
- **Fortune 500 Conferences**: Multi-day events, breakout sessions
- **Trade Shows**: Booth rentals, sponsorship packages
- **Corporate Training**: Multi-session programs, certification courses
- **Executive Retreats**: Luxury venues, team building activities

### **🏃 Fitness & Wellness (Local Examples)**
- **Frontage Road Gym A**: Basic weights + cardio ($39/month)
- **Frontage Road Gym B**: Full service + classes ($59/month)  
- **Frontage Road Gym C**: Premium + personal training ($89/month)
- **Yoga Studios**: Drop-in ($25), packages (5-pack $100), unlimited ($89/month)

### **☕ Local Business Classes**
- **Coffee Shop Workshops**: Latte art (8 max, $35), cupping (12 max, $25)
- **Cooking Classes**: Small group (6 max, $75), couples (4 max, $120)
- **Art Studios**: Pottery (10 max, $45), painting (15 max, $35)

## 🤖 **LEO Integration**

LEO can handle:
- **"Book me for yoga tomorrow at 7am"** → Checks availability, processes booking
- **"Cancel my Friday appointment"** → Finds appointment, processes cancellation
- **"How many spots left in tonight's class?"** → Checks capacity
- **"Pause my gym membership for vacation"** → Processes membership freeze

## 📊 **Business Intelligence**

The system tracks:
- **Class popularity** and optimal scheduling
- **No-show patterns** for better overbooking
- **Revenue per class/service**
- **Member retention** and usage patterns
- **Instructor performance** and customer satisfaction

## 🎪 **Enterprise Event Management**

### **Multi-Day Conference Example**
```typescript
// Fortune 500 Conference Product
{
  title: "TechCorp Annual Summit 2024",
  productType: "enterprise_event",
  
  eventConfig: {
    type: "multi_day_conference",
    duration: { days: 3, totalHours: 24 },
    
    venue: {
      name: "Dallas Convention Center",
      address: "650 S Griffin St, Dallas, TX 75202",
      capacity: {
        main_hall: 5000,
        breakout_rooms: [200, 150, 100, 100, 75, 75],
        networking_space: 1000
      },
      amenities: ["wifi", "av_equipment", "catering", "parking"]
    },
    
    ticketTiers: [
      {
        name: "Early Bird",
        price: 899,
        includes: ["all_sessions", "meals", "networking", "materials"],
        limit: 500,
        deadline: "2024-06-01"
      },
      {
        name: "VIP Executive",
        price: 1899,
        includes: ["all_sessions", "meals", "networking", "materials", "executive_lounge", "priority_seating", "meet_speakers"],
        limit: 100
      },
      {
        name: "Virtual Attendance",
        price: 299,
        includes: ["livestream", "recordings", "digital_materials"],
        limit: 2000
      }
    ],
    
    agenda: [
      {
        day: 1,
        sessions: [
          {
            time: "09:00-10:30",
            title: "Keynote: Future of AI in Enterprise",
            speaker: "Dr. Sarah Chen, CTO TechCorp",
            room: "main_hall",
            capacity: 5000
          },
          {
            time: "11:00-12:00", 
            title: "Breakout: AI Implementation Strategies",
            speaker: "Panel Discussion",
            room: "breakout_1",
            capacity: 200
          }
        ]
      }
    ],
    
    mediaGallery: {
      eventPhotos: ["media_id_1", "media_id_2"],
      speakerHeadshots: ["media_id_3", "media_id_4"],
      venuePhotos: ["media_id_5", "media_id_6"],
      eventVideos: ["media_id_7"], // Promotional videos
      presentations: ["media_id_8", "media_id_9"] // PDF materials
    }
  }
}
```

### **Touring Band Example**
```typescript
// Rock Band Tour Product
{
  title: "The Soul Van Brothers - Clearwater Tour 2024",
  productType: "touring_event",
  
  tourConfig: {
    type: "concert_tour",
    
    venues: [
      {
        city: "Clearwater, FL",
        venue: "Ruth Eckerd Hall",
        date: "2024-09-15",
        capacity: 2100,
        ticketTiers: [
          { name: "General Admission", price: 45, capacity: 1500 },
          { name: "VIP Meet & Greet", price: 125, capacity: 100, includes: ["meet_greet", "signed_poster", "early_entry"] },
          { name: "Backstage Experience", price: 299, capacity: 20, includes: ["backstage_tour", "soundcheck", "dinner_with_band"] }
        ]
      },
      {
        city: "Tampa, FL", 
        venue: "Amalie Arena",
        date: "2024-09-17",
        capacity: 19000,
        ticketTiers: [
          { name: "Lawn", price: 35, capacity: 8000 },
          { name: "Reserved Seating", price: 65, capacity: 10000 },
          { name: "VIP Package", price: 150, capacity: 500 },
          { name: "Meet & Greet", price: 275, capacity: 50 }
        ]
      }
    ],
    
    merchandise: {
      bundleWithTickets: true,
      items: [
        { name: "Tour T-Shirt", price: 25, sizes: ["S", "M", "L", "XL", "XXL"] },
        { name: "Signed Poster", price: 15, limited: 100 },
        { name: "Vinyl Album", price: 35, preorder: true },
        { name: "VIP Laminate", price: 10, vipOnly: true }
      ]
    },
    
    mediaGallery: {
      bandPhotos: ["band_promo_1", "band_live_2"],
      venuePhotos: ["venue_exterior", "venue_interior"],
      tourPosters: ["tour_poster_main", "venue_specific_posters"],
      musicVideos: ["single_1_video", "behind_scenes"],
      socialContent: ["instagram_stories", "tiktok_clips"]
    }
  }
}
```

### **Author Book Tour Example**
```typescript
// Author Tour Product
{
  title: "Neal Stephenson - Book Signing & Discussion",
  productType: "author_event",
  
  eventConfig: {
    type: "book_signing_tour",
    
    bookDetails: {
      title: "Termination Shock",
      isbn: "978-0-06-302805-8",
      publisher: "William Morrow",
      genre: "Science Fiction"
    },
    
    tourStops: [
      {
        city: "Seattle, WA",
        venue: "Elliott Bay Book Company",
        date: "2024-10-05",
        time: "19:00",
        capacity: 150,
        format: "reading_and_qa",
        ticketPrice: 35,
        includes: ["signed_book", "q_and_a", "photo_op"]
      },
      {
        city: "Portland, OR",
        venue: "Powell's Books",
        date: "2024-10-07", 
        time: "18:30",
        capacity: 200,
        format: "discussion_panel",
        ticketPrice: 40,
        includes: ["signed_book", "panel_discussion", "wine_reception"]
      }
    ],
    
    packages: [
      {
        name: "Book Only",
        price: 35,
        includes: ["signed_hardcover"]
      },
      {
        name: "VIP Experience", 
        price: 125,
        includes: ["signed_hardcover", "private_meet_greet", "limited_edition_print", "priority_seating"],
        limit: 25
      }
    ],
    
    mediaGallery: {
      authorPhotos: ["author_headshot", "author_casual"],
      bookCovers: ["hardcover_front", "paperback_front"],
      eventPhotos: ["previous_events", "venue_photos"],
      bookTrailer: ["book_trailer_video"],
      interviews: ["author_interview_1", "podcast_appearance"]
    }
  }
}
```

## 🌟 **Universal Commerce Vision**

### **Scale Flexibility**
- **Solo Entrepreneur**: $5 yoga class bookings
- **Small Business**: $500 consultation appointments  
- **Medium Enterprise**: $50,000 corporate training programs
- **Fortune 500**: $5,000,000 annual conference series

### **Payment Complexity**
- **Simple**: Single ticket purchase
- **Bundled**: Ticket + merchandise + VIP experience
- **Subscription**: Monthly gym membership with class credits
- **Enterprise**: Multi-year corporate contracts with milestone payments

### **Media Integration**
Every event type can have rich media galleries:
- **📸 Photo Collections**: Event photos, venue shots, performer headshots
- **🎥 Video Content**: Promotional videos, behind-the-scenes, live streams
- **📄 Documents**: PDFs (programs, menus, technical riders)
- **🎵 Audio**: Music samples, podcast previews, audio guides

### **LEO's Universal Event Assistant**
- **"Book 2 VIP tickets for the Soul Van Brothers show in Tampa"**
- **"What's included in the backstage experience package?"**
- **"Cancel my yoga membership but keep my personal training sessions"**
- **"Register our company for the TechCorp summit, executive tier"**

This creates a complete ecosystem where small businesses can offer complex booking scenarios with enterprise-grade management! 🚀

**Batch 2 Complete: 4/29 additional errors fixed**
**Total Progress: 16/48 TypeScript errors resolved**

Ready for the next batch!
