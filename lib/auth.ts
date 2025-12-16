import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';

export async function getUserId() {
  const headersList = await headers();
  const token = headersList.get('authorization')?.replace('Bearer ', '');

  if (!token) return null;

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded._id;
  } catch (error) {
    return null;
  }
}