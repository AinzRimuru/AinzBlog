/**
 * 生成文章数据 JSON 文件
 * 用于推荐阅读功能
 */

hexo.extend.generator.register('posts-data', function(locals) {
  const posts = locals.posts.sort('-date').map(post => ({
    title: post.title || '(无标题)',
    path: post.path,
    date: post.date.toISOString(),
    categories: post.categories?.map(cat => cat.name) || [],
    tags: post.tags?.map(tag => tag.name) || []
  }));

  return {
    path: 'js/posts-data.json',
    data: JSON.stringify(posts)
  };
});
