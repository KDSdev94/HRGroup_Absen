#!/bin/bash
# Script to verify Firebase environment variables are set correctly

echo "🔍 Checking Firebase Environment Variables..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Required environment variables
REQUIRED_VARS=(
  "VITE_FIREBASE_API_KEY"
  "VITE_FIREBASE_AUTH_DOMAIN"
  "VITE_FIREBASE_PROJECT_ID"
  "VITE_FIREBASE_STORAGE_BUCKET"
  "VITE_FIREBASE_MESSAGING_SENDER_ID"
  "VITE_FIREBASE_APP_ID"
)

# Optional environment variables
OPTIONAL_VARS=(
  "VITE_FIREBASE_DATABASE_URL"
  "VITE_FIREBASE_MEASUREMENT_ID"
)

missing_count=0
present_count=0

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
  echo -e "${RED}❌ .env.local file not found!${NC}"
  echo ""
  echo "Please create .env.local from .env.example:"
  echo "  cp .env.example .env.local"
  echo ""
  echo "Then fill in your Firebase credentials."
  exit 1
fi

echo "✅ .env.local file exists"
echo ""

# Load .env.local
set -a
source .env.local
set +a

echo "Required Variables:"
echo "-------------------"

# Check required variables
for var in "${REQUIRED_VARS[@]}"; do
  value="${!var}"
  
  if [ -z "$value" ] || [ "$value" = "your_api_key_here" ] || [ "$value" = "your_project_id" ] || [[ "$value" == your_* ]]; then
    echo -e "${RED}❌ $var is missing or not set${NC}"
    ((missing_count++))
  else
    # Mask the actual value for security (show first 10 chars)
    masked_value="${value:0:10}..."
    echo -e "${GREEN}✅ $var${NC} = $masked_value"
    ((present_count++))
  fi
done

echo ""
echo "Optional Variables:"
echo "-------------------"

# Check optional variables
for var in "${OPTIONAL_VARS[@]}"; do
  value="${!var}"
  
  if [ -z "$value" ] || [[ "$value" == your_* ]]; then
    echo -e "${YELLOW}⚠️  $var is not set (optional)${NC}"
  else
    masked_value="${value:0:10}..."
    echo -e "${GREEN}✅ $var${NC} = $masked_value"
    ((present_count++))
  fi
done

echo ""
echo "Summary:"
echo "--------"
echo "✅ Variables configured: $present_count"
echo "❌ Variables missing: $missing_count"
echo ""

if [ $missing_count -gt 0 ]; then
  echo -e "${RED}⚠️  Some required variables are missing!${NC}"
  echo ""
  echo "Please update .env.local with your Firebase credentials."
  echo "See DEPLOYMENT.md for instructions on getting these values."
  exit 1
else
  echo -e "${GREEN}🎉 All required environment variables are configured!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Run: npm install"
  echo "2. Run: npm run dev:client (for development)"
  echo "3. Or: npm run build (for production build)"
  echo ""
  echo "For Netlify deployment, see DEPLOYMENT.md"
  exit 0
fi
