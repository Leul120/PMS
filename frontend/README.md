# Procurement Management System - Frontend

A modern, professional Next.js frontend for the Procurement Management System built with:

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful UI components built on Radix UI
- **Recharts** - Data visualization library
- **Lucide React** - Beautiful icons

## Features

- **Dashboard** - Overview with spend analysis, charts, recent activity, and pending approvals
- **Vendor Management** - Complete vendor directory with ratings, compliance status, and spend tracking
- **Authentication** - Login page with form validation
- **Responsive Design** - Mobile-first approach with sidebar navigation
- **Dark Mode Support** - Built-in theme switching capability
- **Professional UI** - Modern, clean interface suitable for enterprise use

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Dashboard home
│   ├── vendors/           # Vendor management
│   ├── login/             # Authentication
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # UI components (shadcn)
│   ├── sidebar.tsx        # Navigation sidebar
│   ├── header.tsx         # Top header bar
│   └── dashboard-layout.tsx
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions
└── public/               # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
npm start
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Pages

- `/` - Dashboard with analytics and overview
- `/vendors` - Vendor management
- `/procurement` - Purchase orders
- `/rfq` - RFQ and bidding
- `/orders` - Purchase orders
- `/deliveries` - Delivery tracking
- `/inventory` - Inventory management
- `/analytics` - Reports and analytics
- `/users` - User management
- `/settings` - System settings
- `/login` - Authentication

## API Integration

The frontend is configured to proxy API requests to the backend via Next.js rewrites (configured in `next.config.js`). Update the rewrite rules to match your backend deployment.

## License

MIT
