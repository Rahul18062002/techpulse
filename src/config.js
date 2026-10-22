import { readFileSync } from 'node:fs'

const load = (name) => JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'))

export const interests = load('interests')
export const sources = load('sources')
export const engine = load('engine')
export const delivery = load('channels')

export const channelById = (id) => delivery.channels.find((c) => c.id === id)
export const allowedApps = Object.keys(delivery.apps)
export const tagById = (id) => interests.tags.find((t) => t.id === id)
export const companyById = (id) => interests.companies.find((c) => c.id === id)
