# Prakash Pharmacy Management System
## Feature Specification and Operations Manual
**Prepared for:** Mr. Prakash Dulal and Pharmacy Staff  
**Location:** Hetauda-5, Sanopokhara, Makwanpur, Nepal  
**PAN:** 123798907 | **DDA License:** 3780516073935  
**Date:** November 2026  

---

### Table of Contents
1. Introduction and Purpose
2. Point-of-Sale (POS) and Counter Billing
3. Inventory and Stock Management
4. Customer Credit (Udharo) Ledger
5. Sales Returns and Credit Notes
6. Distributor and Purchase Management
7. Outpatient Clinic and Doctor Consultation (OPD)
8. Financial Reports and Accounting
9. System Administration and Security
10. Recommended Daily Operating Checklist
11. Handover and Acceptance Sign-Off

---

## 1. Introduction and Purpose
This document details the complete feature set of the management software developed for Prakash Pharmacy. The system has been customized to meet the operational, clinical, and regulatory requirements of community pharmacy retail in Nepal.

The primary objective of the software is to provide an efficient, reliable solution for daily counter billing, batch-level expiry monitoring, customer credit ledgers, distributor purchasing, and integrated outpatient clinic consultations. All features described herein are fully operational and ready for use.

---

## 2. Point-of-Sale (POS) and Counter Billing
The counter billing terminal is designed for high-speed transactions during peak pharmacy hours.

- **Rapid Medicine Search:** Cashiers can locate any medicine in less than a second by typing part of the brand name, the generic molecule name, or scanning its barcode with a handheld scanner.
- **Expiry-Based Batch Selection (FEFO):** When multiple batches of the same product exist in inventory, the system automatically selects the batch expiring earliest (First-Expired, First-Out). This ensures that older stock is dispensed before newer arrivals, minimizing shelf expiry losses. Cashiers retain the ability to select an alternate batch if requested by the customer.
- **Pack and Loose Unit Pricing:** The software handles both full strip/box sales and individual tablet/capsule sales. When loose tablets are billed, the system divides the Maximum Retail Price (MRP) by the pack size to determine the unit price automatically, eliminating manual calculation errors.
- **Multiple Payment Methods:** Counter staff can record payments using Cash, Fonepay (QR Code), Debit/Credit Cards, or Customer Credit (Udharo). The system also supports split payments, allowing a customer to pay part in cash and the remainder via QR code.
- **Discount Handling:** Cashiers can apply a flat cash discount or a percentage discount to specific line items or to the overall invoice.
- **Receipt and Invoice Printing:** The billing terminal supports standard 80mm thermal receipt printers as well as full-page A4 and A5 formats. Invoices include the pharmacy business name, PAN, DDA registration, sequential invoice number, cashier identification, and store policy notes.

---

## 3. Inventory and Stock Management
The inventory module maintains an accurate, real-time record of all pharmaceutical stock held on the premises.

- **Real-Time Stock Levels:** Inventory counts are maintained separately for unopened full packs and loose units. Selling loose units automatically deducts from packs and updates available tablet quantities.
- **Expiry Warning System:** Medicines are tracked by expiration date:
  - **Expired:** Blocked from sale automatically to prevent accidental dispensing.
  - **Expiring within 30 days:** Highlighted for priority clearance or distributor return.
  - **Expiring within 90 days:** Flagged for stock rotation.
  - **Safe stock:** Normal active inventory.
- **Regulatory Compliance Indicators:** Medicines requiring a doctor's prescription are clearly tagged (Rx Required), and controlled substances are flagged to ensure compliance with Department of Drug Administration (DDA) guidelines.
- **Shelf and Rack Location Tracking:** Each medicine record includes its physical storage location (such as Rack A-1, Counter Shelf, or Refrigerator), enabling staff to locate products without delay.
- **Distributor Scheme Bonus Tracking:** Free goods received under promotional schemes (such as 10+1 or 10+2) are recorded in stock without distorting the actual purchase cost per unit.
- **Physical Stock Audit Worksheet:** A digital audit worksheet allows staff to conduct periodic shelf counts, reconcile discrepancies, and record adjustments for damaged, broken, or written-off items with an audit trail.

---

## 4. Customer Credit (Udharo) Ledger
The system includes an automated customer ledger to manage credit sales without relying on manual paper notebooks.

- **Customer Ledger Profiles:** Maintains customer records including full name, contact phone number, address, and an authorized credit limit.
- **Automated Balance Tracking:** Selecting credit payment at the billing counter automatically charges the bill to the customer's ledger account.
- **Payment Collection:** When a customer makes a payment toward their outstanding balance, cashiers can record the settlement (cash or QR code), update the balance instantly, and generate a payment acknowledgement receipt.
- **Account Statements:** Full transaction statements showing historical invoices, payment dates, settlement amounts, and current outstanding debt can be generated and printed for account reconciliation.

---

## 5. Sales Returns and Credit Notes
The return system allows counter staff to process customer returns cleanly and accurately.

