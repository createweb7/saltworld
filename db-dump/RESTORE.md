# Salt World MongoDB Dump — Restore Guide

**Dumped from:** `mongodb://localhost:27017/your_database_name` (Emergent workspace)
**Format:** `mongodump` native (BSON + metadata JSON)
**Restore tool:** `mongorestore` (comes with MongoDB Database Tools)

## Restore into a local Mongo

```bash
# 1) Extract the archive
tar -xzf salt-world-db-dump.tar.gz    # or unzip salt-world-db-dump.zip

# 2) Restore. Rename target DB to something sensible (the source is literally
#    named "your_database_name" — a placeholder from the initial workspace).
mongorestore \
  --uri="mongodb://localhost:27017" \
  --nsFrom="your_database_name.*" \
  --nsTo="saltworld.*" \
  db-dump/your_database_name

# 3) Point your app at it in .env
#    MONGO_URL=mongodb://localhost:27017
#    DB_NAME=saltworld
```

## Restore into MongoDB Atlas

```bash
mongorestore \
  --uri="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net" \
  --nsFrom="your_database_name.*" \
  --nsTo="saltworld.*" \
  db-dump/your_database_name
```

## Collections included

- Bookings, customers, therapies, resources, branches
- Memberships & subscriptions, wallet transactions, gift cards, coupons
- Users (admin), settings, calendar blocks, activity log
- CMS: outcomes, blog, testimonials, media assets, pages, templates

## Notes

- Admin credentials for the default admin user live in `users` collection
  (email `admin@saltworld.in`, bcrypt-hashed password). See
  `/app/memory/test_credentials.md` in the code repo for the plaintext.
- The dump captures the state at the moment `mongodump` ran — any bookings
  made after export won't be present.
- Do NOT commit this dump to a public GitHub repo if it contains real
  customer data — it holds phone numbers, emails, and referral codes.
