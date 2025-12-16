'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  AppBar,
  Toolbar,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Logout,
  Add,
  LocalFlorist,
  Thermostat,
  WaterDrop,
  Grass,
  Delete,
} from '@mui/icons-material';

interface PlantSpecies {
  _id: string;
  name: string;
  description?: string;
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

export default function PlantsPage() {
  const router = useRouter();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [plantStatuses, setPlantStatuses] = useState<Record<string, PlantStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [plantToDelete, setPlantToDelete] = useState<Plant | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userData));
    fetchPlants(token);
  }, [router]);

  const fetchPlants = async (token: string) => {
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
        throw new Error('Failed to fetch plants');
      }

      const data = await response.json();
      setPlants(data);

      // Fetch status for each plant
      const statusPromises = data.map(async (plant: Plant) => {
        try {
          const statusResponse = await fetch(`/api/plants/${plant._id}/status`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            return { plantId: plant._id, status: statusData.status || {}, timestamp: statusData.timestamp };
          }
        } catch (err) {
          // Ignore errors for individual status fetches
        }
        return { plantId: plant._id, status: {}, timestamp: null };
      });

      const statuses = await Promise.all(statusPromises);
      const statusMap: Record<string, PlantStatus> = {};
      statuses.forEach(({ plantId, status }) => {
        statusMap[plantId] = status;
      });
      setPlantStatuses(statusMap);
    } catch (err) {
      setError('Failed to load plants');
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

  const handlePlantClick = (plantId: string) => {
    router.push(`/plants/${plantId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getSpeciesName = (species: PlantSpecies | string): string => {
    if (typeof species === 'string') return 'Unknown';
    return species.name;
  };

  const handleDeleteClick = (plant: Plant, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click
    setPlantToDelete(plant);
    setDeleteDialogOpen(true);
  };

  const handleDeletePlant = async () => {
    if (!plantToDelete) return;

    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/plants/${plantToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete plant');
      }

      // Remove plant from local state
      setPlants(plants.filter(p => p._id !== plantToDelete._id));
      setDeleteDialogOpen(false);
      setPlantToDelete(null);
    } catch (err: any) {
      console.error('Error deleting plant:', err);
      alert(err.message || 'Failed to delete plant. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Plant Monitor
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              color="inherit"
              startIcon={<Add />}
              onClick={() => router.push('/plants/new')}
            >
              Add Plant
            </Button>
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
              <MenuItem onClick={() => router.push('/')}>
                Dashboard
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            My Plants
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : plants.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <LocalFlorist sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No plants yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Start monitoring your plants by adding your first one
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => router.push('/plants/new')}
            >
              Add Your First Plant
            </Button>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
              gap: 3,
            }}
          >
            {plants.map((plant) => (
              <Box key={plant._id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    position: 'relative',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6,
                    },
                  }}
                  onClick={() => handlePlantClick(plant._id)}
                >
                  <IconButton
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                      color: 'error.main',
                      '&:hover': {
                        backgroundColor: 'error.light',
                        color: 'error.dark',
                      },
                    }}
                    onClick={(e) => handleDeleteClick(plant, e)}
                    size="small"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <LocalFlorist color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6" component="h2" noWrap>
                        {plant.nickname}
                      </Typography>
                    </Box>

                    <Chip
                      label={getSpeciesName(plant.species)}
                      size="small"
                      color="secondary"
                      sx={{ mb: 2 }}
                    />

                    {(() => {
                      const status = plantStatuses[plant._id];
                      const hasStatus = status && Object.keys(status).length > 0;
                      const latestTimestamp = hasStatus 
                        ? new Date(Math.max(...Object.values(status).map(s => new Date(s.timestamp).getTime())))
                        : null;

                      return hasStatus ? (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom>
                            Current Status
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                            {status.temperature && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Thermostat fontSize="small" color="error" />
                                <Typography variant="body2">
                                  {status.temperature.value}{status.temperature.unit || '°C'}
                                </Typography>
                              </Box>
                            )}
                            {status.airMoisture && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <WaterDrop fontSize="small" color="primary" />
                                <Typography variant="body2">
                                  Air: {status.airMoisture.value}{status.airMoisture.unit || '%'}
                                </Typography>
                              </Box>
                            )}
                            {status.groundMoisture && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Grass fontSize="small" color="success" />
                                <Typography variant="body2">
                                  Ground: {status.groundMoisture.value}{status.groundMoisture.unit || '%'}
                                </Typography>
                              </Box>
                            )}
                            {latestTimestamp && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                Updated: {formatDate(latestTimestamp.toISOString())}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      ) : (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            No sensor data available yet
                          </Typography>
                        </Box>
                      );
                    })()}

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                      Added: {formatDate(plant.createdAt)}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        )}
      </Container>

      {/* Delete Plant Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Plant</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{plantToDelete?.nickname}</strong>?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This will permanently delete the plant, all associated sensors, and all sensor logs. This action cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialogOpen(false)} 
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeletePlant} 
            color="error" 
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? undefined : <Delete />}
          >
            {deleting ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} color="inherit" />
                Deleting...
              </Box>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

