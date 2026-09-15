import { escapeHtml } from '../lib/utils.js';

// Minimal safe markdown-lite for Gemini output: escape first, then
// support bold, small headings, dash bullets and line breaks.
export function mdLite(text) {
  const esc = escapeHtml(text);
  return esc
    .replace(/^####\s+(.*)$/gm, '<h5>$1</h5>')
    .replace(/^###\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\n)\s*[-•]\s+(.*?)(?=\n\s*[-•]|\n\n|$)/g, '$1<span class="bullet">$2</span>')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}
