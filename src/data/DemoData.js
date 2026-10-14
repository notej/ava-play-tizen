/**
 * Rich Built-in Demo Data for AvaPlay Tizen
 * Provides public streams, movies, and series so the app works out-of-the-box.
 */

export const DEMO_DATA = {
  liveCategories: [
    { id: 'cat_news', name: 'News & World', type: 'LIVE' },
    { id: 'cat_sports', name: 'Sports 24/7', type: 'LIVE' },
    { id: 'cat_movies', name: 'Cinema & Classic', type: 'LIVE' },
    { id: 'cat_music', name: 'Music & Vibes', type: 'LIVE' },
    { id: 'cat_docs', name: 'Documentary', type: 'LIVE' }
  ],

  liveChannels: [
    {
      id: 'demo_live_1',
      name: 'Sky News Live',
      num: '101',
      categoryId: 'cat_news',
      icon: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=300&h=300&fit=crop',
      epgId: 'sky.news',
      type: 'LIVE',
      currentShow: 'World News Bulletin',
      nextShow: 'Business & Technology Report',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    },
    {
      id: 'demo_live_2',
      name: 'Red Bull Extreme Sports',
      num: '102',
      categoryId: 'cat_sports',
      icon: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=300&h=300&fit=crop',
      epgId: 'rb.sports',
      type: 'LIVE',
      currentShow: 'X-Alps Mountain Challenge',
      nextShow: 'Downhill Mountain Masters',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
    },
    {
      id: 'demo_live_3',
      name: 'Classic Cinema HD',
      num: '103',
      categoryId: 'cat_movies',
      icon: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300&h=300&fit=crop',
      epgId: 'classic.hd',
      type: 'LIVE',
      currentShow: 'Tears of Steel (Sci-Fi)',
      nextShow: 'Golden Age Masterpieces',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
    },
    {
      id: 'demo_live_4',
      name: 'Club Dance Music TV',
      num: '104',
      categoryId: 'cat_music',
      icon: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop',
      epgId: 'music.tv',
      type: 'LIVE',
      currentShow: 'Festival Anthems Live',
      nextShow: 'Electronic Chill Lounge',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
    },
    {
      id: 'demo_live_5',
      name: 'National Wildlife & Planet',
      num: '105',
      categoryId: 'cat_docs',
      icon: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&h=300&fit=crop',
      epgId: 'wildlife.hd',
      type: 'LIVE',
      currentShow: 'Deep Ocean Mysteries',
      nextShow: 'Predators of the Serengeti',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    }
  ],

  vodCategories: [
    { id: 'cat_action', name: 'Action & Adventure', type: 'MOVIE' },
    { id: 'cat_scifi', name: 'Sci-Fi & Cyberpunk', type: 'MOVIE' },
    { id: 'cat_animation', name: 'Animation & Family', type: 'MOVIE' },
    { id: 'cat_drama', name: 'Award-Winning Drama', type: 'MOVIE' }
  ],

  movies: [
    {
      id: 'demo_mov_1',
      name: 'Big Buck Bunny (4K Ultra HD)',
      categoryId: 'cat_animation',
      type: 'MOVIE',
      rating: '8.4',
      year: '2024',
      duration: '9m 56s',
      genre: 'Animation / Comedy',
      description: 'A large, lovable rabbit is provoked by bullying forest creatures and concocts an ingenious revenge plan across the woodland.',
      director: 'Sacha Goedegebure',
      cast: 'Bunny, Frank, Rinky, Gamera',
      image: 'https://images.unsplash.com/photo-1574063413132-355dbfd83e25?w=500&h=750&fit=crop',
      backdrop: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1920&h=1080&fit=crop',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    },
    {
      id: 'demo_mov_2',
      name: 'Tears of Steel: Cyberpunk Odyssey',
      categoryId: 'cat_scifi',
      type: 'MOVIE',
      rating: '8.9',
      year: '2025',
      duration: '12m 14s',
      genre: 'Sci-Fi / Action',
      description: 'In a dystopian future Amsterdam, a group of scientists and soldiers struggle to rescue humanity from an army of rampant cybernetic giants.',
      director: 'Ian Hubert',
      cast: 'Derek de Lint, Sergio Hasselbaink, Denise Rebergen',
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&h=750&fit=crop',
      backdrop: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1920&h=1080&fit=crop',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
    },
    {
      id: 'demo_mov_3',
      name: 'Sintel: Dragon Quest',
      categoryId: 'cat_action',
      type: 'MOVIE',
      rating: '8.7',
      year: '2025',
      duration: '15m 20s',
      genre: 'Fantasy / Adventure',
      description: 'A young lonely warrior journeys across perilous deserts, snow peaks, and dungeons to rescue an orphaned baby dragon from danger.',
      director: 'Colin Levy',
      cast: 'Halina Reijn, Thom Hoffman',
      image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&h=750&fit=crop',
      backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&h=1080&fit=crop',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
    },
    {
      id: 'demo_mov_4',
      name: 'Elephants Dream: Synthetic Reality',
      categoryId: 'cat_scifi',
      type: 'MOVIE',
      rating: '7.9',
      year: '2024',
      duration: '10m 54s',
      genre: 'Sci-Fi / Surreal',
      description: 'Two explorers traverse a bizarre, biomechanical machine world that shifts according to the thoughts and subconscious of its creator.',
      director: 'Bassam Kurdali',
      cast: 'Tygo Gernandt, Cas Jansen',
      image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&h=750&fit=crop',
      backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&h=1080&fit=crop',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
    }
  ],

  seriesCategories: [
    { id: 'cat_crime', name: 'Crime & Mystery', type: 'SHOW' },
    { id: 'cat_cyber', name: 'Tech & Dystopia', type: 'SHOW' }
  ],

  series: [
    {
      id: 'demo_ser_1',
      name: 'Obsidian Protocol: Season 1',
      categoryId: 'cat_cyber',
      type: 'SHOW',
      rating: '9.2',
      year: '2026',
      genre: 'Cyberpunk / Thriller',
      description: 'An elite counter-intelligence syndicate navigates neural-net warfare, synthetic intelligence rebellion, and corporate espionage.',
      image: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=500&h=750&fit=crop',
      backdrop: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&h=1080&fit=crop',
      seasons: {
        '1': [
          {
            id: 'ep_1_1',
            title: 'Episode 1: Zero Day Initiation',
            season: 1,
            episodeNum: 1,
            duration: '9m',
            plot: 'A silent security breach infiltrates the central orbital server, forcing an emergency team reunion.',
            streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
          },
          {
            id: 'ep_1_2',
            title: 'Episode 2: Neural Ghost',
            season: 1,
            episodeNum: 2,
            duration: '12m',
            plot: 'The team traces the anomaly to an encrypted sub-level in old Neo-Tokyo.',
            streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
          }
        ]
      }
    }
  ]
};
