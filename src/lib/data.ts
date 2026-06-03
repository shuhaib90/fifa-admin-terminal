// FIFA World Cup 2026 Complete Data Store & API Layer

export interface Team {
  id: number;
  name: string;
  code: string;
  flag: string;
  group: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: ('W' | 'D' | 'L')[];
}

export interface Stadium {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  imageUrl: string;
  weatherTemp: number;
  weatherCondition: string;
  lat: number;
  lng: number;
}

export interface MatchEvent {
  id: string;
  time: number;
  type: 'goal' | 'yellow' | 'red' | 'sub';
  teamId: number;
  detail: string; // e.g. "L. Messi"
  assist?: string; // e.g. "J. Alvarez"
  detailOut?: string; // for substitution
}

export interface MatchStats {
  possession: [number, number]; // [home, away]
  shots: [number, number];
  shotsOnTarget: [number, number];
  fouls: [number, number];
  corners: [number, number];
  yellowCards: [number, number];
  redCards: [number, number];
  offsides: [number, number];
}

export interface MatchLineupPlayer {
  number: number;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  rating?: number;
}

export interface MatchLineups {
  home: {
    formation: string;
    startXI: MatchLineupPlayer[];
    subs: MatchLineupPlayer[];
  };
  away: {
    formation: string;
    startXI: MatchLineupPlayer[];
    subs: MatchLineupPlayer[];
  };
}

export interface Match {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  kickoffTime: string; // ISO String
  status: 'scheduled' | 'live' | 'finished';
  stage: 'Group Stage' | 'Round of 32' | 'Round of 16' | 'Quarter Final' | 'Semi Final' | 'Final';
  venueId: string;
  homeScore: number;
  awayScore: number;
  minute?: number;
  referee: string;
  events: MatchEvent[];
  stats: MatchStats;
  lineups: MatchLineups;
  commentary: { time: number; text: string }[];
  h2h: { date: string; result: string; home: string; away: string }[];
  aiPrediction?: {
    homeWinProb: number;
    awayWinProb: number;
    drawProb: number;
    predictedScore: string;
    analysis: string;
  };
}

export interface Player {
  id: number;
  name: string;
  teamId: number;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  price: number; // in millions
  points: number;
  flag: string;
  teamName: string;
  goals: number;
  assists: number;
}

// 1. Teams (48 teams grouped into 12 groups: A to L)
export const initialTeams: Team[] = [];

// 2. Stadiums (16 host cities)
export const initialStadiums: Stadium[] = [
  { id: "s1", name: "MetLife Stadium", city: "East Rutherford (NY/NJ)", country: "USA", capacity: 82500, imageUrl: "https://images.unsplash.com/photo-1564981797816-1043664bf78d?q=80&w=600", weatherTemp: 24, weatherCondition: "Sunny", lat: 40.8135, lng: -74.0743 },
  { id: "s2", name: "SoFi Stadium", city: "Los Angeles", country: "USA", capacity: 70240, imageUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=600", weatherTemp: 22, weatherCondition: "Clear", lat: 33.9534, lng: -118.3387 },
  { id: "s3", name: "Azteca Stadium", city: "Mexico City", country: "Mexico", capacity: 87523, imageUrl: "https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?q=80&w=600", weatherTemp: 19, weatherCondition: "Partly Cloudy", lat: 19.3029, lng: -99.1505 },
  { id: "s4", name: "BC Place", city: "Vancouver", country: "Canada", capacity: 54500, imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600", weatherTemp: 16, weatherCondition: "Rainy", lat: 49.2767, lng: -123.1120 },
  { id: "s5", name: "AT&T Stadium", city: "Arlington (Dallas)", country: "USA", capacity: 80000, imageUrl: "https://images.unsplash.com/photo-1504156806580-c13f50978e87?q=80&w=600", weatherTemp: 28, weatherCondition: "Sunny", lat: 32.7473, lng: -97.0945 },
  { id: "s6", name: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA", capacity: 71000, imageUrl: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=600", weatherTemp: 25, weatherCondition: "Humid", lat: 33.7577, lng: -84.4008 },
  { id: "s7", name: "Hard Rock Stadium", city: "Miami", country: "USA", capacity: 64767, imageUrl: "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=600", weatherTemp: 30, weatherCondition: "Sunny", lat: 25.9580, lng: -80.2389 },
  { id: "s8", name: "Lumen Field", city: "Seattle", country: "USA", capacity: 69000, imageUrl: "https://images.unsplash.com/photo-1518063319789-7217e6706b04?q=80&w=600", weatherTemp: 15, weatherCondition: "Cloudy", lat: 47.5952, lng: -122.3316 }
];

// 3. Matches Schedule
export const initialMatches: Match[] = [];

// 4. Fantasy Stars
export const initialPlayers: Player[] = [
  { id: 201, name: "Kylian Mbappé", teamId: 13, teamName: "France", position: "FWD", price: 12.5, points: 28, flag: "🇫🇷", goals: 3, assists: 1 },
  { id: 202, name: "Lionel Messi", teamId: 21, teamName: "Argentina", position: "FWD", price: 11.5, points: 22, flag: "🇦🇷", goals: 2, assists: 1 },
  { id: 203, name: "Vinícius Júnior", teamId: 17, teamName: "Brazil", position: "FWD", price: 12.0, points: 18, flag: "🇧🇷", goals: 1, assists: 2 },
  { id: 204, name: "Jude Bellingham", teamId: 29, teamName: "England", position: "MID", price: 11.0, points: 15, flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", goals: 1, assists: 1 },
  { id: 205, name: "Kevin De Bruyne", teamId: 41, teamName: "Belgium", position: "MID", price: 10.5, points: 12, flag: "🇧🇪", goals: 0, assists: 3 },
  { id: 206, name: "Manuel Akanji", teamId: 22, teamName: "Switzerland", position: "DEF", price: 6.5, points: 9, flag: "🇨🇭", goals: 0, assists: 0 },
  { id: 207, name: "Emi Martínez", teamId: 21, teamName: "Argentina", position: "GK", price: 6.0, points: 14, flag: "🇦🇷", goals: 0, assists: 0 },
  { id: 208, name: "Achraf Hakimi", teamId: 2, teamName: "Morocco", position: "DEF", price: 7.0, points: 11, flag: "🇲🇦", goals: 0, assists: 1 }
];

// 5. Standings Builder
export const getStandingsByGroup = (teamsList: Team[]) => {
  const groups: { [key: string]: Team[] } = {};
  teamsList.forEach(team => {
    if (!groups[team.group]) {
      groups[team.group] = [];
    }
    groups[team.group].push(team);
  });
  
  // Sort teams by points, goalDifference, goalsFor
  Object.keys(groups).forEach(groupName => {
    groups[groupName].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });
  });

  return groups;
};
