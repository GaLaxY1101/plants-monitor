import mongoose, { Schema, Document, Model } from 'mongoose';

// 1. Описуємо структуру даних (Interface)
export interface IPlantSpecies extends Document {
  name: string;
  description?: string;
  idealConditions: {
    temperature: {
        min: number;
        max: number;
    },
    airMoisture: {
        min: number;
        max: number;
    },
    groundMoisture: {
        min: number;
        max: number;
    }
  };
  createdAt: Date;
}

// 2. Створюємо схему
const PlantSpeciesSchema: Schema<IPlantSpecies> = new Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name for this species'],
    unique: true,
  },
  description: {
    type: String,
  },
  idealConditions: {
    temperature: {
      min: { type: Number, required: true },
      max: { type: Number, required: true },
    },
    airMoisture: {
      min: { type: Number, required: true },
      max: { type: Number, required: true },
    },
    groundMoisture: {
      min: { type: Number, required: true },
      max: { type: Number, required: true },
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

// 3. Експортуємо модель
// Перевірка: якщо модель вже існує (при hot-reload), беремо її, інакше створюємо нову
const PlantSpecies: Model<IPlantSpecies> = 
  mongoose.models.PlantSpecies || mongoose.model<IPlantSpecies>('PlantSpecies', PlantSpeciesSchema);

export default PlantSpecies;