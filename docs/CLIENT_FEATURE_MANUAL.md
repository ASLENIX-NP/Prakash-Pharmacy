# Prakash Pharmacy Management System
## Feature Specification and Operations Manual
**Prepared for:** Mr. Prakash Dulal and Pharmacy Staff  
**Location:** Hetauda-5, Sanopokhara, Makwanpur, Nepal  
**Date:** November 2026  

---

### Table of Contents
1. Introduction and System Purpose
2. Point-of-Sale (POS) and Counter Billing
3. Inventory, Batch and Expiry Control
4. Customer Credit (Udharo) Management
5. Sales Returns and Credit Notes
6. Distributor and Purchase Management
7. Outpatient Clinic and Doctor Consultation (OPD)
8. Financial Reports and Accounting
9. System Administration and User Security
10. Recommended Daily Operating Procedures
11. Current Project Status and Production Deployment
12. System Delivery and Acceptance Sign-Off

---

## 1. Introduction and System Purpose
This operations manual provides a comprehensive reference for the custom pharmacy management software developed for Prakash Pharmacy. The system is designed to streamline daily counter retail dispensing, maintain unit-level inventory control, record customer credit ledgers, track distributor purchases, and integrate clinic outpatient consultations.

The primary objective of the software is to eliminate manual paper registers, prevent inventory losses from expired stock through automated batch tracking, ensure accurate pricing for loose tablet dispensing, and provide an efficient checkout experience for retail customers and clinic patients.

---

## 2. Point-of-Sale (POS) and Counter Billing
The counter billing terminal is optimized for speed, precision, and ease of use during high-volume pharmacy hours.

- **2.1 Rapid Medicine Search:** Counter staff can find medicines in fractions of a second by typing the brand name, typing the generic molecule composition, or scanning the product barcode using any standard handheld barcode scanner.
- **2.2 Expiry-Based Stock Selection (FEFO):** When multiple batches of the same medicine are available in inventory, the system automatically selects the batch expiring earliest (First-Expired, First-Out). This ensures that older stock is dispensed before newly arrived batches, preventing expired items from remaining on store shelves. Cashiers retain the ability to manually select an alternate batch when specifically required.
- **2.3 Full Pack and Loose Unit Sales with Automatic Pricing:** The billing engine natively supports selling both full strips or boxes and individual loose tablets:
  - When a customer purchases loose tablets, the cashier enters the loose unit quantity.
  - The system calculates the per-tablet price automatically by dividing the Maximum Retail Price (MRP) by the pack size (Units Per Pack).
  - Inventory counts update immediately: unopened pack quantities and loose unit quantities adjust in real time without requiring manual arithmetic.
- **2.4 Flexible Payment Methods:** The billing terminal accommodates all standard commercial payment options: Cash (with automatic change calculation), Fonepay and QR Code mobile wallets, Bank Card, Customer Credit (Udharo), and Split Payments across tenders.
- **2.5 Discounts and Invoice Printing:** Discounts can be applied as either a flat rupee deduction or a percentage, applied to specific items or the entire invoice total. Invoices can be printed on standard 80mm thermal receipt rolls or full-sheet A4/A5 paper, complete with store details, sequential invoice numbers, cashier identification, and customer copy notes.

---

## 3. Inventory, Batch and Expiry Control
The inventory management system tracks stock on the premises at both the batch and unit level.

- **3.1 Real-Time Pack and Loose Unit Tracking:** Stock quantities are displayed clearly as unopened full packs alongside individual loose tablets. When loose units are sold and reach zero, opening a new pack automatically decrements the full pack count and increments the loose unit count.
- **3.2 Expiry Monitoring and Safety Classification:** Stock is organized by expiration date to maintain regulatory safety and quality control:
  - **Expired Stock:** Automatically locked from counter dispensing to safeguard patient health.
  - **Critical (Expiring within 30 Days):** Highlighted for immediate dispensing priority or return to the medicine distributor.
  - **Warning (Expiring within 90 Days):** Early notice indicator to prioritize stock rotation on shelves.
  - **Safe Stock:** Active inventory with sufficient shelf life.
- **3.3 Regulatory Classifications:** Medicines requiring a doctor's prescription are clearly tagged (Rx Required), and controlled substances are flagged to ensure strict compliance with pharmacy dispensing standards.
- **3.4 Shelf and Rack Storage Locations:** Every product can be assigned a physical storage address in the store (such as Rack A-1, Counter Shelf, or Refrigerator). This enables new staff to locate items quickly without interrupting other team members.
- **3.5 Free Scheme Bonus Packs:** Bonus goods received from pharmaceutical companies on promotional schemes (such as 10+1 or 10+2 free packs) are recorded in inventory under a dedicated bonus field. This ensures stock counts remain accurate without artificially lowering the recorded purchase cost price.
- **3.6 Physical Stock Audit Worksheet:** A digital audit worksheet enables staff to conduct physical shelf counts, compare counted units against system records, and log adjustments for damaged packaging, broken bottles, or shrinkage with an audit trail.

