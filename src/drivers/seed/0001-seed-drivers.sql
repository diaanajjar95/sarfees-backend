-- ============================================================================
-- Sarfees — Driver pre-approval seed
-- ============================================================================
-- Drivers register externally via the ops team; the app only authenticates
-- phones that already exist in the `drivers` table. This file seeds a few test
-- drivers (with full profile + vehicle) so the auth, home, and activation
-- flows can be exercised locally.
--
-- Run after the schema is created (TypeORM `synchronize: true` will create
-- the `drivers` table on first app boot — start the app once before running
-- this script).
--
-- Usage:
--   psql "$DATABASE_URL" -f src/drivers/seed/0001-seed-drivers.sql
-- ============================================================================

INSERT INTO drivers (
  name, "phoneNumber", "countryCode", gender, "homeCity",
  "vehicleMake", "vehicleModel", "vehicleColor", "vehicleYear",
  "plateNumber", "passengerCapacity",
  rating, "ratingCount", "totalTrips", "outstandingBalance",
  status, language, "hasVerifiedOtpBefore",
  "otpRequestCount", "otpAttemptCount", "prefGoingHome",
  "notifyTripOffers", "notifyTripUpdates", "notifyEarnings", "notifyAnnouncements"
) VALUES
  ('Mohammed Al-Rashid', '7700000001', '+962', 'male',   'Amman',
   'Toyota', 'Camry',  'White',  2022, '12-34567', 4,
   4.85, 48, 142, 0,
   'inactive', 'en', false, 0, 0, false,
   true, true, true, true),

  ('Layla Hassan',       '7700000002', '+962', 'female', 'Irbid',
   'Hyundai', 'Elantra', 'Silver', 2021, '23-45678', 4,
   4.92, 73, 201, 0,
   'inactive', 'ar', false, 0, 0, false,
   true, true, true, true),

  ('Omar Khalil',        '7700000003', '+962', 'male',   'Amman',
   'Kia', 'Cerato', 'Black', 2023, '34-56789', 4,
   4.70, 22, 56, 0,
   'inactive', 'en', false, 0, 0, false,
   true, true, true, true),

  ('Fatima Al-Najjar',   '7700000004', '+962', 'female', 'Irbid',
   'Nissan', 'Sunny', 'Blue', 2020, '45-67890', 4,
   4.95, 110, 287, 0,
   'inactive', 'ar', false, 0, 0, false,
   true, true, true, true)
ON CONFLICT ON CONSTRAINT "UQ_driver_phone_country" DO NOTHING;
