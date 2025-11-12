const API_URL =
  process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5001';

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

export const api = {
  // Rooms
  createRoom: (adminId, adminNickname) =>
    request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ adminId, adminNickname }),
    }),

  getRoom: (roomId) => request(`/api/rooms/${roomId}`),

  updateRoomSettings: (roomId, requesterId, settings) =>
    request(`/api/rooms/${roomId}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ requesterId, ...settings }),
    }),

  addPlayer: (roomId, playerId, nickname) =>
    request(`/api/rooms/${roomId}/players`, {
      method: 'POST',
      body: JSON.stringify({ playerId, nickname }),
    }),

  removePlayer: (roomId, playerId) =>
    request(`/api/rooms/${roomId}/players/${playerId}`, {
      method: 'DELETE',
    }),

  updatePlayerRole: (roomId, playerId, role) =>
    request(`/api/rooms/${roomId}/players/${playerId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  updateRoomStatus: (roomId, status) =>
    request(`/api/rooms/${roomId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  // Games
  createGame: (roomId, wordmasterId, targetWord, wordType, players) =>
    request('/api/games', {
      method: 'POST',
      body: JSON.stringify({
        roomId,
        wordmasterId,
        targetWord,
        wordType,
        players,
      }),
    }),

  getGame: (gameId) => request(`/api/games/${gameId}`),

  getActiveGame: (roomId) => request(`/api/games/room/${roomId}/active`),

  updateGame: (gameId, updates) =>
    request(`/api/games/${gameId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  completeGame: (gameId, winnerId) =>
    request(`/api/games/${gameId}/complete`, {
      method: 'PUT',
      body: JSON.stringify({ winnerId }),
    }),
};
