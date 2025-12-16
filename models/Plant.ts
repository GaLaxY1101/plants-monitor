import mongoose, { Schema, Document, Model } from 'mongoose';
import { IPlantSpecies } from './PlantSpecies'; // Імпорт інтерфейсу виду, який ми робили раніше
import { IUser } from './User';

// 1. Інтерфейс (TypeScript)
export interface IPlant extends Document {
  nickname: string;      
  ownerId: mongoose.Types.ObjectId | IUser; 
  species: mongoose.Types.ObjectId | IPlantSpecies; // Link до довідника (PlantSpecies)
  // Note: Sensors reference this plant via plantId (one-to-many relationship)
  // Note: Latest status is fetched from SensorLogs, not stored here
  createdAt: Date;
  updatedAt: Date;
}

// 2. Схема (Mongoose)
const PlantSchema: Schema<IPlant> = new Schema({
  nickname: {
    type: String,
    required: [true, 'Будь ласка, дайте рослині ім\'я'],
    trim: true,
  },
  species: {
    type: Schema.Types.ObjectId,
    ref: 'PlantSpecies', 
    required: true,
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true, 
    index: true 
  },
  // Note: Sensors reference this plant via plantId field (one-to-many)
  // Note: Latest status is fetched from SensorLogs, not stored here
}, {
  timestamps: true // Автоматично додає createdAt та updatedAt
});

// 3. Експорт моделі
// Перевірка на існування моделі (для hot-reload у Next.js/NestJS)
const Plant: Model<IPlant> = mongoose.models.Plant || mongoose.model<IPlant>('Plant', PlantSchema);

export default Plant;