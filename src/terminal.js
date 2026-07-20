export const ANSI_PATTERN = /[\u001b\u009b](?:(?:\][^\u0007]*(?:\u0007|\u001b\\))|(?:\[[0-?]*[ -/]*[@-~])|(?:[()][0-2A-Z0-9])|(?:[ -/]*[@-~]))/gu;
export const UNSAFE_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001a\u001c-\u001f\u007f-\u009f]/gu;

export function sanitizeTerminalText(value) {
  return String(value ?? '')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replace(ANSI_PATTERN, '')
    .replace(UNSAFE_CONTROL_PATTERN, '');
}
