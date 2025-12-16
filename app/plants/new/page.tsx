'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  IconButton,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import { AddCircleOutlined, Delete, Sensors } from '@mui/icons-material';

interface PlantSpecies {
  _id: string;
  name: string;
  description?: string;
}

interface SensorForm {
  deviceId: string;
  name: string;
  type: string;
  location: string;
}

const SENSOR_TYPES = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'airMoisture', label: 'Air Moisture' },
  { value: 'groundMoisture', label: 'Ground Moisture' },
  { value: 'pressure', label: 'Pressure' },
  { value: 'light', label: 'Light' },
  { value: 'ph', label: 'pH' },
];

export default function NewPlantPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [speciesId, setSpeciesId] = useState('');
  const [location, setLocation] = useState('');
  const [speciesList, setSpeciesList] = useState<PlantSpecies[]>([]);
  const [sensors, setSensors] = useState<SensorForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSpecies, setLoadingSpecies] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch available species
    const fetchSpecies = async () => {
      try {
        const response = await fetch('/api/species');
        const data = await response.json();
        
        if (data.success && data.data) {
          setSpeciesList(data.data);
        }
      } catch (err) {
        setError('Failed to load plant species');
      } finally {
        setLoadingSpecies(false);
      }
    };

    fetchSpecies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      // Filter out incomplete sensors
      const validSensors = sensors.filter(
        (s) => s.deviceId && s.name && s.type
      );

      const response = await fetch('/api/plants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          nickname,
          speciesId,
          ...(location && { location }),
          ...(validSensors.length > 0 && { sensors: validSensors }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to create plant');
        return;
      }

      // Success - redirect to plants list
      router.push('/plants');
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addSensor = () => {
    setSensors([
      ...sensors,
      { deviceId: '', name: '', type: '', location: '' },
    ]);
  };

  const removeSensor = (index: number) => {
    setSensors(sensors.filter((_, i) => i !== index));
  };

  const updateSensor = (index: number, field: keyof SensorForm, value: string) => {
    const updated = [...sensors];
    updated[index] = { ...updated[index], [field]: value };
    setSensors(updated);
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Box
            sx={{
              marginBottom: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <AddCircleOutlined color="primary" sx={{ fontSize: 40 }} />
            <Typography component="h1" variant="h4">
              Add New Plant
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          {loadingSpecies ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="nickname"
                label="Plant Nickname"
                name="nickname"
                placeholder="e.g., My Rose Bush"
                autoFocus
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />

              <FormControl fullWidth margin="normal" required>
                <InputLabel id="species-label">Plant Species</InputLabel>
                <Select
                  labelId="species-label"
                  id="species"
                  value={speciesId}
                  label="Plant Species"
                  onChange={(e) => setSpeciesId(e.target.value)}
                >
                  {speciesList.length === 0 ? (
                    <MenuItem disabled>No species available</MenuItem>
                  ) : (
                    speciesList.map((species) => (
                      <MenuItem key={species._id} value={species._id}>
                        {species.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>

              <TextField
                margin="normal"
                fullWidth
                id="location"
                label="Location (Optional)"
                name="location"
                placeholder="e.g., Living Room, Garden"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Sensors fontSize="small" />
                  Sensors (Optional)
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddCircleOutlined />}
                  onClick={addSensor}
                >
                  Add Sensor
                </Button>
              </Box>

              {sensors.map((sensor, index) => (
                <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle2">Sensor {index + 1}</Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeSensor(index)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>

                    <TextField
                      margin="dense"
                      required
                      fullWidth
                      label="Device ID"
                      placeholder="e.g., ESP32-001"
                      value={sensor.deviceId}
                      onChange={(e) => updateSensor(index, 'deviceId', e.target.value)}
                      sx={{ mb: 1 }}
                    />

                    <TextField
                      margin="dense"
                      required
                      fullWidth
                      label="Sensor Name"
                      placeholder="e.g., Temperature Sensor"
                      value={sensor.name}
                      onChange={(e) => updateSensor(index, 'name', e.target.value)}
                      sx={{ mb: 1 }}
                    />

                    <FormControl fullWidth margin="dense" required>
                      <InputLabel>Sensor Type</InputLabel>
                      <Select
                        value={sensor.type}
                        label="Sensor Type"
                        onChange={(e) => updateSensor(index, 'type', e.target.value)}
                      >
                        {SENSOR_TYPES.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      margin="dense"
                      fullWidth
                      label="Sensor Location (Optional)"
                      placeholder="e.g., Top of pot"
                      value={sensor.location}
                      onChange={(e) => updateSensor(index, 'location', e.target.value)}
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              ))}

              {sensors.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                  No sensors added. You can add sensors later or during plant creation.
                </Typography>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading || !nickname || !speciesId}
              >
                {loading ? 'Creating...' : 'Add Plant'}
              </Button>

              <Button
                fullWidth
                variant="outlined"
                onClick={() => router.push('/plants')}
                sx={{ mb: 2 }}
              >
                Cancel
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

