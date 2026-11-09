const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'https://yashatelier.store'

export const SITE_URL = new URL(configuredSiteUrl).origin