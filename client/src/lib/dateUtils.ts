/**
 * Utility functions for date formatting with WIB (GMT+7) timezone
 */

/**
 * Format timestamp to WIB timezone
 * @param timestamp - Firebase timestamp or Date object
 * @param format - Format type: 'full' | 'date' | 'time' | 'datetime'
 * @returns Formatted date string in WIB timezone
 */
export function formatToWIB(
  timestamp: any,
  format: "full" | "date" | "time" | "datetime" | "short" = "datetime"
): string {
  if (!timestamp) return "-";

  let date: Date;

  // Handle Firebase Timestamp
  if (timestamp?.seconds) {
    date = new Date(timestamp.seconds * 1000);
  }
  // Handle Firestore serverTimestamp that might be null
  else if (timestamp === null) {
    return "-";
  }
  // Handle Date object
  else if (timestamp instanceof Date) {
    date = timestamp;
  }
  // Handle milliseconds timestamp
  else if (typeof timestamp === "number") {
    date = new Date(timestamp);
  }
  // Handle string date
  else if (typeof timestamp === "string") {
    date = new Date(timestamp);
  }
  // Default fallback
  else {
    console.warn("Unknown timestamp format:", timestamp);
    return "-";
  }

  // Validate date
  if (isNaN(date.getTime())) {
    console.error("Invalid date created from timestamp:", timestamp);
    return "Invalid Date";
  }

  // Format based on type with WIB timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Jakarta", // WIB timezone
  };

  switch (format) {
    case "full":
      return (
        date.toLocaleString("id-ID", {
          ...options,
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " WIB"
      );

    case "date":
      return date.toLocaleDateString("id-ID", {
        ...options,
        year: "numeric",
        month: "long",
        day: "numeric",
      });

    case "time":
      return (
        date.toLocaleTimeString("id-ID", {
          ...options,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " WIB"
      );

    case "short":
      return date.toLocaleDateString("id-ID", {
        ...options,
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    case "datetime":
    default:
      return (
        date.toLocaleString("id-ID", {
          ...options,
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB"
      );
  }
}

/**
 * Get current date in WIB timezone
 */
export function getCurrentDateWIB(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );
}

/**
 * Format date for display in tables
 */
export function formatDateTable(timestamp: any): string {
  return formatToWIB(timestamp, "datetime");
}

/**
 * Format date for statistics/dashboard
 */
export function formatDateStats(timestamp: any): string {
  return formatToWIB(timestamp, "short");
}

/**
 * Check if date is valid
 */
export function isValidDate(date: any): boolean {
  if (!date) return false;

  let d: Date;
  if (date?.seconds) {
    d = new Date(date.seconds * 1000);
  } else if (date instanceof Date) {
    d = date;
  } else {
    d = new Date(date);
  }

  return !isNaN(d.getTime());
}
