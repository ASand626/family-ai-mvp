/**
 * Calculates the exact age based on a birthdate string.
 * - For age >= 12, it returns "XX歳".
 * - For 0 < age < 12, it returns "XX歳YYヶ月" (or just "XX歳" if months is 0).
 * - For age < 1 year, it returns "XXヶ月".
 */
export function calculateAge(birthdateStr: string | null | undefined): string {
  if (!birthdateStr) return "";

  const birthdate = new Date(birthdateStr);
  // Check for invalid date
  if (isNaN(birthdate.getTime())) return "";

  const today = new Date();

  let years = today.getFullYear() - birthdate.getFullYear();
  let months = today.getMonth() - birthdate.getMonth();
  let days = today.getDate() - birthdate.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // Future birthdate protection
  if (years < 0) {
    return "生年月が未来です";
  }

  if (years >= 12) {
    return `${years}歳`;
  } else if (years > 0) {
    return months > 0 ? `${years}歳${months}ヶ月` : `${years}歳`;
  } else {
    // If less than 1 month old
    if (months === 0) {
      return "0ヶ月";
    }
    return `${months}ヶ月`;
  }
}
