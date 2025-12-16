import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import connectToDb from '@/lib/db';
import { User } from '@/models/User';

export async function POST(req: Request) {
  await connectToDb();

  try {
    const { email, password } = await req.json();

    // Find user (explicitly select passwordHash because we set select: false in model)
    const user = await User.findOne({ email }).select('+passwordHash');
    
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET!, { expiresIn: '30d' });

    return NextResponse.json({ token, user: { name: user.name, email: user.email } });
  } catch (error) {
    return NextResponse.json({ message: 'Error logging in' }, { status: 500 });
  }
}