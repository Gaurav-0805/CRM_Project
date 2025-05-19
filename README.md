# CRM Project

A full-stack *Customer Relationship Management (CRM)* application built with *Angular* for the frontend, *Node.js (Express)* for the backend, and *PostgreSQL* as the database.

> Designed to help businesses manage customers, tickets, invoices, payments, BRDs, and reports in a streamlined interface.

---

## 🚀 Features

### 🔹 Admin Dashboard
- Manage customers, developers, and support teams
- View and filter lifecycle stages, payment dues, and new business reports
- Date range filtering and global search across modules

### 🔹 Customer Portal
- Company-specific access to BRDs, Invoices, Tickets, and Payments
- View assigned developers and activity logs
- Secure authentication with JWT

### 🔹 Ticket Management
- Raise, assign, and escalate tickets with rich-text descriptions and embedded screenshots
- Ticket timeline, developer escalation, and status tracking

### 🔹 Invoice & Payment Handling
- Invoice listing with due date tracking
- Payments linked to invoices and payment summary card view

### 🔹 BRD (Business Requirements Document) Workflow
- Create BRDs with rich text and embedded files
- Assign to developers, upload versions, and track task progress

---

## 🧱 Tech Stack

| Layer         | Technology                     |
|--------------|---------------------------------|
| Frontend      | Angular (with Angular Material + AG Grid) |
| Backend       | Node.js with Express.js        |
| Database      | PostgreSQL                     |
| Auth          | JSON Web Tokens (JWT)          |
| UI Components | Angular Material, AG Grid      |
| File Uploads  | Multer                         |

---

## 🛠 Setup Instructions

### 🧩 Prerequisites
- Node.js v18+
- Angular CLI
- PostgreSQL installed and running


```bash
cd CRM_backend
npm install
# Configure .env with DB and JWT_SECRET
npm start

### 🔧 Frontend Setup
cd crm-frontend
npm install
ng serve
