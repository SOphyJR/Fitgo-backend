<div align="center">

```
███████╗██╗████████╗ ██████╗  ██████╗     █████╗ ██████╗ ██╗
██╔════╝██║╚══██╔══╝██╔════╝ ██╔═══██╗   ██╔══██╗██╔══██╗██║
█████╗  ██║   ██║   ██║  ███╗██║   ██║   ███████║██████╔╝██║
██╔══╝  ██║   ██║   ██║   ██║██║   ██║   ██╔══██║██╔═══╝ ██║
██║     ██║   ██║   ╚██████╔╝╚██████╔╝   ██║  ██║██║     ██║
╚═╝     ╚═╝   ╚═╝    ╚═════╝  ╚═════╝    ╚═╝  ╚═╝╚═╝     ╚═╝
```

### **FitGo Delivery — Backend API**
*REST API powering the FitGo on-demand clothing & footwear delivery platform*

<br />

![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

<br />

> 🎓 *University project — Software Engineering, Addis Ababa · Built for real startup deployment*

</div>

---

## 📌 Overview

This is the backend REST API for **FitGo Delivery** — an on-demand clothing and footwear delivery platform based in Addis Ababa, Ethiopia.

The API handles all business logic including users, stores, products, orders and deliveries. Authentication is handled via **Firebase Auth** with tokens verified server-side. Data is stored in **PostgreSQL**.

---

## 🏗️ Architecture

```
fitgo-backend/
├── src/
│   ├── config/
│   │   └── db.js              # PostgreSQL connection pool
│   ├── middleware/
│   │   └── auth.js            # Firebase token verification
│   ├── routes/
│   │   ├── users.js           # User management
│   │   ├── stores.js          # Store management
│   │   ├── products.js        # Product catalog
│   │   └── orders.js          # Order processing
│   └── index.js               # Express app entry point
├── .env                       # Environment variables (not committed)
├── .gitignore
├── package.json
└── README.md
```

---

## 🗄️ Database Schema

```sql
users         — Firebase UID, name, email, phone, role, status
stores        — owner, name, description, location, logo, status
products      — store, name, description, price, category, image
orders        — customer, store, status, total, address, payment
order_items   — order, product, quantity, size, price
deliveries    — order, driver, status, pickup/delivery time
```

---

## 🚀 API Endpoints

### Users
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | Get all users |
| GET | `/api/users/:firebase_uid` | Get user by Firebase UID |
| POST | `/api/users` | Create/update user |
| PATCH | `/api/users/:id/status` | Approve seller or driver |

### Stores
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/stores` | Get all approved stores |
| GET | `/api/stores/:id` | Get store with products |
| POST | `/api/stores` | Create store |
| PATCH | `/api/stores/:id/approve` | Approve store |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | Get all products (filter by category/search) |
| GET | `/api/products/:id` | Get product by ID |
| POST | `/api/products` | Add product |
| PATCH | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

### Orders
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/orders/customer/:id` | Get orders by customer |
| GET | `/api/orders/store/:id` | Get orders by store |
| GET | `/api/orders/:id` | Get order with items |
| POST | `/api/orders` | Place new order |
| PATCH | `/api/orders/:id/status` | Update order status |

---

## ⚙️ Getting Started

### Prerequisites
- Node.js `v18+`
- PostgreSQL `v17`
- Firebase project with Auth enabled

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/SOphyJR/Fitgo-backend.git

# 2. Move into the project
cd Fitgo-backend

# 3. Install dependencies
npm install

# 4. Create .env file
cp .env.example .env
# Fill in your values

# 5. Set up the database
# Run the SQL schema in pgAdmin or psql

# 6. Start development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fitgo_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
```

### Test the API

```bash
# Health check
curl http://localhost:3000

# Get all products
curl http://localhost:3000/api/products

# Get products by category
curl http://localhost:3000/api/products?category=Shoes

# Search products
curl http://localhost:3000/api/products?search=jordan
```

---

## 🔐 Security

- Firebase Auth tokens verified on protected routes
- Passwords hashed via Firebase (never stored in our DB)
- PostgreSQL parameterized queries (no SQL injection)
- CORS configured for allowed origins
- Environment variables for all secrets

---

## 🗺️ Roadmap

- [x] User management API
- [x] Store management API
- [x] Product catalog API
- [x] Order processing API
- [ ] Firebase token middleware on all routes
- [ ] Real-time order tracking with WebSockets
- [ ] Payment integration (Telebirr, CBE Birr)
- [ ] Push notifications
- [ ] Admin dashboard API
- [ ] Deploy to cloud (Railway / Render)

---

## 👥 Team

Built by **Sophonyas Bewuketu** and the FitGo team
Software Engineering · Addis Ababa, Ethiopia · 2025

---

## 📄 Related Repositories

| Repo | Description |
|---|---|
| [fitgo-app](https://github.com/SOphyJR/fitgo-app) | React Native mobile app |
| [FitGo-Delivery](https://github.com/SOphyJR/FitGo-Delivery) | Marketing website |

---

<div align="center">
  <strong>FitGo</strong> — Style. Delivered. Instantly. 🔴
</div>