import bcryptjs from 'bcryptjs';
import {db} from '../db/index.ts';
import {userTable} from '../db/schema/index.ts';
import {eq} from 'drizzle-orm';

const SALT_ROUNDS = 10;

function generateUsername(email: string): string {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
}

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

export async function getUserByEmail(email: string) {
  const users = await db.select().from(userTable).where(eq(userTable.email, email));
  return users[0] || null;
}

export async function createUser(email: string, password: string, name: string) {
  const passwordHash = await hashPassword(password);
  const username = generateUsername(email);

  const users = await db
    .insert(userTable)
    .values({
      email,
      username,
      passwordHash,
      name,
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
