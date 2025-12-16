'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Button,
  AppBar,
  Toolbar,
  Avatar,
  Menu,
  MenuItem,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Logout,
  ArrowBack,
  LocalFlorist,
  Thermostat,
  WaterDrop,
  Grass,
} from '@mui/icons-material';

interface PlantSpecies {
  _id: string;
  name: string;
  description?: string;
  idealConditions?: {
    temperature: { min: number; max: number };
    airMoisture: { min: number; max: number };
    groundMoisture: { min: number; max: number };
  };
}

interface PlantStatus {
  [key: string]: {
    value: number;
    unit: string;
    timestamp: Date;
  };
}

interface Plant {
  _id: string;
  nickname: string;
  species: PlantSpecies | string;
  createdAt: string;
}

export default function PlantDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const plantId = params.id as string;

  const [plant, setPlant] = useState<Plant | null>(null);
  const [plantStatus, setPlantStatus] = useState<PlantStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userData));
    fetchPlant(token);
  }, [router, plantId]);

  const fetchPlant = async (token: string) => {
    try {
      const response = await fetch('/api/plants', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch plant');
      }

      const plants = await response.json();
      const foundPlant = plants.find((p: Plant) => p._id === plantId);
      
      if (!foundPlant) {
        setError('Plant not found');
        return;
      }

      setPlant(foundPlant);

      // Fetch status for this plant
      try {
        const statusResponse = await fetch(`/api/plants/${plantId}/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setPlantStatus(statusData.status || null);
        }
      } catch (err) {
        // Ignore status fetch errors
      }
    } catch (err) {
      setError('Failed to load plant');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getSpeciesName = (species: PlantSpecies | string): string => {
    if (typeof species === 'string') return 'Unknown';
    return species.name;
  };

  const getSpeciesData = (species: PlantSpecies | string): PlantSpecies | null => {
    if (typeof species === 'string') return null;
    return species;
  };

  const getStatusColor = (value: number, min: number, max: number): 'success' | 'warning' | 'error' => {
    if (value >= min && value <= max) return 'success';
    if (value < min * 0.8 || value > max * 1.2) return 'error';
    return 'warning';
  };

  if (!user) {
    return null;
  }

  const speciesData = plant ? getSpeciesData(plant.species) : null;

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Button
            color="inherit"
            startIcon={<ArrowBack />}
            onClick={() => router.push('/plants')}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Plant Dashboard
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1">{user.name}</Typography>
            <Avatar
              sx={{ bgcolor: 'secondary.main', cursor: 'pointer' }}
              onClick={handleMenuOpen}
            >
              {user.name.charAt(0).toUpperCase()}
            </Avatar>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={() => router.push('/plants')}>
                My Plants
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <Logout sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4, mb: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : plant ? (
          <>
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <LocalFlorist color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="h1">
                    {plant.nickname}
                  </Typography>
                  <Chip
                    label={getSpeciesName(plant.species)}
                    color="secondary"
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Box>
              {speciesData?.description && (
                <Typography variant="body1" color="text.secondary">
                  {speciesData.description}
                </Typography>
              )}
            </Box>

            {plantStatus && Object.keys(plantStatus).length > 0 ? (
              <Grid container spacing={3}>
                {plantStatus.temperature && (
                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Thermostat color="error" sx={{ mr: 1, fontSize: 32 }} />
                          <Typography variant="h6">Temperature</Typography>
                        </Box>
                        <Typography variant="h4" gutterBottom>
                          {plantStatus.temperature.value}{plantStatus.temperature.unit || '°C'}
                        </Typography>
                        {speciesData?.idealConditions && (
                          <>
                            <Typography variant="body2" color="text.secondary">
                              Ideal: {speciesData.idealConditions.temperature.min}°C - {speciesData.idealConditions.temperature.max}°C
                            </Typography>
                            <Chip
                              label={
                                plantStatus.temperature.value >= speciesData.idealConditions.temperature.min &&
                                plantStatus.temperature.value <= speciesData.idealConditions.temperature.max
                                  ? 'Optimal'
                                  : 'Out of range'
                              }
                              color={getStatusColor(
                                plantStatus.temperature.value,
                                speciesData.idealConditions.temperature.min,
                                speciesData.idealConditions.temperature.max
                              )}
                              size="small"
                              sx={{ mt: 1 }}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {plantStatus.airMoisture && (
                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <WaterDrop color="primary" sx={{ mr: 1, fontSize: 32 }} />
                          <Typography variant="h6">Air Moisture</Typography>
                        </Box>
                        <Typography variant="h4" gutterBottom>
                          {plantStatus.airMoisture.value}{plantStatus.airMoisture.unit || '%'}
                        </Typography>
                        {speciesData?.idealConditions && (
                          <>
                            <Typography variant="body2" color="text.secondary">
                              Ideal: {speciesData.idealConditions.airMoisture.min}% - {speciesData.idealConditions.airMoisture.max}%
                            </Typography>
                            <Chip
                              label={
                                plantStatus.airMoisture.value >= speciesData.idealConditions.airMoisture.min &&
                                plantStatus.airMoisture.value <= speciesData.idealConditions.airMoisture.max
                                  ? 'Optimal'
                                  : 'Out of range'
                              }
                              color={getStatusColor(
                                plantStatus.airMoisture.value,
                                speciesData.idealConditions.airMoisture.min,
                                speciesData.idealConditions.airMoisture.max
                              )}
                              size="small"
                              sx={{ mt: 1 }}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {plantStatus.groundMoisture && (
                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Grass color="success" sx={{ mr: 1, fontSize: 32 }} />
                          <Typography variant="h6">Ground Moisture</Typography>
                        </Box>
                        <Typography variant="h4" gutterBottom>
                          {plantStatus.groundMoisture.value}{plantStatus.groundMoisture.unit || '%'}
                        </Typography>
                        {speciesData?.idealConditions && (
                          <>
                            <Typography variant="body2" color="text.secondary">
                              Ideal: {speciesData.idealConditions.groundMoisture.min}% - {speciesData.idealConditions.groundMoisture.max}%
                            </Typography>
                            <Chip
                              label={
                                plantStatus.groundMoisture.value >= speciesData.idealConditions.groundMoisture.min &&
                                plantStatus.groundMoisture.value <= speciesData.idealConditions.groundMoisture.max
                                  ? 'Optimal'
                                  : 'Out of range'
                              }
                              color={getStatusColor(
                                plantStatus.groundMoisture.value,
                                speciesData.idealConditions.groundMoisture.min,
                                speciesData.idealConditions.groundMoisture.max
                              )}
                              size="small"
                              sx={{ mt: 1 }}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No sensor data available
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sensor readings will appear here once data is received from your IoT device.
                </Typography>
              </Paper>
            )}
          </>
        ) : null}
      </Container>
    </>
  );
}

