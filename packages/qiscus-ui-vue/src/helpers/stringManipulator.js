export default function textEllipsis(text, maxLength = 20) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}
