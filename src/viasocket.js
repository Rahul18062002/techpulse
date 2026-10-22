import { ViaSocket } from 'viasocket-apps'

export const viasocket = new ViaSocket({
  orgId: process.env.VIASOCKET_ORG_ID,
  projectId: process.env.VIASOCKET_PROJECT_ID,
  secret: process.env.VIASOCKET_EMBED_SECRET
})
// everything for one end user: viasocket.user(userId)

const fromList = new Map()

/**
 * The service_id for an app slug. viaSocket's slug lookup currently refuses Gmail's slug although
 * `catalog.list()` carries exactly that slug, so a refused slug is looked up in the live list before
 * giving up. Never a copied id.
 */
export async function serviceIdFor(slug) {
  try {
    return await viasocket.catalog.serviceIdFor(slug)
  } catch (error) {
    if (fromList.has(slug)) return fromList.get(slug)
    for (let offset = 0; offset < 5000; offset += 200) {
      const page = await viasocket.catalog.list({ limit: 200, offset })
      if (!page.length) break
      const app = page.find((a) => a.slug === slug)
      if (app) {
        fromList.set(slug, app.serviceId)
        return app.serviceId
      }
    }
    throw error
  }
}
