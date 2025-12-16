import { NextResponse } from 'next/server';
import connectToDb from '@/lib/db';
import Plant from '@/models/Plant';
import { getUserId } from '@/lib/auth';

// GET: Get all my plants
export async function GET(req: Request) {
  await connectToDb();
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const plants = await Plant.find({ ownerId: userId })
      .populate('species')
      .sort({ createdAt: -1 });
      
    return NextResponse.json(plants);
  } catch (error) {
    return NextResponse.json({ message: 'Error fetching plants' }, { status: 500 });
  }
}

// POST: Create a new plant
export async function POST(req: Request) {
  await connectToDb();
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { nickname, speciesId, location } = body;

    if (!nickname || !speciesId) {
      return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
    }

    const newPlant = await Plant.create({
      nickname,
      species: speciesId,
      ownerId: userId,
    });

    return NextResponse.json(newPlant, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Error creating plant' }, { status: 500 });
  }
}