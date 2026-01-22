# Stokstak – Source of Truth (SOT)

## 1. Purpose of This Document

This document is the **single source of truth** for the Stokstak application. All future development, bug fixes, database changes, UI/UX updates, and feature additions **must align with this document**.

If a proposed change conflicts with this document, **this document must be updated first**, then implemented in code and/or database.

---

## 2. Product Overview

**Product Name:** Stokstak  
**Type:** Multi-tenant Inventory, Purchasing & Vendor Management System  
**Primary Users:** Construction companies, contractors, operations teams  
**Core Principle:** One user can belong to multiple companies; all data is **company-scoped**.

---

## 3. Core Architectural Principles

### 3.1 Multi-Tenancy

- Every business object **must** belong to a `company_id`.
- A user may belong to **multiple companies** via `company_users`.
- Company context is resolved by (highest priority first):
  1. Route param (`/[companyId]`)
  2. Cookie (`stokstak_company_id`)
  3. Fallback: `current_company_id()`

### 3.2 Security & Data Isolation

- **Row Level Security (RLS) is mandatory** on all company-scoped tables.
- No query may rely on client-side filtering for security.
- Authorization logic lives in **Postgres functions/policies**, not the frontend.

### 3.3 Supabase as Backend

- Database: PostgreSQL (Supabase)
- Auth: Supabase Auth
- Storage: Supabase Storage (private buckets)
- Access: Signed URLs for private documents

---

## 4. User & Role Model

### 4.1 User Identity

- Auth identity: `auth.users`
- App profile: `profiles`

### 4.2 Company Membership

Table: `company_users`

| Column | Purpose |
| --- | --- |
| user_id | Supabase auth user |
| company_id | Company scope |
| role | Authorization level |

### 4.3 Roles (Canonical)

| Role | Capabilities |
| --- | --- |
| owner | Full system control |
| admin | Company-wide management |
| pm | Approvals, reports |
| purchaser | Purchasing & invoices |
| receiver | Receiving & verification |
| member | Inventory access |
| requester | Create purchase requests |

Roles are **company-specific**, not global.

---

## 5. Navigation & UI Rules

### 5.1 Layout

- Desktop: **Persistent left sidebar**
- Mobile: Sidebar hidden; opens via hamburger (on-demand)

### 5.2 Sidebar Modules (Canonical)

| Module | Visibility |
| --- | --- |
| Home | All users |
| Stock | All members |
| Purchase | Requester+ |
| Vendors | Purchaser+ |
| Reports | PM+ |
| Settings | Admin+ |
| Logout | All users |

Sidebar visibility is **role-based** and enforced both UI + backend.

---

## 6. Inventory (Stock) Module

### 6.1 Items

Table: `items`

Required behaviors:

- Tile view (default)
- List view (optional toggle)
- Category-collapsible view on Home
- Item detail modal on click

### 6.2 Supporting Masters

| Table | Purpose |
| --- | --- |
| categories | Item grouping |
| item_types | Tool, material, asset |
| locations | Physical storage |

All are **company-scoped and manageable** via Settings.

---

## 7. Stock Verification

Table: `stock_verifications`

Each verification records:

- Item
- Verified date
- Verified quantity
- Notes
- Photo (optional)

Rules:

- Multiple verifications per item
- Latest verification used in reports
- Full audit trail preserved

---

## 8. Purchasing Module

### 8.1 Purchase Requests

Workflow:

1. Draft
2. Submitted
3. PM Approved
4. President Approved
5. Purchased
6. Received

All transitions are logged in `purchase_request_events`.

---

## 9. Vendor Management Module

### 9.1 Vendors

Table: `vendors`

Canonical fields:

- name
- contact_name
- phone
- email
- company_id

### 9.2 Vendor Invoices

Table: `vendor_invoices`

Required fields:

- vendor_id
- invoice_number
- invoice_date
- amount
- status
- attachment_url

### 9.3 Vendor Payments

Table: `vendor_payments`

Required fields:

- vendor_invoice_id (nullable for advance payments)
- payment_date
- amount
- method
- reference
- attachment_url

### 9.4 Financial Rules

- Balance = Invoiced – Paid
- Partial payments allowed
- Attachments are required for audit

---

## 10. Reports Module

### 10.1 Inventory Verification Report

#### Report Name: Last Verified

**Purpose**  
Provide a clear, auditable view of the most recent physical verification of inventory items, enriched with visual identification.

**Approved Behavior**

- Display the **primary item image** as a thumbnail for each item in the report.
- Thumbnail source:
  - `items.image_url` (primary)
  - If NULL: display a standard placeholder.
- Thumbnail must be visible in both desktop and mobile views.

**Inputs**

- Company (implicit from active session)
- Optional filters:
  - Category
  - Location
  - Item Type
  - Verification date range

**Authoritative Data Sources**

- `items`
- `stock_verifications`

**Core Logic**

- For each item:
  - Select the **latest** `stock_verifications.verified_at`
  - Join to `items` on `item_id`
- Resolve thumbnail:
  - Use `items.image_url` when available
  - Fallback to placeholder when missing

**Output Fields**

1. Item thumbnail (image)
2. Item name
3. Category
4. Location
5. Last verified date
6. Last verified quantity
7. Verified by (user)

**Access Control**

- Available to all authenticated users
- Data restricted by company membership (RLS enforced)

**Business Reason**

- Improves usability and audit accuracy by enabling quick physical identification

### 10.2 Depreciation Report

**Inputs**

- Purchase price
- Purchase date
- Life (years)
- Depreciation %
- As-of date

**Formula**

Straight-line depreciation.

---

## 11. File & Media Handling

- All uploads go to Supabase Storage
- Buckets are **private**
- Access via signed URLs only
- Supported sources:
  - File picker (desktop)
  - Camera (mobile)

---

## 12. Database Rules (Non-Negotiable)

- No table without RLS (unless explicitly documented)
- No policy calling undefined functions
- No frontend-only authorization
- Every table change requires:
  1. SQL migration
  2. SOT update

---

## 13. Change Management

Before any change:

1. Update this document
2. Review impact (DB, UI, RLS)
3. Apply change
4. Verify against SOT

---

## 14. This Document Is Law

If code and database disagree with this document:

**The code is wrong.**

All future updates must reference this file.
