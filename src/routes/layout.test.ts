import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import Layout from './+layout.svelte';

function metaContent(name: string): string | null {
  const el = document.head.querySelector(`meta[name="${name}"]`);
  return el?.getAttribute('content') ?? null;
}

function ogContent(property: string): string | null {
  const el = document.head.querySelector(`meta[property="${property}"]`);
  return el?.getAttribute('content') ?? null;
}

describe('root layout — SEO head tags', () => {
  test('sets the document title to the site default', () => {
    render(Layout);
    expect(document.title).toBe('PF2e Encounter Tracker');
  });

  test('sets a meta description that mentions Pathfinder 2e', () => {
    render(Layout);
    const description = metaContent('description');
    expect(description).not.toBeNull();
    expect(description!.toLowerCase()).toContain('pathfinder');
  });

  test('sets a canonical link', () => {
    render(Layout);
    const link = document.head.querySelector('link[rel="canonical"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toMatch(/^https:\/\/pf2etracker\.app/);
  });

  test('sets Open Graph title, description, type, url, and image', () => {
    render(Layout);
    expect(ogContent('og:title')).toBe('PF2e Encounter Tracker');
    expect(ogContent('og:description')).not.toBeNull();
    expect(ogContent('og:type')).toBe('website');
    expect(ogContent('og:url')).toMatch(/^https:\/\/pf2etracker\.app/);
    expect(ogContent('og:image')).toBe('https://pf2etracker.app/og-image.png');
  });

  test('sets Twitter Card meta as summary_large_image', () => {
    render(Layout);
    const card = document.head.querySelector('meta[name="twitter:card"]');
    expect(card?.getAttribute('content')).toBe('summary_large_image');
  });

  test('links the SVG favicon and apple-touch-icon', () => {
    render(Layout);
    const svgIcon = document.head.querySelector('link[rel="icon"][type="image/svg+xml"]');
    expect(svgIcon?.getAttribute('href')).toBe('/favicon.svg');
    const apple = document.head.querySelector('link[rel="apple-touch-icon"]');
    expect(apple?.getAttribute('href')).toBe('/apple-touch-icon.png');
  });
});
