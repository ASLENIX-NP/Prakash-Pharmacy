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
11. Handover and Acceptance Sign-Off

---

## 1. Introduction and System Purpose
This manual provides an operational reference for the software developed for Prakash Pharmacy. The system has been customized to support daily counter sales, inventory tracking, customer credit accounts, distributor purchasing, and outpatient clinic consultations.

The primary objective of the software is to eliminate manual paper ledgers, prevent financial losses from drug expiries through automated batch tracking, and provide a streamlined checkout experience for retail customers and clinic patients.

---

## 2. Point-of-Sale (POS) and Counter Billing
The counter billing module is engineered for fast, accurate dispensing during peak pharmacy hours.

- **Rapid Medicine Search:** Counter staff can find medicines in less than a second by typing the brand name, the generic molecule composition, or scanning the product barcode with any standard handheld barcode scanner.
- **Expiry-Based Stock Selection (FEFO):** When multiple batches of the same medicine are available in inventory, the system automatically selects the batch expiring earliest (First-Expired, First-Out). This ensures that older stock is sold before newly arrived batches, preventing expired stock from remaining unnoticed on store shelves. Cashiers can also manually choose an alternate batch if requested by the customer.
- **Full Pack and Loose Unit Sales with Automatic Pricing:** The billing engine supports selling both full strips/boxes and individual loose tablets. When a customer purchases loose tablets, the cashier enters the unit quantity. The system automatically calculates the correct per-tablet price by dividing the Maximum Retail Price (MRP) by the pack size (Units Per Pack). The inventory stock is immediately adjusted: full pack counts and loose unit quantities update in real time without requiring manual calculations.
- **Multiple Payment Methods:** The terminal accommodates all common payment options: Cash, Fonepay and QR Code, Bank Card, Customer Credit (Udharo), and Split Payments across tenders.
- **Discounts and Invoice Printing:** Discounts can be applied as either a flat rupee deduction or a percentage, applied to individual items or the entire bill. Invoices can be printed on standard 80mm thermal receipt rolls or full-sheet A4/A5 paper, complete with store details, sequential invoice numbers, cashier identification, and custom return policy notes.

---

## 3. Inventory, Batch and Expiry Control
The inventory management system tracks all stock on the premises at the batch and unit level.

- **Real-Time Pack and Loose Unit Counts:** Stock quantities are displayed clearly as unopened full packs and loose individual tablets. When loose units are sold and reach zero, opening a new pack automatically decrements the pack count and increments the loose unit count.
- **Expiry Monitoring System:** Stock is organized by expiration date to maintain quality control:
  - **Expired Medicines:** The system automatically locks expired stock from being billed at the counter to protect patient safety.
  - **Expiring within 30 Days:** Flagged for immediate dispensing priority or return to the medicine distributor.
  - **Expiring within 90 Days:** Early warning indicator to prioritize stock rotation.
  - **Safe Stock:** Active inventory with sufficient shelf life.
- **Regulatory Compliance Indicators:** Medicines requiring a doctor's prescription are clearly tagged (Rx Required), and controlled substances are flagged to ensure strict compliance with pharmacy dispensing guidelines.
- **Shelf and Rack Storage Locations:** Every product can be assigned a physical storage address in the store (for example, Rack A-1, Counter Shelf, or Refrigerator). This allows new counter staff to locate items immediately without interrupting other team members.
- **Free Scheme Bonus Packs:** Bonus goods received from pharmaceutical companies on schemes (such as 10+1 or 10+2 free packs) are recorded in inventory under a dedicated bonus field. This ensures stock counts remain accurate without artificially lowering the recorded purchase cost price.
- **Physical Stock Audit Worksheet:** A digital worksheet enables staff to conduct periodic shelf counts, compare physical quantities against system records, and record adjustments for broken bottles, damaged packaging, or shrinkage with an audit log.

---

## 4. Customer Credit (Udharo) Management
The software replaces manual paper notebooks with an automated digital customer ledger.

- **Customer Profiles and Credit Limits:** Staff can maintain customer records including name, mobile phone number, residential address, and an authorized credit limit.
- **Automatic Balance Updates:** When an approved customer purchases on credit, selecting the Credit payment mode posts the invoice total to that customer's digital ledger balance. No double-entry is required.
- **Payment Collection and Receipts:** When a customer settles their balance, cashiers record the received amount (Cash or QR Code). The system updates the outstanding balance immediately and generates an official payment acknowledgement receipt.
- **Account Statements:** Staff can view or print an itemized account statement showing all credit purchases, settlement dates, payment receipts, and the current balance to resolve customer billing inquiries without dispute.

