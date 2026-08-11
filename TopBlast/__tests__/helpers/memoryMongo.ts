import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

declare global {
  // eslint-disable-next-line no-var
  var __TOPBLAST_MEMORY_MONGO__: boolean | undefined
}

function assertMemoryMongoActive(action: string): void {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    throw new Error(`Refusing ${action}: never touch Mongo from a Vercel process`)
  }
  if (!global.__TOPBLAST_MEMORY_MONGO__) {
    throw new Error(
      `Refusing ${action}: only allowed against the Jest in-memory MongoMemoryServer`
    )
  }
  const uri = (mongoose.connection as { client?: { s?: { url?: string } } }).client?.s?.url
    ?? process.env.MONGODB_URI
    ?? ''
  if (uri.includes('mongodb+srv://') || uri.includes('.mongodb.net')) {
    throw new Error(`Refusing ${action}: Atlas URI is never a test database`)
  }
}

/** Connect Jest to an isolated in-memory MongoDB — never Atlas / Vercel / shared local. */
export async function startMemoryMongo(): Promise<MongoMemoryServer> {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    throw new Error('Refusing to start memory mongo on Vercel')
  }

  const existing = process.env.MONGODB_URI?.trim() ?? ''
  if (existing.includes('mongodb+srv://') || existing.includes('.mongodb.net')) {
    throw new Error('Refusing to start memory mongo while MONGODB_URI points at Atlas')
  }

  const mongo = await MongoMemoryServer.create()
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  const uri = mongo.getUri()
  process.env.MONGODB_URI = uri
  await mongoose.connect(uri)
  global.__TOPBLAST_MEMORY_MONGO__ = true
  return mongo
}

export async function stopMemoryMongo(mongo: MongoMemoryServer): Promise<void> {
  global.__TOPBLAST_MEMORY_MONGO__ = false
  await mongoose.disconnect()
  await mongo.stop()
}

/**
 * Clear collections on the current Jest MongoMemoryServer only.
 * There is no app API to wipe Atlas / Vercel / local shared DBs.
 */
export async function clearMemoryCollections(): Promise<void> {
  assertMemoryMongoActive('clearMemoryCollections')
  const { collections } = mongoose.connection
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({})
  }
}
