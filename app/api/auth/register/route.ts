import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import connectToDb from '@/lib/db'; 
import { User } from '@/models/User';

export async function POST(req: Request) {
  await connectToDb();
  
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists' }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({ name, email, passwordHash });

    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ message: 'JWT_SECRET not configured' }, { status: 500 });
    }

    // Create token
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    return NextResponse.json({ token, user: { name: user.name, email: user.email } }, { status: 201 });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ 
      message: 'Error creating user', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    }, { status: 500 });
  }
}