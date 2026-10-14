/**
 * Stream M3U / M3U8 Playlist Parser for AvaPlay Tizen
 * Parses large playlists line-by-line with low memory overhead.
 */

export class M3UParser {
  static parse(content) {
    const lines = content.split(/\r?\n/);
    const channels = [];
    const categoriesSet = new Set();

    let currentItem = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        currentItem = this.parseExtInf(line);
      } else if (!line.startsWith('#') && currentItem) {
        currentItem.streamUrl = line;
        
        // Categorize by stream URL or attributes
        const isMovie = line.includes('/movie/') || /\.(mp4|mkv|avi)$/i.test(line);
        const isSeries = line.includes('/series/');
        
        if (isMovie) {
          currentItem.type = 'MOVIE';
        } else if (isSeries) {
          currentItem.type = 'SHOW';
        } else {
          currentItem.type = 'LIVE';
        }

        if (currentItem.group) {
          categoriesSet.add(JSON.stringify({ id: currentItem.group, name: currentItem.group, type: currentItem.type }));
        }

        channels.push(currentItem);
        currentItem = null;
      }
    }

    const categories = Array.from(categoriesSet).map(s => JSON.parse(s));
    return { channels, categories };
  }

  static parseExtInf(line) {
    const item = {
      id: Math.random().toString(36).substring(2, 9),
      name: 'Unnamed Channel',
      group: 'General',
      logo: '',
      epgId: '',
      type: 'LIVE',
      streamUrl: ''
    };

    // Extract attributes: key="value"
    const attrRegex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
    let match;
    while ((match = attrRegex.exec(line)) !== null) {
      const key = match[1].toLowerCase();
      const val = match[2];

      if (key === 'tvg-id') item.epgId = val;
      else if (key === 'tvg-name' && !item.name) item.name = val;
      else if (key === 'tvg-logo') item.logo = val;
      else if (key === 'group-title') item.group = val;
    }

    // Extract channel title after last comma
    const commaIndex = line.lastIndexOf(',');
    if (commaIndex !== -1 && commaIndex < line.length - 1) {
      item.name = line.substring(commaIndex + 1).trim();
    }

    return item;
  }
}
