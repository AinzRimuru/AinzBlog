const fs = require('fs');
const path = require('path');

async function syncTags(hexoInstance) {
  const posts = hexoInstance.locals.get('posts');
  const tags = new Set();

  posts.forEach(post => {
    post.tags.forEach(tag => {
      tags.add(tag.name);
    });
  });

  const configPath = path.join(hexoInstance.base_dir, '_config.yml');
  let configContent = fs.readFileSync(configPath, 'utf8');

  // Check if tag_map exists
  const tagMapRegex = /^tag_map:\s*$/m;
  const match = configContent.match(tagMapRegex);

  if (match) {
    const newTags = [];
    
    tags.forEach(tag => {
      const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagRegex = new RegExp(`^\\s+${escapedTag}:`, 'm');
      
      if (!tagRegex.test(configContent)) {
        newTags.push(tag);
      }
    });

    if (newTags.length > 0) {
      const newEntries = newTags.map(tag => {
        const slug = tag.toLowerCase().replace(/\s+/g, '-');
        return `  ${tag}: ${slug}`;
      }).join('\n');

      const insertIndex = match.index + match[0].length;
      const prefix = configContent[insertIndex] === '\n' ? '' : '\n';
      
      configContent = configContent.slice(0, insertIndex) + prefix + newEntries + '\n' + configContent.slice(insertIndex + prefix.length);
      
      fs.writeFileSync(configPath, configContent, 'utf8');
      hexoInstance.log.info(`[Sync Tags] Added ${newTags.length} new tags to _config.yml: ${newTags.join(', ')}`);
      
      // Update in-memory config so it applies to the current build
      if (!hexoInstance.config.tag_map) hexoInstance.config.tag_map = {};
      newTags.forEach(tag => {
          hexoInstance.config.tag_map[tag] = tag.toLowerCase().replace(/\s+/g, '-');
      });
    }
  } else {
    const newEntries = Array.from(tags).map(tag => {
      const slug = tag.toLowerCase().replace(/\s+/g, '-');
      return `  ${tag}: ${slug}`;
    }).join('\n');
    
    configContent += `\ntag_map:\n${newEntries}\n`;
    fs.writeFileSync(configPath, configContent, 'utf8');
    hexoInstance.log.info(`[Sync Tags] Created tag_map with ${tags.size} tags.`);
    
    // Update in-memory config
    if (!hexoInstance.config.tag_map) hexoInstance.config.tag_map = {};
    tags.forEach(tag => {
        hexoInstance.config.tag_map[tag] = tag.toLowerCase().replace(/\s+/g, '-');
    });
  }
}

hexo.extend.console.register('sync-tags', 'Sync tags from posts to _config.yml tag_map', async function(args) {
  await this.load();
  await syncTags(this);
});

hexo.extend.filter.register('before_generate', async function() {
  await syncTags(this);
});
