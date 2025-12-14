/**
 * 📍 GPS & Geocoding Utilities
 * Helper functions untuk mendapatkan lokasi akurat dan reverse geocoding
 *
 * Diadaptasi dari EXPO Ecommerce untuk HRGroupAttendQR
 */

export interface AddressInfo {
  fullAddress: string;
  street: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  obtained: boolean;
  address: string | null;
  street: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}

/**
 * Mendapatkan alamat lengkap dari koordinat menggunakan OpenStreetMap Nominatim API
 * GRATIS, rate limit: 1 request/second
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns AddressInfo object atau null jika gagal
 */
export const getAddressFromCoordinates = async (
  lat: number,
  lon: number
): Promise<AddressInfo | null> => {
  try {
    console.log("🌍 Fetching address from coordinates:", { lat, lon });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "HRGroupAttendQR/1.0",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.error) {
      throw new Error(data?.error || "No address found");
    }

    const address = data.address || {};

    const addressInfo: AddressInfo = {
      fullAddress: data.display_name || "",
      street:
        address.road ||
        address.street ||
        address.pedestrian ||
        address.footway ||
        "",
      district:
        address.suburb ||
        address.neighbourhood ||
        address.quarter ||
        address.city_district ||
        "",
      city:
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        "",
      province: address.state || address.province || "",
      postalCode: address.postcode || "",
    };

    console.log("✅ Address obtained:", addressInfo);
    return addressInfo;
  } catch (error) {
    console.error("❌ Reverse geocoding error:", error);
    return null;
  }
};

/**
 * Mendapatkan alamat menggunakan Google Maps Geocoding API
 * BERBAYAR, lebih akurat dari OpenStreetMap
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @param apiKey - Google Maps API Key
 * @returns AddressInfo object atau null jika gagal
 */
export const getAddressFromCoordinatesGoogle = async (
  lat: number,
  lon: number,
  apiKey: string
): Promise<AddressInfo | null> => {
  try {
    console.log("🗺️ Fetching address from Google Maps:", { lat, lon });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}&language=id`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      throw new Error(data.error_message || "No address found");
    }

    const result = data.results[0];
    const addressComponents = result.address_components;

    const getComponent = (type: string): string => {
      const component = addressComponents.find((c: any) =>
        c.types.includes(type)
      );
      return component?.long_name || "";
    };

    const addressInfo: AddressInfo = {
      fullAddress: result.formatted_address || "",
      street: getComponent("route"),
      district:
        getComponent("sublocality") ||
        getComponent("sublocality_level_1") ||
        getComponent("administrative_area_level_3"),
      city:
        getComponent("administrative_area_level_2") || getComponent("locality"),
      province: getComponent("administrative_area_level_1"),
      postalCode: getComponent("postal_code"),
    };

    console.log("✅ Google address obtained:", addressInfo);
    return addressInfo;
  } catch (error) {
    console.error("❌ Google geocoding error:", error);
    return null;
  }
};

/**
 * Mendapatkan lokasi GPS dengan akurasi tinggi
 *
 * @param options - Geolocation options
 * @returns Promise<GeolocationPosition>
 */
export const getHighAccuracyLocation = (
  options?: PositionOptions
): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    const defaultOptions: PositionOptions = {
      enableHighAccuracy: true, // Use GPS for high accuracy
      timeout: 15000, // 15 second timeout
      maximumAge: 0, // No cache, always fresh
    };

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      ...defaultOptions,
      ...options,
    });
  });
};

/**
 * Mendapatkan lokasi lengkap dengan alamat (High Accuracy + Reverse Geocoding)
 *
 * @param useGoogle - Gunakan Google Maps API (default: false, gunakan OpenStreetMap)
 * @param googleApiKey - Google Maps API Key (required jika useGoogle = true)
 * @returns LocationData object
 */
export const getCompleteLocation = async (
  useGoogle: boolean = false,
  googleApiKey?: string
): Promise<LocationData> => {
  // Default location (Jakarta)
  const defaultLocation: LocationData = {
    latitude: -6.2,
    longitude: 106.816666,
    accuracy: null,
    obtained: false,
    address: null,
    street: null,
    district: null,
    city: null,
    province: null,
    postalCode: null,
  };

  try {
    console.log("📍 Getting high accuracy location...");

    // Get GPS coordinates
    const position = await getHighAccuracyLocation();

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    console.log("✅ GPS location obtained:", {
      latitude,
      longitude,
      accuracy: `${accuracy}m`,
    });

    // Get address from coordinates
    let addressInfo: AddressInfo | null = null;

    if (useGoogle && googleApiKey) {
      addressInfo = await getAddressFromCoordinatesGoogle(
        latitude,
        longitude,
        googleApiKey
      );
    } else {
      addressInfo = await getAddressFromCoordinates(latitude, longitude);
    }

    return {
      latitude,
      longitude,
      accuracy,
      obtained: true,
      address: addressInfo?.fullAddress || null,
      street: addressInfo?.street || null,
      district: addressInfo?.district || null,
      city: addressInfo?.city || null,
      province: addressInfo?.province || null,
      postalCode: addressInfo?.postalCode || null,
    };
  } catch (error: any) {
    console.error("❌ Error getting complete location:", error);

    // Return default location on error
    return defaultLocation;
  }
};

/**
 * Format lokasi untuk ditampilkan ke user
 *
 * @param location - LocationData object
 * @returns Formatted string
 */
export const formatLocationDisplay = (location: LocationData): string => {
  if (!location.obtained) {
    return "📍 Lokasi Default (GPS tidak tersedia)";
  }

  if (location.address) {
    return `📍 ${location.address}`;
  }

  if (location.city || location.district) {
    const parts = [location.street, location.district, location.city].filter(
      Boolean
    );
    return `📍 ${parts.join(", ")}`;
  }

  return `📍 Lat: ${location.latitude.toFixed(
    6
  )}, Lon: ${location.longitude.toFixed(6)}`;
};

/**
 * Cek apakah lokasi dalam radius tertentu dari koordinat target
 *
 * @param lat1 - Latitude lokasi 1
 * @param lon1 - Longitude lokasi 1
 * @param lat2 - Latitude lokasi 2
 * @param lon2 - Longitude lokasi 2
 * @returns Jarak dalam meter
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Cek apakah user berada dalam radius kantor
 *
 * @param userLat - Latitude user
 * @param userLon - Longitude user
 * @param officeLat - Latitude kantor
 * @param officeLon - Longitude kantor
 * @param radiusMeters - Radius dalam meter (default: 100m)
 * @returns true jika dalam radius
 */
export const isWithinOfficeRadius = (
  userLat: number,
  userLon: number,
  officeLat: number,
  officeLon: number,
  radiusMeters: number = 100
): boolean => {
  const distance = calculateDistance(userLat, userLon, officeLat, officeLon);
  console.log(`📏 Distance from office: ${distance.toFixed(2)}m`);
  return distance <= radiusMeters;
};
