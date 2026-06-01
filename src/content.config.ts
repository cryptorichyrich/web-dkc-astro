import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    author: z.string().default("Damai Kasih Channel"),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    coverImage: z.string().optional(),
    thumbnailImage: z.string().optional(),
    heroImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    category: z.string().optional(),
    toc: z.boolean().default(false),
    featured: z.boolean().default(false),
  }),
});

const summa = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/summa" }),
  schema: z.object({
    title: z.string(),
    part: z.string(),
    partNum: z.number(),
    questionNumber: z.number(),
    partSlug: z.string(),
  }),
});

export const collections = { blog, summa };
