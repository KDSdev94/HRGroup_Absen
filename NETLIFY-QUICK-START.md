# 🚀 Quick Start - Netlify Deployment

## ⚡ TL;DR - Fast Deploy

### 1️⃣ Set Environment Variables in Netlify

Go to: **Site settings → Environment variables** and add:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

📋 Copy values from your `.env.local` or Firebase Console

### 2️⃣ Firebase Console - Remove API Restrictions

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. **APIs & Services → Credentials**
4. Click your API key
5. Set **Application restrictions** → **None**
6. Set **API restrictions** → **Don't restrict key**
7. Click **Save**

### 3️⃣ Add Netlify Domain to Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. **Authentication → Settings → Authorized domains**
3. Add: `your-app-name.netlify.app`
4. Click **Add domain**

### 4️⃣ Deploy

Push to your repo or click "Trigger deploy" in Netlify

---

## 🐛 Error Fixing

### "Firebase services are not initialized"

✅ **Fix**: Environment variables missing in Netlify

1. Check all `VITE_*` variables are set
2. No typos in variable names
3. Clear cache and redeploy

### "API key not valid"

✅ **Fix**: API key restricted

1. Remove restrictions (see step 2 above)
2. Or generate new unrestricted key
3. Update `VITE_FIREBASE_API_KEY` in Netlify

### "Domain not authorized"

✅ **Fix**: Netlify domain not whitelisted

1. Add domain to Firebase (see step 3 above)
2. Wait 2-3 minutes
3. Clear browser cache

---

## 📚 Full Documentation

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for comprehensive guide

## 🔍 Verify Local Setup

```bash
./verify-env.sh
```

---

## 📞 Quick Links

- [Firebase Console](https://console.firebase.google.com/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Netlify Dashboard](https://app.netlify.com/)
