# Payment service — Stripe Checkout + webhooks + RabbitMQ events
#
# Port: 3050
#
# Local webhook forwarding (required on localhost):
#   stripe listen --forward-to localhost:3001/api/webhooks/stripe
# Copy the printed whsec_... into STRIPE_WEBHOOK_SECRET, then restart this service.
#
# RabbitMQ (optional):
#   Start broker on localhost:5672, set RABBITMQ_ENABLED=true
#   Publishes payment.paid after Stripe webhook marks payment paid.

npm run start:dev
