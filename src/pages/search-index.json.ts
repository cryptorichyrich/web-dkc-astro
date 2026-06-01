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

  // Add reference pages (KHK, KGK, KV2) so they appear in main search
  const referencePages = [
    {
      id: "khk",
      title: "Kitab Hukum Kanonik (KHK)",
      subtitle: "Hukum Gereja Latin — 1.752 paragraf",
      tags: "hukum, kanonik, kanon, gereja, referensi",
      slug: "khk",
      coverImage: "",
      publishedAt: "",
    },
    {
      id: "katekismus",
      title: "Katekismus Gereja Katolik (KGK)",
      subtitle: "Ajaran resmi Gereja Katolik — 2.865 paragraf",
      tags: "katekismus, ajaran, iman, doktrin, referensi",
      slug: "katekismus",
      coverImage: "",
      publishedAt: "",
    },
    {
      id: "kvii",
      title: "Konsili Vatikan II (KV2)",
      subtitle: "Dokumen-dokumen resmi Konsili Vatikan II (1962–1965)",
      tags: "konsili, vatikan, dokumen, gereja, referensi",
      slug: "kvii",
      coverImage: "",
      publishedAt: "",
    },
    {
      id: "kompendium-kgk",
      title: "Kompendium Katekismus Gereja Katolik",
      subtitle: "Ringkasan resmi Katekismus Gereja Katolik",
      tags: "katekismus, kompendium, ajaran, referensi",
      slug: "kompendium-katekismus-gereja-katolik",
      coverImage: "",
      publishedAt: "",
    },
  ];

  return new Response(JSON.stringify([...documents, ...referencePages]), {
    headers: { "Content-Type": "application/json" },
  });
};
