import webpush from 'web-push';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

let configured = false;

if (!publicKey || !privateKey) {
  console.warn('VAPID keys not configured - push notifications disabled');
} else {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export const isPushConfigured = configured;
export { webpush };
