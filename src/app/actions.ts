'use server'

import {getHomeProperties, getPropertiesPage, type PropertyCursor} from './queries'

export async function refreshPropertiesAction(city?: string) {
  return getHomeProperties({city})
}

export async function loadMorePropertiesAction(
  cursor: PropertyCursor,
  city: string | undefined,
  excludeIds: string[]
) {
  const page = await getPropertiesPage({city}, cursor)
  const excluded = new Set(excludeIds)
  return {
    properties: page.properties.filter(p => !excluded.has(p.id)),
    cursor: page.cursor
  }
}
