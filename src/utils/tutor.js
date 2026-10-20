export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function formatTelefone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length < 3) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  const prefixLength = digits.length === 11 ? 5 : 4;
  if (number.length <= prefixLength) return `(${ddd}) ${number}`;
  return `(${ddd}) ${number.slice(0, prefixLength)}-${number.slice(prefixLength)}`;
}

export function formatCpfCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11) {
    let result = digits.slice(0, 3);
    if (digits.length > 3) result += `.${digits.slice(3, 6)}`;
    if (digits.length > 6) result += `.${digits.slice(6, 9)}`;
    if (digits.length > 9) result += `-${digits.slice(9)}`;
    return result;
  }
  let result = digits.slice(0, 2);
  if (digits.length > 2) result += `.${digits.slice(2, 5)}`;
  if (digits.length > 5) result += `.${digits.slice(5, 8)}`;
  if (digits.length > 8) result += `/${digits.slice(8, 12)}`;
  if (digits.length > 12) result += `-${digits.slice(12)}`;
  return result;
}

export function maskCpfCnpj(value) {
  const digits = onlyDigits(value);
  if (!digits) return '';
  return digits.length > 11 ? '**.***.***/****-**' : '***.***.***-**';
}

export function formatCep(value) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}

export function isTelefoneValido(value) {
  const digits = onlyDigits(value);
  return /^[1-9]\d{9,10}$/.test(digits) && !/^(\d)\1+$/.test(digits);
}

export function isEmailValido(value) {
  const email = String(value).trim();
  const [local] = email.split('@');
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return false;
  }
  return /^[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)+$/i.test(
    email,
  );
}

export function isCpfCnpjValido(value) {
  const digits = onlyDigits(value);
  if (!/^(\d{11}|\d{14})$/.test(digits) || /^(\d)\1+$/.test(digits))
    return false;
  const numbers = Array.from(digits, Number);
  const checkDigit = (base, weights) => {
    const sum = base.reduce(
      (total, digit, index) => total + digit * weights[index],
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  if (digits.length === 11) {
    const first = checkDigit(numbers.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = checkDigit(
      numbers.slice(0, 10),
      [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
    );
    return first === numbers[9] && second === numbers[10];
  }
  const first = checkDigit(
    numbers.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const second = checkDigit(
    numbers.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return first === numbers[12] && second === numbers[13];
}

export function isCepValido(value) {
  return /^\d{8}$/.test(onlyDigits(value));
}

export function todayLocalISO() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= monthDays[month - 1];
}

export function isDataNascimentoValida(value, maxDate = todayLocalISO()) {
  return isCalendarDate(value) && value <= maxDate;
}

export function formatDataNascimento(value) {
  if (!isCalendarDate(value)) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
