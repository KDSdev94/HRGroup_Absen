# Deployment Guide - Netlify

## 🚀 Deploying to Netlify

### Prerequisites

1. A Netlify account (https://netlify.com)
2. Firebase project credentials
3. Your repository connected to Netlify

---

## 📋 Step-by-Step Deployment

### 1. Connect Your Repository

1. Log in to Netlify
2. Click "Add new site" → "Import an existing project"
3. Choose your Git provider (GitHub, GitLab, etc.)
4. Select this repository

### 2. Configure Build Settings

Netlify should automatically detect the `netlify.toml` file, but verify:

- **Build command**: `npm install && npm run build`
- **Publish directory**: `dist/public`
- **Node version**: 20

### 3. Set Environment Variables ⚙️

**This is the most critical step!**

Go to: **Site settings → Environment variables**

Add the following variables with your Firebase credentials:

```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project_id.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

**⚠️ IMPORTANT**:

- All variables MUST start with `VITE_` prefix (Vite requirement)
- Copy the exact values from your Firebase Console
- Don't add quotes around the values

### 4. Get Firebase Credentials

#### Option A: From Firebase Console (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click ⚙️ (Settings) → Project Settings
4. Scroll down to "Your apps" section
5. Click on your web app (or create one if you don't have it)
6. Find "SDK setup and configuration"
7. Select "Config" (not npm)
8. Copy all the values from the `firebaseConfig` object

#### Option B: From Local .env.local File

If you already have a working local setup:

```bash
cat .env.local
```

Copy all values to Netlify (remember to add `VITE_` prefix if missing)

### 5. Firebase Console Setup

#### Remove API Key Restrictions (if error persists)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services → Credentials**
4. Click on your API key (usually named "Browser key")
5. Under "Application restrictions":
   - Select **None** (or configure properly)
6. Under "API restrictions":
   - Select **Don't restrict key** (or add Firebase services)
7. Click **Save**

#### Add Authorized Domains

1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Add your Netlify domain:
   - `your-app-name.netlify.app`
   - Any custom domains you're using

### 6. Deploy! 🎉

1. Click "Deploy site"
2. Wait for build to complete
3. Check deployment logs for any errors
4. Visit your site URL

---

## 🔍 Troubleshooting

### Error: "Firebase services are not initialized"

**Cause**: Environment variables not set correctly in Netlify

**Solution**:

1. Go to Site settings → Environment variables
2. Verify ALL variables are present with `VITE_` prefix
3. Check for typos in variable names
4. Make sure values don't have extra spaces or quotes
5. Redeploy: Deploys → Trigger deploy → Clear cache and deploy site

### Error: "API key not valid"

**Cause**: API key restricted or incorrect

**Solution**:

1. Check if API key is correct in Netlify environment variables
2. Remove restrictions from Firebase/Google Cloud Console (see step 5 above)
3. Generate a new API key if needed
4. Update `VITE_FIREBASE_API_KEY` in Netlify
5. Redeploy

### Error: "Domain not authorized"

**Cause**: Netlify domain not whitelisted in Firebase

**Solution**:

1. Go to Firebase Console → Authentication → Settings
2. Add your Netlify domain to authorized domains
3. Wait a few minutes for changes to propagate
4. Clear browser cache and retry

### Build Fails

**Check**:

1. Build logs in Netlify dashboard
2. Make sure Node version is 20 (set in build settings)
3. Verify `package.json` and `package-lock.json` are committed
4. Try local build: `npm install && npm run build`

### App Loads But Can't Login

**Check**:

1. Browser console (F12) for detailed errors
2. Firebase Authentication is enabled in Firebase Console
3. Email/Password provider is enabled (if using email auth)
4. Network tab shows successful Firebase API calls

---

## 📝 Environment Variables Reference

| Variable                            | Description             | Example                        |
| ----------------------------------- | ----------------------- | ------------------------------ |
| `VITE_FIREBASE_API_KEY`             | Firebase Web API Key    | `AIzaSyC...`                   |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Auth domain             | `myapp.firebaseapp.com`        |
| `VITE_FIREBASE_DATABASE_URL`        | Realtime Database URL   | `https://myapp.firebaseio.com` |
| `VITE_FIREBASE_PROJECT_ID`          | Project identifier      | `myapp-12345`                  |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Storage bucket          | `myapp.appspot.com`            |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging ID      | `123456789012`                 |
| `VITE_FIREBASE_APP_ID`              | Firebase App ID         | `1:123456789012:web:abc123`    |
| `VITE_FIREBASE_MEASUREMENT_ID`      | Analytics ID (optional) | `G-XXXXXXXXXX`                 |

---

## 🔄 Redeploying After Changes

### Option 1: Git Push (Automatic)

```bash
git add .
git commit -m "Update configuration"
git push
```

Netlify will automatically rebuild.

### Option 2: Manual Trigger

1. Go to Netlify dashboard
2. Deploys tab
3. Click "Trigger deploy"
4. Select "Clear cache and deploy site" if you updated environment variables

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Site loads without errors
- [ ] No "Firebase Configuration Error" message
- [ ] Can open browser console (F12) without Firebase errors
- [ ] All environment variables set in Netlify
- [ ] Firebase API key has no restrictions (or correct restrictions)
- [ ] Netlify domain added to Firebase authorized domains
- [ ] Authentication works (if applicable)
- [ ] Database operations work (if applicable)

---

## 🆘 Still Having Issues?

1. **Check browser console (F12)**:

   - Look for specific error messages
   - Check Network tab for failed requests

2. **Check Netlify deploy logs**:

   - Look for build errors
   - Verify environment variables are loaded

3. **Test locally first**:

   ```bash
   npm install
   npm run build
   cd dist/public
   npx serve
   ```

   This simulates production build locally.

4. **Clear everything and retry**:
   - Clear Netlify build cache
   - Clear browser cache (Ctrl+Shift+Delete)
   - Redeploy

---

## 📧 Support

If issues persist, check:

- [Firebase Documentation](https://firebase.google.com/docs)
- [Netlify Documentation](https://docs.netlify.com)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
