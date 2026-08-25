# Payment service — Stripe Checkout + webhooks
#
# Port: 3050
#
# Local webhook forwarding (required on localhost):
#   stripe listen --forward-to localhost:3001/api/webhooks/stripe
# Copy the printed whsec_... into STRIPE_WEBHOOK_SECRET, then restart this service.
# Each `stripe listen` session prints a new secret.

npm run start:dev