---

## 4. Customer Credit (Udharo) Management
The software replaces manual paper notebooks with an automated digital customer ledger.

- **4.1 Customer Profiles and Credit Limits:** Staff can maintain customer records including name, mobile phone number, residential address, and an authorized credit limit.
- **4.2 Automatic Balance Updates:** When an approved customer purchases on credit, selecting the Credit payment mode posts the invoice total directly to that customer's digital ledger balance. No double-entry is required.
- **4.3 Payment Collection and Receipts:** When a customer settles their balance, cashiers record the received amount (Cash or QR Code). The system updates the outstanding balance immediately and generates an official payment acknowledgement receipt.
- **4.4 Account Statements:** Staff can view or print an itemized account statement showing all credit purchases, settlement dates, payment receipts, and the current outstanding balance to resolve customer billing inquiries transparently.

---

## 5. Sales Returns and Credit Notes
Customer returns are processed with full inventory and financial accuracy.

- **5.1 Invoice-Linked Returns:** Staff can look up the original bill number to view the exact items and prices charged, then select specific medicines and quantities to return. Counter ad-hoc returns are also supported.
- **5.2 Automatic Stock Restoration:** Returned medicines that are undamaged and resalable are automatically added back to active inventory under their original batch number.
- **5.3 Credit Balance Adjustment:** If an unpaid credit sale is returned, the system automatically reduces the customer's ledger debt rather than issuing a cash refund from the counter drawer.
- **5.4 Credit Notes:** The system generates official, sequentially numbered credit notes with proper adjustment for returned taxable goods.

---

## 6. Distributor and Purchase Management
This module coordinates supplier orders, inward deliveries, and wholesale payments.

- **6.1 Distributor Directory:** Maintains records for medicine stockists and wholesalers, including company names, contact persons, phone numbers, and agreed credit terms.
- **6.2 Inward Purchase Entry:** When stock shipments arrive, staff enter the distributor invoice details: batch numbers, expiration dates, pack sizes, purchase costs, MRP, and promotional bonus goods. Upon saving, inventory levels and billing rates update instantly.
- **6.3 Supplier Returns (Debit Notes):** Medicines with damaged packaging, breakage, or near-expiry dates can be returned to the distributor. The system records the return, deducts the items from stock, and generates a debit note that reduces the payable balance owed to that distributor.

---

## 7. Outpatient Clinic and Doctor Consultation (OPD)
For polyclinic operations, the system integrates the doctor consultation room directly with the pharmacy dispensing counter.

- **7.1 Doctor Schedules and Waiting Queue:** Staff can manage visiting doctors, medical council registration numbers, consultation rooms, and fees. Arriving patients are checked in and assigned to the doctor's queue.
- **7.2 Patient Registration and Vital Signs:** Maintains digital patient histories including demographic information and known drug allergies. Clinic staff or nurses can record vital signs: Blood Pressure (BP), Pulse Rate, Body Temperature, Respiratory Rate, Blood Oxygen (SpO2), and Body Weight.
- **7.3 Digital Prescription Handoff:** Consulting doctors record clinical diagnoses and select medicines from the pharmacy catalog with dosage instructions. When the doctor saves the prescription:
  - The prescribed medicines appear immediately on the pharmacy billing counter.
  - The counter cashier loads the prescription directly into the POS cart with a single click.
  - This removes delays caused by reading handwritten prescriptions and eliminates dispensing errors.

---

## 8. Financial Reports and Accounting
The reporting suite provides daily operational summaries and financial oversight.

- **8.1 Daily Sales and Gross Profit:** Reports total daily revenue alongside the cost of goods sold (COGS) to calculate true gross profit in Nepalese Rupees (NPR), correctly factoring in discounts and restocked returns.
- **8.2 Daily Drawer Cash Reconciliation:** At shift close, the system generates an end-of-day summary detailing collections by payment method (Cash, QR Code, Card, and Credit). Staff can count physical cash in the drawer and match it against the report to ensure zero shortages.
- **8.3 Sales and Tax Registers:** Generates monthly sales registers separating taxable sales, exempt sales, and tax collections for accounting records.
- **8.4 Stock Valuation and Movement Analysis:** Calculates total stock valuation at both purchase cost and retail price (MRP). Movement reports highlight fast-selling drugs and slow-moving items to assist with purchasing decisions.

