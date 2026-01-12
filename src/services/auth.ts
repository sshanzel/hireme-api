import bcryptjs from 'bcryptjs';
import {db} from '../db/index.ts';
import {user} from '../db/schema/index.ts';
import {eq} from 'drizzle-orm';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

export async function getUserByEmail(email: string) {
  const users = await db.select().from(user).where(eq(user.email, email));
  return users[0] || null;
}

export async function createUser(email: string, password: string, displayName?: string) {
  const passwordHash = await hashPassword(password);

  const users = await db
    .insert(user)
    .values({
      email,
      passwordHash,
      displayName,
    })
    .returning();

  return users[0];
}

export async function authenticateUser(email: string, password: string) {
  const existingUser = await getUserByEmail(email);

  if (!existingUser) {
    return null;
  }

  const isPasswordValid = await verifyPassword(password, existingUser.passwordHash);

  if (!isPasswordValid) {
    return null;
  }

  return existingUser;
}
