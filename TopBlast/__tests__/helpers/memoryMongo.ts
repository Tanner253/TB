import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

/** Connect Jest to an isolated in-memory MongoDB — never production. */
export async function startMemoryMongo(): Promise<MongoMemoryServer> {
  const existing = process.env.MONGODB_URI?.trim() ?? ''
  if (
    existing &&
    (existing.includes('mongodb+srv://') || existing.includes('.mongodb.net'))
  ) {
    throw new Error('Refusing to start memory mongo while MONGODB_URI points at Atlas')
  }

  const mongo = await MongoMemoryServer.create()
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  await mongoose.connect(mongo.getUri())
  return mongo
}

export async function stopMemoryMongo(mongo: MongoMemoryServer): Promise<void> {
  await mongoose.disconnect()
  await mongo.stop()
}

/** Clear all collections on the current (in-memory) connection. */
export async function clearMemoryCollections(): Promise<void> {
  const { collections } = mongoose.connection
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({})
  }
}
