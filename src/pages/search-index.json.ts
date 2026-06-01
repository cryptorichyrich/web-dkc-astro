// Static JSON endpoint — generates search index at build time
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const GET: APIRoute = async () => {
  const posts = await getCollection("blog");

  const documents = posts.map(post => ({
    id: post.id,
    title: post.data.title || "",
    subtitle: post.data.subtitle || "",
    tags: (post.data.tags || []).join(", "),
    slug: post.id,
    coverImage: post.data.coverImage || "",
    publishedAt: post.data.publishedAt
      ? new Date(post.data.publishedAt).toISOString().slice(0, 10)
      : "",
  }));

  return new Response(JSON.stringify(documents), {
    headers: { "Content-Type": "application/json" },
  });
};
