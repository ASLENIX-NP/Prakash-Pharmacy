# Prakash Pharmacy — Management & Clinic POS System

A production-ready retail pharmacy management, Point of Sale (POS), and Outpatient Department (OPD) clinic system designed for community healthcare operations. Features full Nepalese statutory VAT compliance, batch-wise inventory tracking, physical stock reconciliation, wholesaler purchase ledgers, and role-based staff access control.

---

## Key Modules & Features

### 1. Point of Sale & Billing (POS)
- **Fast Search**: Instant lookup by medicine brand name, generic molecule/salt, batch number, or barcode.
- **Pack & Loose Dispensing**: Dispenses full packs as well as loose tablets/units with automated stock deduction and pricing conversions.
- **Statutory Billing**: Automatic computation of 13% VAT items versus VAT-free / exempt items, item discounts, and bill-level discounts.
- **Sales Returns & Credit Notes**: Customer return processing with reason tracking, refund calculation, and inventory restocking.

### 2. Inventory & Stock Auditing
- **Batch & Expiry Tracking**: Tracks medicines per batch with near-expiry color tags and reorder alert thresholds.
- **Physical Count Reconciliation**: Shelf and rack-wise audit worksheet with instant single-item save and batch variance recording.
- **Audit Trails**: Full historical logging of stock reconciliations, damage write-offs, and shrinkage records.
- **Spreadsheet Integration**: Fast, secure Excel (`.xlsx`) and `.csv` import/export for stock valuation and medicine master catalogs.

### 3. Wholesaler & Purchase Ledger
- **Inward Purchase Bills**: Records supplier invoices with batch details, cost prices, selling MRPs, free bonus packs, and VAT.
- **Supplier Credit Limits**: Real-time alerts when distributor credit balances approach or exceed credit limits.
- **Ledger Book**: Running debit/credit balance tracking for each wholesaler, including supplier return debit notes.

### 4. OPD & Clinic Operations
- **Patient Registration**: Patient records supporting age in Years, Months, or Days (tailored for newborns and pediatric visits).
- **OPD Visit Management**: Doctor consultation queue, status tracking (Open, Completed, Cancelled), and additional service charges.
- **Thermal Sticker Printing**: Direct browser printing for standard 50×70mm OPD thermal ticket stickers.
- **Doctor Revenue Access Control**: Restricted aggregated doctor revenue metrics exclusively to Administrator accounts.

### 5. Security & System Administration
- **Role-Based Access Control**: Differentiates Admin and Staff roles with route-level security.
- **Hardened Authentication**: 8+ character password policy (letters and numbers/symbols), constant-time OTP verification, and JWT session handling.
- **Rate Limiting**: Built-in API rate limiting on general endpoints, login, and database backup downloads.
- **Data Backup**: One-click full JSON database export from the settings panel for disaster recovery.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Vite, Lucide Icons, `read-excel-file`, `write-excel-file` |
| **Backend** | Node.js, Express 5, TypeScript, Prisma ORM, PostgreSQL (`@prisma/adapter-pg`), Helmet, JWT, `express-rate-limit` |
| **Workspace** | NPM Workspaces (`frontend`, `backend`) |

---

## Project Structure

```text
Prakash-Pharmacy/
├── frontend/                     # React + Vite frontend application
│   ├── src/
│   │   ├── components/           # Views (POS, Inventory, OPD, Wholesalers, Reports)
│   │   ├── context/              # Pharmacy & Dialog state providers
│   │   ├── utils/                # Date, validation, OPD sticker, Excel helpers
│   │   └── types/                # TypeScript interfaces & types
│   ├── vite.config.ts            # Vite config with backend API proxy
│   └── package.json
├── backend/                      # Express API server & database layer
│   ├── prisma/
│   │   ├── schema.prisma         # PostgreSQL database schema
│   │   └── seed.ts               # Initial administrator seed script
│   ├── src/
│   │   ├── controllers/          # Business logic (Bills, Inventory, Clinic, Auth, Staff)
│   │   ├── routes/               # Express route declarations
│   │   ├── middleware/           # JWT auth and role validation middleware
│   │   └── db.ts                 # Prisma Client database connection
│   └── package.json
└── package.json                  # Root workspace scripts
```

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14 or higher
- **NPM**: v9 or higher

---

### 1. Installation

Clone the repository and install dependencies from the root directory:

```bash
git clone https://github.com/ASLENIX-NP/Prakash-Pharmacy.git
cd Prakash-Pharmacy
npm install
```

---

### 2. Database & Environment Configuration

Create a `.env` file inside the `backend/` directory based on `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your PostgreSQL credentials:

```ini
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/prakash_pharmacy?schema=public"
JWT_SECRET="replace-with-a-secure-random-secret-key"
```

Push the database schema and generate the Prisma client:

```bash
cd backend
npx prisma db push
npm run prisma:generate
cd ..
```

---

### 3. Create the Initial Administrator Account

Run the database seed script to register the first Admin account:

```bash
cd backend
SEED_ADMIN_USERNAME=admin \
SEED_ADMIN_PASSWORD=YourSecurePassword123 \
SEED_ADMIN_FIRST_NAME=Admin \
SEED_ADMIN_LAST_NAME=User \
npm run seed
cd ..
```

---

### 4. Running Locally

Run both the frontend and backend development servers concurrently:

```bash
# Terminal 1 - Start Backend API (Port 4000)
npm run dev:backend

# Terminal 2 - Start Frontend UI (Port 3000)
npm run dev:frontend
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The Vite development server automatically proxies all `/api` requests to `http://localhost:4000`.

---

## Build & Quality Checks

Run TypeScript typechecks and production builds across both workspaces:

```bash
# Typecheck both frontend and backend
npm run typecheck

# Build both applications for production
npm run build
```

---

## License

Private and proprietary. Designed and maintained for Prakash Pharmacy, Hetauda-5, Sanopokhara, Makwanpur, Nepal.
