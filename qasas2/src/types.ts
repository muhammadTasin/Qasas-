export enum ReactionType {
  LOVE = 'LOVE',
  SORROW = 'SORROW',
  ANGRY = 'ANGRY'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
}

export interface Comment {
  id: string;
  storyId: string;
  userId: string;
  user: User; // Joined for display
  body: string;
  createdAt: string; // ISO Date
}

export interface Reaction {
  userId: string;
  storyId: string;
  type: ReactionType;
}

export interface Story {
  id: string;
  title: string;
  content: string; // Markdown/Text
  authorId: string;
  author: User; // Joined for display
  createdAt: string; // ISO Date
  updatedAt: string; // ISO Date
  totalReadSeconds: number;
  estimatedReadTimeMinutes: number;
  reactionCounts: {
    [key in ReactionType]: number;
  };
  // Current user's reaction (for UI state)
  currentUserReaction?: ReactionType;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// --- Analytics Types ---

export interface GeoLocation {
  country: string;
  region: string;
  city: string;
  flag?: string; // Emoji flag
}

export interface StoryView {
  id: string;
  storyId: string;
  visitorId: string; // Cookie-based ID
  userId?: string; // Logged-in user ID (optional)
  
  // Device Fingerprint simulation
  deviceType: 'mobile' | 'desktop' | 'tablet';
  os: string;
  browser: string;
  
  // Location
  location: GeoLocation;
  
  firstSeenAt: string;
  lastSeenAt: string;
  viewCount: number; // For this specific session/day
}

export interface SiteStats {
  uniqueVisitors: number; // Last 30 days
  totalPageViews: number; // All time
}

export interface AnalyticsStats {
  totalViews: number;
  uniqueLoggedIn: number;
  uniqueGuests: number;
  totalReadTime: number;
  totalReadTimeLoggedIn: number;
  totalReadTimeGuests: number;
}
