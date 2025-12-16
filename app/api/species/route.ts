import dbConnect from '@/lib/db';
import PlantSpecies from '@/models/PlantSpecies';
import { NextRequest, NextResponse } from 'next/server';

// POST: Додати новий вид
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    // Тут ми не знаємо точно, що прийде, тому поки any
    const body = await req.json();

    const newSpecies = await PlantSpecies.create(body);

    return NextResponse.json({ success: true, data: newSpecies }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

// GET: Отримати список
export async function GET() {
  try {
    await dbConnect();
    const species = await PlantSpecies.find({});
    return NextResponse.json({ success: true, data: species });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}