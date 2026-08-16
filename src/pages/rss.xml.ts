import rss from "@astrojs/rss";
import { site } from "@/config/site.ts";
import { getPosts } from "@/lib/posts.ts";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const posts = (await getPosts(({ data }) => !data.noindex))
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
    .slice(0, 20);

  return rss({
    title: site.name,
    description: site.catchphrase,
    site: site.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: `/c/${post.data.cluster}/${post.id}/`,
    })),
  });
};
