import mongoose from 'mongoose'

// Global cache for connection (prevents multiple connections in dev)
let cached = (global as any).mongoose

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null }
}

export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI

  // Don't throw during build, just return null
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI not defined, skipping database connection')
    return null
  }

  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  await ensureHolderIndexes()

  return cached.conn
}

/** Drop stale wallet-only unique index once per process; keep compound tenantSlug+wallet. */
async function ensureHolderIndexes() {
  const g = global as { holderIndexesSynced?: boolean }
  if (g.holderIndexesSynced) return

  try {
    const { Holder } = await import('./models')
    await Holder.syncIndexes()
    g.holderIndexesSynced = true
  } catch (e) {
    console.warn('[DB] Holder syncIndexes failed:', e)
  }
}

export default connectDB