---

## 9. System Administration and User Security
- **9.1 Role-Based User Access:**
  - **Administrator:** Full access to financial profit reports, purchase costs, staff accounts, and store settings.
  - **Pharmacist:** Access to inventory records, distributor purchasing, and medicine dispensing.
  - **Cashier:** Access restricted to counter sales, returns, and customer credit collection. Purchase costs and store configurations are hidden.
  - **Doctor:** Dedicated access to the clinic OPD queue, patient vitals, and prescription writing.
- **9.2 Bulk Excel Import and Export:** A standardized Excel template allows initial stock loading and bulk updates, complete with Prescription (Rx) indicators and Free Scheme Bonus packs. Staff can also export the full inventory catalog to Excel at any time for offline backup.
- **9.3 Store Configuration:** Centrally configures store details including business name, contact phone, store address, receipt footer notes, and sequential invoice numbering.

---

## 10. Recommended Daily Operating Procedures
Pharmacy staff should follow this standard daily operational sequence:

1. **Morning Shift Opening:**
   - Log in to the counter terminal using assigned credentials.
   - Ensure thermal receipt paper is loaded in the counter printer.
   - Check the Expiry Alert dashboard for stock expiring in the current month.
2. **Customer Dispensing:**
   - For prescription medicines, verify the doctor's prescription before finalizing the sale.
   - For credit customers, confirm their account balance before issuing additional credit.
3. **Distributor Inwarding:**
   - Enter distributor delivery invoices on the same day stock arrives to keep inventory numbers accurate.
4. **Evening Shift Close:**
   - Generate the Daily Sales Summary from the Reports view.
   - Count physical cash in the drawer and reconcile it against the reported cash total.
   - Log out of the counter terminal.

---

## 11. Current Project Status and Production Deployment

### 11.1 Software Development Completion (100% Completed)
All core software features, user interfaces, database schemas, business rules, and security controls requested for Prakash Pharmacy have been fully developed, tested, and verified. The system is operating in a complete, production-ready state in the staging environment.

| Functional Module | Build Status | Verification Result |
| :--- | :--- | :--- |
| POS Counter Billing Terminal | Completed | Verified (Fast Search, FEFO Batch Selection) |
| Dual Unit Pack/Loose Engine | Completed | Verified (Automatic Rate & Unit Calculation) |
| Inventory & Expiry Monitoring | Completed | Verified (Safety Warnings & Locked Expired Stock) |
| Customer Credit (Udharo) Ledger | Completed | Verified (Direct Ledger Posting & Receipts) |
| Sales Returns & Credit Notes | Completed | Verified (Stock Restoration & Khata Adjustments) |
| Distributor Purchases & Returns | Completed | Verified (Cost Tracking & Debit Notes) |
| OPD Clinic & Doctor Prescription | Completed | Verified (Vitals Recording & Instant Billing Handoff) |
| Financial Reports & Analytics | Completed | Verified (Gross Profit & Cash Drawer Reconciliation) |
| Excel Bulk Import / Export | Completed | Verified (Prescription & Bonus Columns Added) |
| Role-Based Security (RBAC) | Completed | Verified (Admin, Pharmacist, Cashier, Doctor) |

### 11.2 Remaining Milestone: Production Cloud Deployment
The software development lifecycle is entirely finished. The only remaining operational phase for full commercial rollout is deploying the application to the production cloud infrastructure on Render.

#### Remaining Deployment Activities:
1. **Managed PostgreSQL Database Provisioning:** Provisioning the hosted production database instance on Render and applying database migrations.
2. **Cloud Environment Configuration:** Setting production environment variables, including secure JSON Web Token (JWT) secrets, CORS permitted origins, and application port configurations.
3. **Automated Cloud Build and Hosting:** Connecting the code repository to Render for automated frontend (React 19) and backend (Express 5) builds with continuous deployment.
4. **Domain and SSL Security:** Attaching the live pharmacy domain with automatic HTTPS/TLS certificate encryption.
5. **Production Verification and Staff Handover:** Running final counter end-to-end smoke tests on physical receipt printers and conducting final operational staff training.

---

## 12. System Delivery and Acceptance Sign-Off
The Prakash Pharmacy Management System software development is complete in accordance with all stated operational requirements and is prepared for final production cloud deployment.

| Delivered By | Received and Accepted By |
| :--- | :--- |
| **Software Engineering Team** | **Mr. Prakash Dulal** |
| Lead Systems Developer | Proprietor, Prakash Pharmacy |
| Date: November 2026 | Date: November 2026 |
