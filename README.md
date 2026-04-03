# Trust Global Bank (TGB)

A secure, encrypted banking application for Pi Network pioneers and global users.

## Features

- **Pi Network Integration:** Connect using your Pi Wallet (via Pi SDK).
- **Global Access:** Secure login for non-pioneers using Google Authentication.
- **Real-time Balances:** Live synchronization of Pi, USD, and DZD balances via Firebase Firestore.
- **Market Insights:** Live exchange rates (USD/DZD) and fixed GCV Pi rates.
- **Secure Infrastructure:** Powered by Firebase Auth and Firestore with strict security rules.

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, Motion.
- **Backend:** Node.js, Express (for API & Exchange Rates).
- **Database/Auth:** Firebase (Firestore & Authentication).

## Getting Started

1. **Firebase Setup:** The app is configured with a dedicated Firebase project.
2. **Pi Browser:** For the best experience as a Pioneer, open this app inside the Pi Browser.
3. **Global Users:** Use the "Global User Login" to sign in with your Google account.

## Security

All financial data is protected by Firebase Security Rules, ensuring that users can only access their own wallets and transaction history.

## Exporting the Project
To download this entire project as a ZIP file:
1. Click on the **Settings** (gear icon) in the AI Studio menu.
2. Select **Export to ZIP**.
3. Save the file to your device.
