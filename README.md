# Point of Sale (POS) System — Student Project

Web-based POS using **Option 2**: HTML/CSS/JavaScript (frontend), Node.js (backend), MySQL (database).

---

## Design

- **Base color:** Black (`#000000` / soft black `#121212`)
- **Accent:** Gold (`#D4AF37` / `#C9A227`)
- **Background / text:** White / Off-white (`#F5F5F5` / `#EAEAEA`)
- **Secondary:** Charcoal Gray (`#2B2B2B`)
- **UI style:** Glassmorphism applied across the interface

---

## Architecture (Three-Tier)

| Layer | Responsibility |
|-------|----------------|
| **Presentation** | Cashier screen, Admin dashboard, Product search, Checkout page |
| **Application** | Sales processing, Inventory control, Payment handling, Report generation |
| **Data** | Products, Sales transactions, Customers, Inventory (MySQL) |

---

## Modules

1. **Authentication** — Login, Logout, Password encryption, Role-based access (Admin, Manager, Cashier)
2. **Product Management** — Add/Update/Delete/Search products (ID, name, category, price, quantity, barcode)
3. **Inventory Management** — Update stock after sale, Low stock alert, Stock adjustment, Restocking
4. **Sales Processing** — Scan barcode, Add to cart, Totals, Discounts, Confirm payment, Save transaction
5. **Payment Processing** — Cash, Mobile money, Credit/debit card; change calculation, payment records
6. **Customer Management** — Register customers, Purchase history, Loyalty points
7. **Receipt Generation** — Store name, Transaction ID, Date/time, Items, Total, Payment method
8. **Reporting & Analytics** — Daily/weekly sales, Product performance, Inventory, Cashier sales reports

---

## Database (MySQL)

Main tables: **Users**, **Products**, **Customers**, **Sales**, **Sales_Items**, **Inventory**, **Payments**.

Schema file: `backend/database/schema.sql`

---

## How to Run

### Prerequisites

- Node.js
- MySQL

### 1. Database

```bash
# In MySQL (or MySQL Workbench):
CREATE DATABASE pos_db;
# Then run: backend/database/schema.sql
# Then run: backend/database/seed.sql  (optional: sample categories)
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set DB_PASSWORD, DB_NAME, and JWT_SECRET
npm start
# Create admin user (first time): node scripts/seed-admin.js
# Login: username = admin, password = admin123
```

### 3. Frontend

Open `http://localhost:3000` in the browser (backend serves the frontend from `frontend/`).

---

## Security

- Password hashing (e.g. bcrypt)
- Role-based access control
- Transaction logs
- Database backup (see Backup & Data Recovery)

---

## Optional

- Hardware: barcode scanner, receipt printer, cash drawer, card reader
- Backup and data recovery, data export