- **Invoice-Linked Returns:** Returns can be initiated by referencing the original invoice number, displaying the purchased items, rates, and quantities for verification.
- **Automatic Stock Restoration:** Returned medicines in resalable condition are automatically returned to active inventory under their original batch number.
- **Credit Debt Adjustment:** If returned items were originally purchased on unpaid credit, the system deducts the refund amount from the customer's credit balance rather than issuing physical cash from the counter drawer.
- **Credit Note Generation:** Sequentially numbered credit notes are created with proper adjustment of 13% Value Added Tax (VAT) on taxable items.

---

## 6. Distributor and Purchase Management
This module organizes all supplier relationships, incoming stock shipments, and payment records.

- **Distributor Directory:** Stores distributor names, PAN numbers, sales representative contacts, and credit terms.
- **Purchase Invoice Entry:** Cashiers or pharmacists can enter inward shipments with batch numbers, expiration dates, pack sizes, purchase costs, MRP, and promotional bonus quantities. Once saved, stock levels update immediately.
- **Supplier Returns (Debit Notes):** Defective, damaged, or short-dated stock returned to the distributor can be documented through formal debit notes, automatically reducing the payable balance owed to that distributor.

---

## 7. Outpatient Clinic and Doctor Consultation (OPD)
For facilities with visiting doctors or medical officers, the clinic module bridges the consultation room with the pharmacy dispensing counter.

- **Doctor Roster:** Maintains doctor profiles, medical council registration numbers (NMC), consultation fees, and visiting hours.
- **Patient Registration and Vitals:** Front desk staff can register arriving patients and record basic vital signs, including Blood Pressure, Pulse, Body Temperature, Respiratory Rate, SpO2, and Weight.
- **Digital Prescriptions:** Doctors can document clinical diagnoses, select medicines from the pharmacy catalog, and specify dosage, frequency, and duration.
- **Direct Counter Dispensing:** Saved prescriptions flow directly to the pharmacy billing counter. The cashier can load the complete prescription into the POS cart with a single click, eliminating delays in reading handwritten notes and avoiding manual entry errors.

---

## 8. Financial Reports and Accounting
The reporting suite provides accurate visibility into sales, profitability, and tax liabilities.

- **Daily Sales and Gross Profit:** Displays daily revenue alongside the actual cost of goods sold (COGS) to calculate true gross profit, properly accounting for discounts and restocked returns.
- **Shift Closing and Drawer Reconciliation:** Summarizes all counter collections categorized by tender type (Cash, QR, Card, and Credit) so staff can verify physical cash in the drawer at the end of each business day.
- **VAT Sales Register:** Produces an IRD-compliant register separating 13% taxable sales, exempt sales, and VAT amounts for monthly tax reporting.
- **Inventory Valuation:** Calculates total stock value at purchase cost price and at retail price (MRP).
- **Product Movement Analysis:** Identifies top-selling medicines as well as slow-moving stock to optimize reorder quantities and cash flow.

---

## 9. System Administration and Security
- **Role-Based Permissions:** Access is divided into four distinct roles:
  - **Administrator:** Full access to financial reports, supplier costs, settings, and staff accounts.
  - **Pharmacist:** Access to inventory management, distributor purchases, and counter dispensing.
  - **Cashier:** Restricted to sales billing, customer returns, and credit collection. Confidential purchase costs and store settings are hidden.
  - **Doctor:** Restricted to the clinic OPD queue and prescription creation.
- **Bulk Data Import and Export:** The system includes an Excel template for initial stock loading and bulk catalog updates. Complete inventory lists can also be exported to Excel at any time for offline backup.
- **Store Profile Configuration:** Core pharmacy details are configured centrally, including business name, PAN, DDA license, phone number, address, and receipt footer notes.

---

## 10. Recommended Daily Operating Checklist
To ensure smooth operation, pharmacy staff should follow this standard daily routine:

1. **Morning Opening:**
   - Log in to the billing terminal using individual credentials.
   - Verify that receipt printer paper is loaded and aligned.
   - Review the inventory dashboard for items expiring within the current month.
2. **Daily Billing:**
   - For prescription medicines, confirm and verify the doctor's prescription before finalizing the sale.
   - For credit sales, select the customer's account and verify their balance before extending additional credit.
3. **Inward Shipments:**
   - Enter distributor purchase bills on the same day medicines arrive to maintain accurate inventory counts.
4. **Evening Shift Close:**
   - Generate the Daily Sales Summary from the Reports view.
   - Count the physical cash in the drawer and reconcile it against the reported cash total.
   - Log out of the counter terminal.

---

## 11. Handover and Acceptance Sign-Off
The Prakash Pharmacy Management System has been fully developed, verified, and delivered in accordance with the specified operational requirements.

| Delivered By | Received and Accepted By |
| :--- | :--- |
| **Software Engineering Team** | **Mr. Prakash Dulal** |
| Lead Systems Developer | Proprietor, Prakash Pharmacy |
| Date: November 2026 | Date: November 2026 |