---

## 5. Sales Returns and Credit Notes
Customer returns are processed with full inventory and financial accuracy.

- **Invoice-Linked Returns:** Staff can look up the original bill number to view the exact items and prices charged, then select specific medicines and quantities to return. Ad-hoc counter returns are also supported.
- **Automatic Inventory Restocking:** Returned medicines that are undamaged and resalable are automatically added back to active inventory under their original batch number.
- **Credit Balance Adjustment:** If an unpaid credit sale is returned, the system automatically reduces the customer's ledger debt rather than issuing a cash refund from the counter drawer.
- **Credit Notes:** The system generates official, sequentially numbered credit notes with proper adjustment for returned taxable goods.

---

## 6. Distributor and Purchase Management
This module coordinates supplier orders, inward deliveries, and wholesale payments.

- **Distributor Directory:** Maintains records for medicine stockists and wholesalers, including company names, contact persons, phone numbers, and agreed credit terms.
- **Inward Purchase Entry:** When stock shipments arrive, staff enter the distributor invoice details: batch numbers, expiration dates, pack sizes, purchase costs, MRP, and promotional bonus goods. Upon saving, inventory levels and billing rates update instantly.
- **Supplier Returns (Debit Notes):** Medicines with damaged packaging, breakage, or near-expiry dates can be returned to the distributor. The system records the return, deducts the items from stock, and generates a debit note that reduces the payable balance owed to that distributor.

---

## 7. Outpatient Clinic and Doctor Consultation (OPD)
For polyclinic operations, the system integrates the doctor consultation room directly with the pharmacy dispensing counter.

- **Doctor Schedules and Waiting Queue:** Staff can manage visiting doctors, medical council registration numbers, consultation rooms, and fees. Arriving patients are checked in and assigned to the doctor's queue.
- **Patient Registration and Vital Signs:** Maintains digital patient histories including demographic information and known drug allergies. Clinic staff or nurses can record vital signs: Blood Pressure (BP), Pulse Rate, Body Temperature, Respiratory Rate, Blood Oxygen (SpO2), and Body Weight.
- **Digital Prescription Handoff:** Consulting doctors record clinical diagnoses and select medicines from the pharmacy catalog with dosage instructions. When the doctor saves the prescription:
  - The prescribed medicines appear immediately on the pharmacy billing counter.
  - The counter cashier loads the prescription directly into the POS cart with a single click.
  - This removes delays caused by reading handwritten prescriptions and eliminates dispensing errors.

---

## 8. Financial Reports and Accounting
The reporting suite provides daily operational summaries and financial oversight.

- **Daily Sales and Gross Profit:** Reports total daily revenue alongside the cost of goods sold (COGS) to calculate true gross profit in Rupees (NPR), correctly factoring in discounts and restocked returns.
- **Daily Drawer Cash Reconciliation:** At shift close, the system generates an end-of-day summary detailing collections by payment method (Cash, QR Code, Card, and Credit). Staff can count physical cash in the drawer and match it against the report to ensure zero shortages.
- **Sales and Tax Registers:** Generates monthly sales registers separating taxable sales, exempt sales, and tax collections for accounting records.
- **Stock Valuation and Movement Analysis:** Calculates total stock valuation at both purchase cost and retail price (MRP). Movement reports highlight fast-selling drugs and slow-moving items to assist with purchasing decisions.

---

## 9. System Administration and User Security
- **Role-Based User Access:**
  - **Administrator:** Full access to financial profit reports, purchase costs, staff accounts, and store settings.
  - **Pharmacist:** Access to inventory records, distributor purchasing, and medicine dispensing.
  - **Cashier:** Access restricted to counter sales, returns, and customer credit collection. Purchase costs and store configurations are hidden.
  - **Doctor:** Dedicated access to the clinic OPD queue, patient vitals, and prescription writing.
- **Bulk Excel Import and Export:** A standardized Excel template allows initial stock loading and bulk updates. Staff can also export the full inventory catalog to Excel at any time for offline backup.
- **Store Configuration:** Centrally configures store details including business name, contact phone, store address, receipt footer notes, and sequential invoice numbering.

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

## 11. Handover and Acceptance Sign-Off
The Prakash Pharmacy Management System has been fully developed, verified, and delivered in accordance with operational requirements.

| Delivered By | Received and Accepted By |
| :--- | :--- |
| **Software Engineering Team** | **Mr. Prakash Dulal** |
| Lead Systems Developer | Proprietor, Prakash Pharmacy |
| Date: November 2026 | Date: November 2026 |
